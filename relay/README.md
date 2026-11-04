# relay

## Overview

Mac-side bridge that lets network clients (the phone, the S3, test scripts) talk to the Dabao over its USB HID interface. It accepts the burner's length-prefixed envelope protocol over TCP and forwards frames verbatim, so the workshop's `eth_client.py` works against the real board unchanged.

## Interface

- `server.py` - TCP server (default port 7601). Requires a bearer token on connect; refuses concurrent clients. Flags: `--port`, `--token-env`, `--bind`.
- `hid_transport.py` - `open_board()` (VID 0x1d50 / PID 0x6197), `send(frame)`, `recv()`. 64-byte reports, report-ID 0 prefix, zero padding.
- `test_relay.py` - pytest suite.

## Invariants

- Forward BOTH envelope types: 0x01 (ERC-4527 CBOR) and 0x02 (get-address/get-version).
- One client at a time; a second connection is refused.
- Board absent or unplugged mid-frame: answer with a type-0x02 error-response (code 5, internal) and keep listening.
- Timeouts: 500 ms per HID report, 5 s per request.

## Side Effects

- USB HID I/O to the Dabao; TCP listener on the LAN interface; reads the bearer token from the environment.

## Verification

- Run: `python3 -m pytest relay/`
