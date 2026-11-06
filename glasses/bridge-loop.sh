#!/usr/bin/env bash
# Supervisor for imubridge. See README-bridge.md for the full design.
#
# Failure modes covered:
#   - SDK process vanishes (notify storm 0xd, 0x7/0x8, no crash report) ->
#     restarted within ~1s.
#   - Process alive but SDK stalled awake (no samples) -> bridge-internal
#     watchdog re-arms/re-inits; health-file staleness is the backstop here.
#   - FEED DEGRADATION under load (the demo killer): effective rate falls to
#     tens of Hz while the process looks perfectly alive. The supervisor reads
#     the bridge's 5s trailing rate from the health file and restarts the
#     bridge when rate_hz stays below BRIDGE_RATE_MIN_HZ (default 350) for
#     BRIDGE_RATE_BAD_POLLS consecutive polls (~10s). sleeping=1 suppresses
#     all rate/stall checks — silence while the glasses report SLEEP is fine.
#   - Supervisor killed with the login session -> start double-forks via
#     setsid + nohup and keeps pidfiles; it is reparented to launchd.
#
#   bash bridge-loop.sh start [tcpPort] [secondsPerInstance]
#   bash bridge-loop.sh stop
#   bash bridge-loop.sh status
#   bash bridge-loop.sh run   [tcpPort] [secondsPerInstance]   # foreground (internal)
#
# Env overrides:
#   BRIDGE_STATE_DIR          pid/log/health files            (default /tmp)
#   BRIDGE_BIN                binary to supervise             (default ./imubridge)
#   BRIDGE_STALL_MS           max awake sample silence         (default 15000)
#   BRIDGE_HEALTH_MAX_AGE_MS  max health-file age             (default 6000)
#   BRIDGE_RATE_MIN_HZ        min sustained effective rate    (default 350; 0=off)
#   BRIDGE_RATE_BAD_POLLS     polls below min before restart  (default 5)
#   BRIDGE_RATE_GRACE_MS      no rate check this long post-start (default 15000)
#   BRIDGE_RECORD             1 = pass --record $NDJSON to the bridge
#                             (default OFF — recording is pure load during a take)
#   BRIDGE_SELFTEST           1 = run the bridge's synthetic 497Hz generator
#                             instead of the SDK (preflight without glasses)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
CMD="${1:-status}"

STATE_DIR="${BRIDGE_STATE_DIR:-/tmp}"
PIDFILE="$STATE_DIR/bridge-loop.pid"          # supervisor pid
CHILD_PIDFILE="$STATE_DIR/bridge-loop.child.pid"
NDJSON="$STATE_DIR/bridge-loop.ndjson"
ERRLOG="$STATE_DIR/bridge-loop.err"
HEALTH="$STATE_DIR/bridge-loop.health"

BIN="${BRIDGE_BIN:-$HERE/imubridge}"
STALL_MS="${BRIDGE_STALL_MS:-15000}"
HEALTH_MAX_AGE_MS="${BRIDGE_HEALTH_MAX_AGE_MS:-6000}"
RATE_MIN_HZ="${BRIDGE_RATE_MIN_HZ:-350}"
RATE_BAD_POLLS="${BRIDGE_RATE_BAD_POLLS:-5}"
RATE_GRACE_MS="${BRIDGE_RATE_GRACE_MS:-15000}"
RECORD="${BRIDGE_RECORD:-0}"
SELFTEST="${BRIDGE_SELFTEST:-0}"
BACKOFF_MAX=30
MIN_RUN=5   # seconds; a child dying faster than this counts as a failed start

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$ERRLOG"; }

now_ms() { python3 -c 'import time; print(int(time.time()*1000))'; }

file_mtime_ms() { stat -f %m "$1" 2>/dev/null | awk '{print $1 * 1000}'; }

health_field() { # health_field <name> -> value or empty
  grep -o "\"$1\":[-0-9.]*" "$HEALTH" 2>/dev/null | head -1 | cut -d: -f2
}

