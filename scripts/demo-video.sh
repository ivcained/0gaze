#!/usr/bin/env bash
# One-command staging for the 0Gaze demo video.
#
#   bash scripts/demo-video.sh             # preflight, start missing services, open windows
#   bash scripts/demo-video.sh --check     # preflight only, touch nothing on screen
#   bash scripts/demo-video.sh --extended  # un-mirror the glasses first: the approval UI
#                                          # shows ONLY on the glasses, the Mac keeps the Terminal
#
# What it does:
#   1. Verifies the real hardware path: Dabao HID + relay, glasses IMU bridge.
#   2. Starts anything missing (relay, merchant at 0.10 USDT, glasses UI server).
#   3. Opens the approval UI in an app window sized to the glasses display
#      (placed on the glasses' own origin in --extended mode).
#   4. Opens a Terminal running the agent loop with a fixed head-motion challenge.
#   5. Prints the shot checklist for the take.
set -u

REPO="$HOME/Projects/0gaze"
LOGDIR="$HOME/.hermes/cache/scratch/demo"
PY312="$HOME/dabao-venv312/bin/python"
UI_PORT=7610
RELAY_PORT=7601
MERCHANT_PORT=4021
IMU_PORT=7605
SEQUENCE="left,bendLeft,right"
PROMPT="say one sentence about why private agent payments matter"
mkdir -p "$LOGDIR"

CHECK_ONLY=0
EXTENDED=0
WIN_POS="0,0"
WIN_SIZE="1470,956"
for arg in "$@"; do
  case "$arg" in
    --check) CHECK_ONLY=1 ;;
    --extended) EXTENDED=1 ;;
    *) echo "unknown flag: $arg (usage: demo-video.sh [--check] [--extended])"; exit 2 ;;
  esac
