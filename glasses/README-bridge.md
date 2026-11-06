# RayNeo IMU bridge — operations guide

`imubridge` streams IMU samples from the RayNeo glasses as NDJSON over a
single-client TCP feed (port 7605 in production). `bridge-loop.sh` is its
supervisor. Both exist because the vendor SDK is not stable enough to run
bare during a demo.

## Root cause of the failed takes (measured 2026-11-07)

`corpus/stream-quality.ts` on `corpus/recording-2026-11-06.ndjson`, scanned in
60s windows over the whole 3h recording:

- **Clean stretches hold 495–500Hz.** The device and USB link are fine.
- **Under demo load the feed collapses.** Worst region: +5443s to +7169s —
  **28 straight minutes at ~19Hz effective, 95% of samples lost**, max gap
  6.4s. Later take regions sit at 290–480Hz with 20–40% of time lost to gaps.
- **19Hz is the smoking gun.** On macOS the SDK worker pumps
  `CFRunLoopRunInMode(..., 0.05, ...)` — one 50ms cycle ≈ 20Hz. An effective
  rate pinned at ~19Hz is the signature of the SDK callback **blocking**, so
  each run-loop cycle processes only one batch of frames. The old `emit()`
  wrote NDJSON to stdout (a ~490MB growing file) and `send()`ed to the TCP
  client **inline on the SDK thread**: a slow disk write or a backpressured
  client stalled USB frame processing directly.
- Consequence (from the take replay): a real 700ms head turn fragments into
  200ms spikes — peak dps survives, integrated angle collapses (13° instead of
  60°), direction classification fails, payment denied. The gesture algorithm
  is fine at 493Hz; the feed was the problem.

## What changed

### 1. The SDK callback thread never blocks (`imubridge.cpp`)

`emit()` on the SDK thread now only formats the line and pushes it onto two
**bounded queues** (4096 lines ≈ 8s, drop-oldest when full — a live gesture
needs the newest sample, not the backlog). Two writer threads drain them:

- **stdout + `--record` file** on one thread. Recording is now **opt-in**
  (`--record PATH`, default OFF) — during a take it is pure load.
- **TCP client** on its own thread, with `TCP_NODELAY` and a 200ms
  `SO_SNDTIMEO`: a stalled client is dropped (it can reconnect — newest
  connection wins) instead of backing up the queue.

Measured with the built-in selftest (synthetic 497Hz through the same code
path, no glasses needed):

| Scenario | rate_hz | result |
|---|---|---|
| Normal, TCP client reading | 497.1 | 0 missing ticks |
| TCP client frozen (`kill -STOP`) | 497.0 | client dropped after send timeout; stdout keeps full rate |
| stdout pipe **full/blocked** 25s | 497.1 | `drops_out` grows (8386), TCP feed complete, 0 missing ticks |
| `--record` to disk | — | 4078/4078 ticks, 0 missing |

Drop counters (`drops_out`, `drops_tcp`, `tcp_timeouts`) are in the health
file, so silent loss is visible.

### 2. Rate-based supervisor watchdog (`bridge-loop.sh`)

Liveness ("process alive, some samples flow") is not sufficient — starvation
shows up as degradation before death. The bridge publishes a 5s trailing
`rate_hz` in the health file (~2×/s, atomic tmp+rename, flat JSON parseable
with grep). The supervisor restarts the bridge when `rate_hz` stays below
**350Hz** for **5 consecutive polls** (~10s), with a 15s post-start grace
window. `sleeping=1` suppresses all rate/stall checks (see notify codes
below). All thresholds are env-tunable: `BRIDGE_RATE_MIN_HZ`,
`BRIDGE_RATE_BAD_POLLS`, `BRIDGE_RATE_GRACE_MS`.

`scripts/demo-video.sh` can preflight the feed by reading the health file:

```bash
grep -o '"rate_hz":[-0-9.]*' /tmp/bridge-loop.health   # want ~490-500
```

### 3. Process priority

The supervisor runs `renice -n -10` on each bridge child. Under demo load
(agent + inference + Chrome + screen recording) a nice-0 bridge is exactly
what starved. **Negative niceness needs root.** If neither plain `renice` nor
`sudo -n renice` succeeds, the supervisor logs a WARNING and runs at nice 0.
To make it stick without interaction, add this once:

```
# /etc/sudoers.d/bridge-renice   (via sudo visudo -f /etc/sudoers.d/bridge-renice)
lc ALL=(ALL) NOPASSWD: /usr/sbin/renice
```

