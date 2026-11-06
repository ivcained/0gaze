# relay

## Overview

Mac-side bridge that lets network clients (the phone, the S3, test scripts) talk to the Dabao over its USB HID interface. It accepts the burner's length-prefixed envelope protocol over TCP and forwards frames verbatim, so the workshop's `eth_client.py` works against the real board unchanged.

## Interface

- `server.py` - TCP server (default port 7601). Requires a bearer token on connect; refuses concurrent clients. Flags: `--port`, `--token-env`, `--bind`, `--no-auth` (loopback binds only; in this mode the workshop's stock `eth_client.py --tcp` works against the real board unchanged — with auth on, clients send `AUTH <token>` as the first line).
- `hid_transport.py` - `open_board()` (VID 0x1d50 / PID 0x6197), `send(frame)`, `recv()`. 64-byte reports, report-ID 0 prefix, zero padding.
- `test_relay.py` - pytest suite.

## Invariants

- Forward BOTH envelope types: 0x01 (ERC-4527 CBOR) and 0x02 (get-address/get-version).
- One client at a time; a second connection is refused.
- Board errors are converted from hidapi `OSError` into `BoardUnavailable`; the relay drops the stale handle, returns one error frame, and reopens HID for the next request. It never retries a request whose signing outcome became unknown.
- Timeouts: 500 ms per HID report, 5 s per request.

## Side Effects

- USB HID I/O to the Dabao; TCP listener on the LAN interface; reads the bearer token from the environment.

## Verification

- Run: `python3 -m pytest relay/`
