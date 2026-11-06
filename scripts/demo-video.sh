#!/usr/bin/env bash
# One-command staging for the 0Gaze demo video.
#
#   bash scripts/demo-video.sh          # preflight, start missing services, open windows
#   bash scripts/demo-video.sh --check  # preflight only, touch nothing on screen
#
# What it does:
#   1. Verifies the real hardware path: Dabao HID + relay, glasses IMU bridge.
#   2. Starts anything missing (relay, merchant at 0.10 USDT, glasses UI server).
#   3. Opens the approval UI in an app window sized to the glasses display.
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
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }
warn() { printf '  \033[33mWARN\033[0m  %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAILURES=$((FAILURES+1)); }
FAILURES=0

port_up() { lsof -ti :"$1" >/dev/null 2>&1; }

echo "0Gaze demo preflight"

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
else
  if ioreg -p IOUSB 2>/dev/null | grep -qi 'rayneo'; then
    if [ $CHECK_ONLY -eq 1 ]; then warn "glasses attached, bridge not running (will start)"; else
      (cd "$REPO/glasses" && nohup bash bridge-loop.sh $IMU_PORT 7200 > /dev/null 2>&1 &) ; sleep 3
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
    (cd "$REPO/merchant" && nohup env $(grep -v '^#' .env | xargs) MERCHANT_PRICE=0.10 npx tsx server.ts > "$LOGDIR/merchant.log" 2>&1 &); sleep 4; }
else
  [ $CHECK_ONLY -eq 1 ] && warn "merchant down (will start at 0.10)" || {
    (cd "$REPO/merchant" && nohup env $(grep -v '^#' .env | xargs) MERCHANT_PRICE=0.10 npx tsx server.ts > "$LOGDIR/merchant.log" 2>&1 &); sleep 4
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

# --- Open the approval UI, sized for the glasses display ------------------------
open -na "Google Chrome" --args --app="http://127.0.0.1:$UI_PORT" --window-size=1470,956 --window-position=0,0

# --- Open the agent loop in a visible Terminal ----------------------------------
sleep 1
osascript <<EOF
tell application "Terminal"
  activate
  do script "cd $REPO/agent && set -a && . ./.secrets/0g-wallet.env && set +a && npx tsx run-live.ts --glasses-ui=ws://127.0.0.1:$UI_PORT/ws --sequence=$SEQUENCE --glasses-ui-timeout=120000 $RELAY_PORT \\"$PROMPT\\" 2>&1 | tee $LOGDIR/take-\$(date +%H%M%S).log"
end tell
EOF

cat <<'SHOTS'

Take checklist (record the Mac screen; the glasses mirror it):
  1. Idle glasses UI + Terminal — "the agent is thinking, the wearer sees nothing yet"
  2. Request card lands: 0.10 USDT — hold still while it arms (say: "it waits for stillness,
     so nodding yes at the card cannot be mistaken for a gesture")
  3. Perform the challenge on camera: look left, bend left (ear toward shoulder), look right
  4. Terminal: "wearer's motion verified" → "asking the Dabao … to sign" → "settled: 0x…"
  5. Open the explorer link for the settlement receipt
  6. Optional denial take: rerun and move the wrong way three times → "Declined, nothing signed"
Narration only, no music. Target 2:45. The script in docs/SUBMISSION.md has the beat timings.
SHOTS
