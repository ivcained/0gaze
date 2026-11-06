#!/usr/bin/env bash
# Proves the glasses-only approval path end to end, then restores the mirror.
#
#   bash scripts/glasses-only-proof.sh
#
# What it does:
#   1. Refuses to run while a take is live (UI server in an active phase, or run-live running).
#   2. Un-mirrors the glasses (~/bin/glasses-extended) and waits for the IMU bridge to recover.
#   3. Opens a test card on the glasses display ONLY (origin from scripts/glasses-display).
#   4. Screenshots both displays so you can see the card is absent from the built-in.
#   5. Restores the hardware mirror and re-verifies the bridge.
#
# The real take path is: bash scripts/demo-video.sh --extended
set -u

REPO="$HOME/Projects/0gaze"
OUT="$HOME/.hermes/cache/scratch/glasses-proof"
UI_PORT=7610
IMU_PORT=7605
TEST_PORT=8899
mkdir -p "$OUT"
rm -f "$OUT"/*.png "$OUT"/test.html

port_up() { lsof -ti :"$1" >/dev/null 2>&1; }

# --- 1. Live-take guard -------------------------------------------------------
PHASE=$(curl -s -m 2 "http://127.0.0.1:$UI_PORT/state" 2>/dev/null | sed -n 's/.*"phase":"\([a-z]*\)".*/\1/p')
case "$PHASE" in
  challenge|approved|enroll)
    echo "REFUSING: UI server is in live-take phase '$PHASE'. Rerun when the take finishes."
    exit 1 ;;
esac
if pgrep -f "run-live|calibrate.ts" >/dev/null 2>&1; then
  echo "REFUSING: agent or calibration is running. Rerun when the bench is idle."
  exit 1
fi
EPISODES="$REPO/data/episodes.ndjson"
if [ -f "$EPISODES" ]; then
  AGE=$(( $(date +%s) - $(stat -f %m "$EPISODES") ))
  if [ "$AGE" -lt 90 ]; then
    echo "REFUSING: a take finished ${AGE}s ago — the bench worker is likely mid-iteration. Rerun in a minute."
    exit 1
  fi
fi
# Clear a stale terminal card (denied/approved) so the wearer sees idle; same reset demo-video.sh sends.
if [ -n "$PHASE" ] && [ "$PHASE" != "idle" ]; then
  node -e '
const WebSocket=require(process.env.HOME+"/Projects/0gaze/glasses/node_modules/ws");
const w=new WebSocket("ws://127.0.0.1:'"$UI_PORT"'/ws");
w.on("open",()=>{w.send(JSON.stringify({type:"reset"}));setTimeout(()=>{w.close();process.exit(0)},400)});
w.on("error",()=>process.exit(0));' 2>/dev/null
fi
echo "bench idle — proceeding"

# --- 2. Flip to extended ------------------------------------------------------
"$REPO/scripts/glasses-display" extend || { echo "FAIL: could not un-mirror the glasses"; exit 1; }
sleep 3
if pgrep -f "bridge-loop|imubridge" >/dev/null 2>&1; then
  for _i in $(seq 1 20); do port_up $IMU_PORT && break; sleep 1; done
fi
port_up $IMU_PORT && echo "ok: IMU bridge alive on $IMU_PORT after flip" || echo "WARN: bridge down after flip (supervisor may still be restarting)"

INFO=$("$REPO/scripts/glasses-display" info)
echo "$INFO"
RECT=$("$REPO/scripts/glasses-display" bounds) || { echo "FAIL: glasses not extended after extend"; exit 1; }
GPOS=$(echo "$RECT" | cut -d, -f1,2)
GSIZE=$(echo "$RECT" | cut -d, -f3,4)
GLASS_IDX=$(echo "$INFO" | grep external | sed -n 's/.*activeIndex=\([0-9]*\).*/\1/p')
echo "glasses rect: $RECT  (screencapture display index: ${GLASS_IDX:-?})"