### 4. SDK death mode (the original notify storm)

Bench runs also showed the SDK process vanishing every 30–90 min: stderr ends
with a notify storm (`0xd`, then alternating `0x7`/`0x8`), no macOS crash
report, glasses still enumerated. The codes **are documented** in
`sdk/include/rayneo_api.h` (API minor 2):

| Code  | Enum                   | Meaning                                   |
|-------|------------------------|-------------------------------------------|
| `0x7` | `RAYNEO_NOTIFY_SLEEP`  | Glasses asleep (proximity/display)        |
| `0x8` | `RAYNEO_NOTIFY_WAKE`   | Glasses woke                              |
| `0xd` | `RAYNEO_NOTIFY_IMU_ON` | Firmware acked IMU on                     |
| `0xe` | `RAYNEO_NOTIFY_IMU_OFF`| Firmware turned IMU off                   |

The storm is the glasses flapping sleep↔wake. The SDK has **no keepalive**
(its worker loops only pump USB events), and the firmware does not reliably
resume IMU streaming after a wake — the bridge now handles this internally:
the callback tracks sleep state, and the main loop re-sends `Rayneo_EnableImu`
on every `WAKE` and on any `IMU_OFF` while awake. An in-process stall watchdog
(awake + silent 3s → re-enable; 10s → full SDK teardown/reopen) recovers
stalls that used to need a process restart. The SDK source contains no
`exit`/`abort`/`assert`, so the silent death itself is consistent with an
external signal (SIGHUP/SIGKILL at session teardown) — which is why:

### 5. The supervisor survives its parent

`start` double-forks through `os.setsid()` (macOS has no `setsid(1)`) with
nohup and `</dev/null`: the supervisor is reparented to launchd (verified
PPID 1) and survives the launching shell dying. Pidfiles:
`/tmp/bridge-loop.pid` (supervisor), `/tmp/bridge-loop.child.pid` (bridge).
A child dying within 5s of launch restarts with exponential backoff (1s → 30s
cap) so unplugged-glasses boot loops don't spin.

## Commands

```bash
cd glasses

# build
clang++ -std=c++17 -O2 imubridge.cpp -I sdk/include -L sdk/build \
  -lRayNeoSDK -Wl,-rpath,$PWD/sdk/build -o imubridge

# preflight WITHOUT glasses (synthetic 497Hz through the real pipeline):
BRIDGE_SELFTEST=1 bash bridge-loop.sh start 7605
bash bridge-loop.sh status          # want rate_hz ≈ 497, drops 0

# demo / production (real glasses):
bash bridge-loop.sh start           # port 7605, 2h max per instance

# record a corpus session (opt-in — never during a scored take):
BRIDGE_RECORD=1 bash bridge-loop.sh start   # appends /tmp/bridge-loop.ndjson

# health check (exit 0 iff supervisor + child alive)
bash bridge-loop.sh status

# stop
bash bridge-loop.sh stop

# logs
tail -f /tmp/bridge-loop.err        # notifies, watchdog actions, restarts
cat /tmp/bridge-loop.health         # live: rate_hz, sleeping, drops
```

`ui-server.ts` consumes TCP **7605** — that is the default and the production
path. For any bench testing use a different port plus `BRIDGE_STATE_DIR` so a
test supervisor can never squat on production state:

```bash
BRIDGE_STATE_DIR=/tmp/bridgetest BRIDGE_SELFTEST=1 bash bridge-loop.sh start 7606
```

## Verified vs. not verified

Verified on the bench (no glasses): clean compile; selftest at 497.1Hz with
zero missing ticks over TCP; stalled-TCP and blocked-stdout isolation
(measured above); opt-in recording integrity; supervisor suite — normal
restart, silent-stall kill, wedged-health kill, sleep suppression, sustained
low-rate kill, fast-exit backoff, SIGHUP survival, PPID 1, double-start
refusal, clean stop with no orphans.

**Not verified without hardware:** real sleep/wake notify behavior, IMU
re-arm on wake, and the nudge/reinit path against the actual SDK. When the
glasses come back: `tail -f /tmp/bridge-loop.err` while covering/uncovering
the proximity sensor — expect `notify SLEEP` / `notify WAKE` /
`re-sent IMU enable`, and `rate_hz` in the health file should return to ~497
after each wake without a process restart. Also confirm the one-time sudoers
entry so the renice WARNING disappears.