is_running() { # is_running <pidfile>
  local pid
  pid="$(cat "$1" 2>/dev/null)" || return 1
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

# Elevate scheduling priority. Under demo load (agent + inference + Chrome +
# screen recording) a nice-0 bridge starves; -10 keeps the USB callback
# thread on the CPU. Needs root for a negative niceness: try renice directly,
# then passwordless sudo; log whatever we ended up with.
raise_priority() { # raise_priority <pid>
  renice -n -10 -p "$1" >/dev/null 2>&1 || sudo -n renice -n -10 -p "$1" >/dev/null 2>&1
  local nice_val
  nice_val="$(ps -o nice= -p "$1" 2>/dev/null | tr -d ' ')"
  if [ "${nice_val:-0}" = "0" ]; then
    log "WARNING: could not renice pid $1 below 0 (needs sudo once, or a sudoers entry) — running at normal priority"
  else
    log "bridge pid $1 running at nice $nice_val"
  fi
}

stop_bridge() {
  local stopped=0 spid cpid
  spid="$(cat "$PIDFILE" 2>/dev/null)"
  cpid="$(cat "$CHILD_PIDFILE" 2>/dev/null)"
  if [ -n "$spid" ] && kill -0 "$spid" 2>/dev/null; then
    kill "$spid" 2>/dev/null && stopped=1
  fi
  if [ -n "$cpid" ] && kill -0 "$cpid" 2>/dev/null; then
    kill "$cpid" 2>/dev/null
    sleep 1
    kill -9 "$cpid" 2>/dev/null
    stopped=1
  fi
  rm -f "$PIDFILE" "$CHILD_PIDFILE"
  if [ "$stopped" = 1 ]; then echo "stopped"; else echo "not running"; fi
}

case "$CMD" in
  start)
    PORT="${2:-7605}"
    LIFE="${3:-7200}"
    if is_running "$PIDFILE"; then
      echo "already running (supervisor pid $(cat "$PIDFILE"))" >&2
      exit 1
    fi
    mkdir -p "$STATE_DIR"
    # setsid: new session, no controlling terminal — survives parent exit and
    # SIGHUP on session teardown. nohup: belt and braces. </dev/null so the
    # child never holds the caller's tty.
    if command -v setsid >/dev/null 2>&1; then
      setsid nohup bash "$HERE/bridge-loop.sh" run "$PORT" "$LIFE" </dev/null >/dev/null 2>&1 &
    else
      # macOS has no setsid(1); a double-fork via python3 achieves the same.
      nohup python3 -c '