done

ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }
warn() { printf '  \033[33mWARN\033[0m  %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAILURES=$((FAILURES+1)); }
FAILURES=0

port_up() { lsof -ti :"$1" >/dev/null 2>&1; }

echo "0Gaze demo preflight"

# --- Extended mode: glasses become an independent display ---------------------
# The approval UI then shows ONLY on the glasses while the built-in keeps the
# agent Terminal. Un-mirroring renegotiates the display and can wedge the RayNeo
# SDK bridge for a few seconds; the bridge-loop supervisor restarts it.
if [ $EXTENDED -eq 1 ]; then
  echo "extended mode: approval UI will be glasses-only"
  if [ $CHECK_ONLY -eq 0 ]; then
    "$REPO/scripts/glasses-display" extend || warn "glasses-display extend failed"
    sleep 3
    if pgrep -f "bridge-loop|imubridge" >/dev/null 2>&1; then
      for _i in $(seq 1 20); do port_up $IMU_PORT && break; sleep 1; done
    fi
  fi
  if RECT=$("$REPO/scripts/glasses-display" bounds); then
    WIN_POS=$(echo "$RECT" | cut -d, -f1,2)
    WIN_SIZE=$(echo "$RECT" | cut -d, -f3,4)
    ok "glasses extended at rect $RECT (UI window $WIN_SIZE at $WIN_POS)"
  else
    WIN_POS="0,0"
    WIN_SIZE="1470,956"
    if [ $CHECK_ONLY -eq 1 ]; then
      warn "glasses currently mirrored — the run will un-mirror them (scripts/glasses-display extend)"
    else
      fail "glasses not extended (still mirrored or not attached) — scripts/glasses-display extend failed; check the RayNeo cable"
    fi
  fi
fi

# --- Dabao signer -----------------------------------------------------------
if "$PY312" - <<'EOF' 2>/dev/null
import sys, hid
found = any(d.get('vendor_id') == 0x1d50 for d in hid.enumerate())
sys.exit(0 if found else 1)
EOF
then
  ok "Dabao enumerates on USB HID (0x1d50)"
else
  fail "Dabao not on USB HID — plug it in and short-press PROG (do NOT hold PROG; that is the bootloader)"
fi

if port_up $RELAY_PORT; then ok "relay listening on $RELAY_PORT"; else
  if [ $CHECK_ONLY -eq 1 ]; then warn "relay down (will start)"; else
    (cd "$REPO/relay" && nohup "$PY312" -u server.py --no-auth --bind 127.0.0.1 > "$LOGDIR/relay.log" 2>&1 &) ; sleep 2
    port_up $RELAY_PORT && ok "relay started" || fail "relay failed to start (see $LOGDIR/relay.log)"
  fi
fi

# --- Glasses IMU bridge ------------------------------------------------------
if port_up $IMU_PORT; then
  ok "IMU bridge streaming on $IMU_PORT"
elif pgrep -f "bridge-loop" >/dev/null 2>&1; then
  # Supervisor alive but port down (SDK wedged by a display flip or USB blip):
  # give it time to restart instead of racing it with a second supervisor.
  if [ $CHECK_ONLY -eq 1 ]; then
    warn "bridge supervisor restarting (port $IMU_PORT down, will verify)"
  else
    for _i in $(seq 1 15); do port_up $IMU_PORT && break; sleep 1; done
    port_up $IMU_PORT && ok "IMU bridge recovered (supervisor restart)" || fail "bridge supervisor alive but $IMU_PORT down — power-cycle the glasses"
  fi
else
  if ioreg -p IOUSB 2>/dev/null | grep -qi 'rayneo'; then
    if [ $CHECK_ONLY -eq 1 ]; then warn "glasses attached, bridge not running (will start)"; else
      (cd "$REPO/glasses" && nohup bash bridge-loop.sh $IMU_PORT 7200 > /dev/null 2>&1 &) ; sleep 3
      # The TCP listener can take >2s to bind; poll instead of assuming.
      for _i in $(seq 1 15); do port_up $IMU_PORT && break; sleep 1; done
      port_up $IMU_PORT && ok "IMU bridge started (supervised, auto-restarts)" || fail "IMU bridge failed (see /tmp/bridge-loop.err)"
    fi
  else
    fail "glasses not on USB — plug in the RayNeo before recording (no bridge = no real motion)"
  fi
fi

# --- Calibration ----------------------------------------------------------------
if [ -f "$REPO/glasses/signature.json" ]; then
  ok "calibrated signature present (glasses/signature.json)"
else
  warn "no calibration yet — run: cd $REPO/glasses && npx tsx calibrate.ts --tcp $IMU_PORT --out signature.json"
fi

# --- Merchant at the motion-tier price ---------------------------------------
PRICE=$(curl -s -m 3 "http://127.0.0.1:$MERCHANT_PORT/health" | sed -n 's/.*"price":"\([^"]*\)".*/\1/p')
if [ "$PRICE" = "0.10" ]; then
  ok "merchant up at 0.10 USDT (motion tier)"
elif [ -n "$PRICE" ]; then
  warn "merchant up but at $PRICE — restarting at 0.10"
  [ $CHECK_ONLY -eq 0 ] && { kill $(lsof -ti :$MERCHANT_PORT) 2>/dev/null; sleep 1; \
    (cd "$REPO/merchant" && nohup bash -c 'set -a; . ./.env; set +a; MERCHANT_PRICE=0.10 exec npx tsx server.ts' > "$LOGDIR/merchant.log" 2>&1 &); sleep 4; }
else
  [ $CHECK_ONLY -eq 1 ] && warn "merchant down (will start at 0.10)" || {
    (cd "$REPO/merchant" && nohup bash -c 'set -a; . ./.env; set +a; MERCHANT_PRICE=0.10 exec npx tsx server.ts' > "$LOGDIR/merchant.log" 2>&1 &); sleep 4
    curl -s -m 3 "http://127.0.0.1:$MERCHANT_PORT/health" >/dev/null && ok "merchant started at 0.10" || fail "merchant failed to start (see $LOGDIR/merchant.log)"
  }
fi

# --- Glasses UI server --------------------------------------------------------
# Always (re)start the UI server bound to the real IMU port — a stale instance
# pointed at a dead port would never arm capture, and the take would time out.
if [ $CHECK_ONLY -eq 1 ]; then
  port_up $UI_PORT && warn "UI server running (will restart bound to IMU $IMU_PORT)" || warn "UI server down (will start)"
else
  kill $(lsof -ti :$UI_PORT) 2>/dev/null; sleep 1
  PROFILE_ARG=""
  [ -f "$REPO/glasses/signature.json" ] && PROFILE_ARG="--profile=$REPO/glasses/signature.json"
  (cd "$REPO/glasses" && nohup npx tsx ui-server.ts --port $UI_PORT --imu $IMU_PORT $PROFILE_ARG > "$LOGDIR/ui.log" 2>&1 &); sleep 3
  port_up $UI_PORT && ok "UI server (re)started on IMU $IMU_PORT${PROFILE_ARG:+ with calibration}" || fail "UI server failed (see $LOGDIR/ui.log)"
fi

# --- Stream quality gate ------------------------------------------------------
# A take must never be rolled on a degraded feed. The 23:00 take lost 27.9% of
# its IMU samples to >50ms gaps (max 3.6s) under machine load; every gesture
# fragmented into 8-22deg spikes and the payment was denied. Measure the real
# delivery rate before recording anything.
if [ $CHECK_ONLY -eq 0 ]; then
  sleep 7
  QUAL=$(curl -s -m 5 "http://127.0.0.1:$UI_PORT/health")
  HZ=$(printf '%s' "$QUAL" | sed -n 's/.*"hz":\([0-9.]*\).*/\1/p')
  LOST=$(printf '%s' "$QUAL" | sed -n 's/.*"lostPct":\([0-9.]*\).*/\1/p')
  MAXGAP=$(printf '%s' "$QUAL" | sed -n 's/.*"maxGapMs":\([0-9]*\).*/\1/p')
  if [ -n "$HZ" ]; then
    # lostPct is the discriminator, not Hz: the failed take still averaged
    # 405 Hz but lost 27.9% of wall time to gaps, while the clean calibration
    # session lost 3.3%. Gate on both.
    if awk -v h="$HZ" -v l="${LOST:-100}" 'BEGIN{exit !(h>=350 && l<=8)}'; then
      ok "IMU stream ${HZ} Hz, ${LOST}% lost, max gap ${MAXGAP}ms"
    else
      fail "IMU stream DEGRADED: ${HZ} Hz, ${LOST}% lost (need >=350 Hz and <=8% lost), max gap ${MAXGAP}ms"
      echo "        Gestures will fragment and the take will be denied. Before rolling:"
      echo "        close other heavy apps, stop screen recording until the card appears,"
      echo "        and do not record the bridge's NDJSON dump during a take."
    fi
  else
    warn "could not read stream quality from /health"
  fi
fi

# --- Public deployment ---------------------------------------------------------
if curl -s -m 8 -o /dev/null -w '%{http_code}' https://0gaze.tech/generate | grep -q 402; then
  ok "https://0gaze.tech/generate answers 402"
else
  warn "public 402 check did not answer — not required for the bench take"
fi

if [ $FAILURES -gt 0 ]; then
  echo "preflight FAILED ($FAILURES) — fix the items above, then rerun"
  exit 1
fi
echo "preflight passed"

[ $CHECK_ONLY -eq 1 ] && exit 0

# --- Reset the UI flow to idle --------------------------------------------------
node -e '
const WebSocket=require(process.env.HOME+"/Projects/0gaze/glasses/node_modules/ws");
const w=new WebSocket("ws://127.0.0.1:'"$UI_PORT"'/ws");
w.on("open",()=>{w.send(JSON.stringify({type:"reset"}));setTimeout(()=>{w.close();process.exit(0)},400)});
w.on("error",()=>process.exit(0));' 2>/dev/null

# --- Open the approval UI on the glasses display --------------------------------
# Extended: direct Chrome launch with a dedicated profile. `open -na` hands off to a
# running Chrome singleton (pid untrackable) and per-display menu bars leave a 30px
# strip unless the window goes fullscreen. Mirror mode keeps the classic app window.
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ $EXTENDED -eq 1 ]; then
  pkill -f "user-data-dir=$LOGDIR/chrome-glasses-profile" 2>/dev/null; sleep 1
  rm -f "$LOGDIR/chrome-glasses-profile/Singleton"* 2>/dev/null
  "$CHROME" --app="http://127.0.0.1:$UI_PORT" --window-size=$WIN_SIZE --window-position=$WIN_POS \
    --start-fullscreen --user-data-dir="$LOGDIR/chrome-glasses-profile" --no-first-run > "$LOGDIR/chrome-glasses.log" 2>&1 &
  UI_OK=0
  for _i in $(seq 1 10); do
    sleep 2
    "$REPO/scripts/glasses-display" wincheck | grep -q "Google Chrome.*GLASSES" && { UI_OK=1; break; }
  done
  [ $UI_OK -eq 1 ] \
    && ok "approval UI window confirmed on the glasses display (built-in shows none of it)" \
    || warn "no Chrome window detected on the glasses display — see $LOGDIR/chrome-glasses.log and: scripts/glasses-display wincheck"
