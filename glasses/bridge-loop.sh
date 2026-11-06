#!/usr/bin/env bash
# Supervisor for imubridge.
#
# The RayNeo SDK dies on USB/display renegotiation: the bench log shows a
# notify storm (0xd, then alternating 0x7/0x8) and the process is simply
# gone — no crash report, glasses still enumerated on USB. Whatever kills
# it, this loop brings the bridge back within ~1-2s so calibration captures
# and demo takes survive the blip.
#
#   bash bridge-loop.sh [tcpPort] [secondsPerInstance]
#
# Stop with: pkill -f bridge-loop.sh && pkill -f imubridge
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-7605}"
LIFE="${2:-7200}"
ERRLOG="${BRIDGE_ERRLOG:-/tmp/bridge-loop.err}"

cd "$HERE" || exit 1
echo $$ > /tmp/bridge-loop.pid

while true; do
  DYLD_LIBRARY_PATH="$HERE/sdk/build" ./imubridge --tcp "$PORT" --seconds "$LIFE" >> /tmp/bridge-loop.ndjson 2>>"$ERRLOG"
  code=$?
  echo "$(date '+%H:%M:%S') imubridge exited (code $code); restarting in 1s" >> "$ERRLOG"
  sleep 1
done