import os, sys
if os.fork() > 0: os._exit(0)
os.setsid()
if os.fork() > 0: os._exit(0)
os.execvp("bash", ["bash", sys.argv[1], "run", sys.argv[2], sys.argv[3]])
' "$HERE/bridge-loop.sh" "$PORT" "$LIFE" </dev/null >/dev/null 2>&1 &
    fi
    # Wait briefly for the supervisor to write its pidfile.
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      [ -f "$PIDFILE" ] && break
      sleep 0.2
    done
    if is_running "$PIDFILE"; then
      echo "started: supervisor pid $(cat "$PIDFILE") (port $PORT, life ${LIFE}s, record=$RECORD)"
      echo "  logs:   $ERRLOG"
      echo "  health: $HEALTH"
    else
      echo "failed to start supervisor; check $ERRLOG" >&2
      exit 1
    fi
    ;;

  run)
    PORT="${2:-7605}"
    LIFE="${3:-7200}"
    mkdir -p "$STATE_DIR"
    echo $$ > "$PIDFILE"
    log "supervisor up (pid $$, port $PORT, life ${LIFE}s, stall ${STALL_MS}ms, rate_min ${RATE_MIN_HZ}Hz, record=$RECORD)"
    trap 'log "supervisor exiting"; rm -f "$PIDFILE" "$CHILD_PIDFILE"' EXIT

    cd "$HERE" || exit 1
    child=""
    backoff=1
    while true; do
      start_ms="$(now_ms)"
      # Simple command via explicit exec in a trap-clean subshell:
      #  - $! is the bridge itself (exec preserves the pid), never a wrapper
      #  - `trap - EXIT` first, because bash 3.2 subshells otherwise inherit
      #    the supervisor's EXIT trap and a failed launch would delete the
      #    pidfiles out from under the running supervisor
      #  - no empty-array expansion ("${arr[@]}" trips set -u on bash 3.2)
      # stdout goes to /dev/null: the sample stream reaches consumers over
      # TCP, and disk recording is opt-in via --record so a blocked/unread
      # pipe can never back up into the SDK thread.
      SELFTEST_ARG=""
      [ "$SELFTEST" = "1" ] && SELFTEST_ARG="--selftest"
      if [ "$RECORD" = "1" ]; then
        ( trap - EXIT; exec env DYLD_LIBRARY_PATH="$HERE/sdk/build" \
          "$BIN" --tcp "$PORT" --seconds "$LIFE" --health "$HEALTH" --record "$NDJSON" $SELFTEST_ARG \
        ) >/dev/null 2>> "$ERRLOG" &
      else
        ( trap - EXIT; exec env DYLD_LIBRARY_PATH="$HERE/sdk/build" \
          "$BIN" --tcp "$PORT" --seconds "$LIFE" --health "$HEALTH" $SELFTEST_ARG \
        ) >/dev/null 2>> "$ERRLOG" &
      fi
      child=$!
      echo "$child" > "$CHILD_PIDFILE"
      raise_priority "$child"

      # Watchdog: poll the health file while the child lives.
      bad_rate_polls=0
      while kill -0 "$child" 2>/dev/null; do
        sleep 2
        kill -0 "$child" 2>/dev/null || break
        now="$(now_ms)"
        mtime="$(file_mtime_ms "$HEALTH")"
        if [ -z "${mtime:-}" ]; then
          # No health file yet: give the child HEALTH_MAX_AGE_MS from start.
          if [ $((now - start_ms)) -gt "$HEALTH_MAX_AGE_MS" ]; then
            log "watchdog: no health file ${HEALTH_MAX_AGE_MS}ms after start; killing pid $child"
            break
          fi
          continue
        fi
        if [ $((now - mtime)) -gt "$HEALTH_MAX_AGE_MS" ]; then
          log "watchdog: health file stale ($(( (now - mtime) / 1000 ))s old); main loop wedged, killing pid $child"
          break
        fi
        sleeping="$(health_field sleeping)"
        [ "${sleeping:-0}" = "1" ] && { bad_rate_polls=0; continue; } # asleep: silence expected
        age="$(health_field last_sample_age_ms)"
        if [ -n "${age:-}" ] && [ "$age" -gt "$STALL_MS" ]; then
          log "watchdog: awake but no samples for ${age}ms (>${STALL_MS}ms); killing pid $child"
          break
        fi
        # Rate-based check: degradation precedes death. Skip during the
        # post-start grace window (device open + IMU ramp-up).
        if [ "$RATE_MIN_HZ" != "0" ] && [ $((now - start_ms)) -gt "$RATE_GRACE_MS" ]; then
          rate="$(health_field rate_hz)"
          if [ -n "${rate:-}" ] && awk "BEGIN{exit !($rate < $RATE_MIN_HZ)}"; then
            bad_rate_polls=$((bad_rate_polls + 1))
            if [ "$bad_rate_polls" -ge "$RATE_BAD_POLLS" ]; then
              log "watchdog: effective rate ${rate}Hz < ${RATE_MIN_HZ}Hz for ${bad_rate_polls} consecutive polls; killing pid $child"
              break
            fi
          else
            bad_rate_polls=0
          fi
        fi
      done

      if kill -0 "$child" 2>/dev/null; then
        kill "$child" 2>/dev/null
        sleep 2
        kill -9 "$child" 2>/dev/null
      fi
      wait "$child" 2>/dev/null
      code=$?
      rm -f "$CHILD_PIDFILE"

      ran_ms=$(( $(now_ms) - start_ms ))
      log "imubridge exited (code $code) after $((ran_ms / 1000))s"
      if [ $((ran_ms / 1000)) -lt "$MIN_RUN" ]; then
        log "fast exit; backing off ${backoff}s"
        sleep "$backoff"
        backoff=$(( backoff * 2 > BACKOFF_MAX ? BACKOFF_MAX : backoff * 2 ))
      else
        backoff=1
        sleep 1
      fi
    done
    ;;

  stop)
    stop_bridge
    ;;

  status)
    ok=1
    if is_running "$PIDFILE"; then
      echo "supervisor: running (pid $(cat "$PIDFILE"))"
    else
      echo "supervisor: NOT running"
      ok=0
    fi
    if is_running "$CHILD_PIDFILE"; then
      echo "imubridge:  running (pid $(cat "$CHILD_PIDFILE"), nice $(ps -o nice= -p "$(cat "$CHILD_PIDFILE")" 2>/dev/null | tr -d ' '))"
    else
      echo "imubridge:  NOT running"
      ok=0
    fi
    if [ -f "$HEALTH" ]; then
      now="$(now_ms)"
      mtime="$(file_mtime_ms "$HEALTH")"
      echo "health:     $(( (now - ${mtime:-now}) / 1000 ))s old — $(cat "$HEALTH")"
    else
      echo "health:     no health file"
    fi
    if [ -f "$NDJSON" ]; then
      echo "recording:  $(wc -l < "$NDJSON" | tr -d ' ') samples in $NDJSON"
    else
      echo "recording:  off (BRIDGE_RECORD=1 to enable)"
    fi
    exit "$((1 - ok))"
    ;;

  *)
    echo "usage: $0 {start|stop|status|run} [tcpPort] [secondsPerInstance]" >&2
    exit 2
    ;;
esac