else
  open -na "Google Chrome" --args --app="http://127.0.0.1:$UI_PORT" --window-size=1470,956 --window-position=0,0
fi

# --- Open the agent loop in a visible Terminal ----------------------------------
sleep 1
osascript <<EOF
tell application "Terminal"
  activate
  do script "cd $REPO/agent && set -a && . ./.secrets/0g-wallet.env && set +a && npx tsx run-live.ts --glasses-ui=ws://127.0.0.1:$UI_PORT/ws --sequence=$SEQUENCE --glasses-ui-timeout=120000 $RELAY_PORT \\"$PROMPT\\" 2>&1 | tee $LOGDIR/take-\$(date +%H%M%S).log"
end tell
EOF

if [ $EXTENDED -eq 1 ]; then
cat <<'HDR'

Take checklist (EXTENDED: the Mac does NOT show the wearer's view):
  Record both surfaces separately, then cut them side-by-side:
    wearer's view:  screencapture -D <glasses activeIndex> -v glasses.mov
    agent view:     screencapture -D 1 -v mac.mov
    (indexes from: scripts/glasses-display info)
HDR
else
cat <<'HDR'

Take checklist (record the Mac screen; the glasses mirror it):
HDR
fi
cat <<'SHOTS'
  1. Idle glasses UI + Terminal — "the agent is thinking, the wearer sees nothing yet"
  2. Request card lands: 0.10 USDT — hold still while it arms (say: "it waits for stillness,
     so nodding yes at the card cannot be mistaken for a gesture")
  3. Perform the challenge on camera: look left, bend left (ear toward shoulder), look right
  4. Terminal: "wearer's motion verified" → "asking the Dabao … to sign" → "settled: 0x…"
  5. Open the explorer link for the settlement receipt
  6. Optional denial take: rerun and move the wrong way three times → "Declined, nothing signed"
Narration only, no music. Target 2:45. The script in docs/SUBMISSION.md has the beat timings.
SHOTS
