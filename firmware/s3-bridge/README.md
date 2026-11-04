# s3-bridge

## Overview

ESP-IDF firmware turning the XIAO ESP32-S3 into a dumb pipe between the phone (BLE) and the Mac relay (WiFi TCP). No protocol knowledge beyond framing. In the v2 product path the S3 becomes the Dabao's direct USB host (needs a powered hub: the XIAO cannot source 5V VBUS).

## Subdirectories & Boundaries

- main: [./main/README.md](./main/README.md) - application entry, BLE GATT server, WiFi relay client.