# --- 3. Test card on the glasses only -----------------------------------------
cat > "$OUT/test.html" <<'HTML'
<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#000;color:#eaffea;
  font:600 64px/1.2 -apple-system;display:flex;align-items:center;justify-content:center;text-align:center}
small{display:block;font-size:28px;color:#7fbf7f;margin-top:24px}
</style></head><body><div>GLASSES-ONLY TEST CARD<small>0.10 USDT · if you can read this on the Mac, the proof FAILED</small></div></body></html>
HTML
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# Dedicated profile + direct launch: `open -na` hands off to a running Chrome singleton,
# the new pid dies, and placement cannot be verified. --start-fullscreen kills the 30px
# per-display menu-bar strip (window-position alone gets clamped below it).
pkill -f "user-data-dir=$OUT/chrome-profile" 2>/dev/null
pkill -f "http.server $TEST_PORT" 2>/dev/null
rm -f "$OUT/chrome-profile/Singleton"* 2>/dev/null
sleep 1
(cd "$OUT" && python3 -m http.server $TEST_PORT --bind 127.0.0.1 >/dev/null 2>&1 &)
sleep 1
"$CHROME" --app="http://127.0.0.1:$TEST_PORT/test.html" --window-size=$GSIZE --window-position=$GPOS \
  --start-fullscreen --user-data-dir="$OUT/chrome-profile" --no-first-run > "$OUT/chrome.log" 2>&1 &
CPID=$!

# --- 4. Proof: window metadata (no Screen Recording permission needed) -----------
# Poll: the fullscreen-space transition can take several seconds to register.
for _i in $(seq 1 10); do
  sleep 2
  "$REPO/scripts/glasses-display" wincheck > "$OUT/wincheck.txt"
  grep -q "pid=$CPID .*GLASSES" "$OUT/wincheck.txt" && break
done
echo "--- window placement (wincheck) ---"
cat "$OUT/wincheck.txt"
PASS=0
for p in $CPID $(pgrep -f "user-data-dir=$OUT/chrome-profile" 2>/dev/null); do
  grep -q "pid=$p .*GLASSES" "$OUT/wincheck.txt" && PASS=1 && echo "PROOF PASS: test card window (pid $p) covers the GLASSES display only" && break
done
if [ $PASS -eq 0 ]; then
  echo "PROOF FAIL: no test card window found on the glasses display"
  kill -0 "$CPID" 2>/dev/null && echo "chrome.log tail:" && tail -5 "$OUT/chrome.log" || echo "chrome process died; chrome.log tail:" && tail -5 "$OUT/chrome.log"
fi

# --- 4b. Optional screenshots (need Screen Recording permission for the host) ----
if screencapture -x -D 1 "$OUT/display-builtin.png" 2>/dev/null && screencapture -x -D "${GLASS_IDX:-2}" "$OUT/display-glasses.png" 2>/dev/null; then
  ls -la "$OUT"/*.png
else
  rm -f "$OUT"/*.png
  echo "note: screencapture blocked (TCC). Grant Screen Recording to the host terminal app for visual evidence."
fi

# --- 5. Tear down test window, restore mirror ------------------------------------
kill "$CPID" 2>/dev/null
pkill -f "user-data-dir=$OUT/chrome-profile" 2>/dev/null
pkill -f "http.server $TEST_PORT" 2>/dev/null
"$REPO/scripts/glasses-display" mirror
sleep 2
"$REPO/scripts/glasses-display" info
for _i in $(seq 1 20); do port_up $IMU_PORT && break; sleep 1; done
port_up $IMU_PORT && echo "ok: mirror restored, IMU bridge alive" || echo "WARN: mirror restored but bridge down — power-cycle glasses if it stays down"
echo
echo "Evidence: $OUT/wincheck.txt (GLASSES line = card window on the glasses display)"
echo "Next real take: bash scripts/demo-video.sh --extended"
