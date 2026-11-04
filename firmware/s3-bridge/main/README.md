# main

## Overview

Application entry and the two transport halves of the S3 bridge.

## Interface

- `main.c` - app entry: init BLE + WiFi, forwarding loop (GATT write → TCP → GATT notify), reconnect supervision. UART setup command provisions WiFi credentials and relay host:port into NVS.
- `ble_server.c` - GATT server: service UUID base `6e5e0001`, write characteristic `…0002`, notify characteristic `…0003`, MTU 185, 2-byte chunk-length header, bonded peers only.
- `wifi_relay.c` - TCP client to the Mac relay with keepalive; framed send/recv identical to `relay/server.py`, including the bearer token on connect.

## Invariants

- Chunk framing is byte-identical to `app/Assets/Scripts/BleBridge.cs` (2-byte header, MTU 185).
- Only bonded peers may write.
- Never log frame payloads (they may contain payment details).

## Side Effects

- BLE radio, WiFi radio, NVS storage of provisioning data.

## Verification

- Run: `idf.py build`
