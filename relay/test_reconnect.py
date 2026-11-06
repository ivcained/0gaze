"""Re-enumeration regression: real TCP framing, fault-injected HID only."""
import asyncio
import struct

import pytest

from hid_transport import HidBoard, BoardUnavailable
from server import Relay, error_frame
from test_relay import FakeHid, make_frame, _start_server


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["read", "write", "timeout"])
async def test_reconnect_after_failed_exchange_without_replaying_request(monkeypatch, failure):
    response = b"\x02\xa1\x01\x00"

    class DetachedHid(FakeHid):
        closed = False
        def write(self, report):
            if failure == "write":
                raise OSError("device disconnected")
            return super().write(report)
        def read(self, size, timeout_ms):
            if failure == "timeout":
                return b""
            raise OSError("read error")
        def close(self):
            self.closed = True

    dead = DetachedHid(response)
    fresh = FakeHid(response)
    opened = []

    def open_board():
        opened.append(True)
        return HidBoard(fresh)

    monkeypatch.setattr(HidBoard, "open", open_board)
    relay = Relay(token="secret")
    relay._board = HidBoard(dead)
    server, port = await _start_server(relay)
    async with server:
        reader, writer = await asyncio.open_connection("127.0.0.1", port)
        try:
            writer.write(b"AUTH secret\n")
            await writer.drain()

            async def exchange(payload):
                writer.write(make_frame(payload))
                await writer.drain()
                header = await asyncio.wait_for(reader.readexactly(4), 2)
                size = struct.unpack(">I", header)[0]
                return await asyncio.wait_for(reader.readexactly(size), 2)

            error = await exchange(b"first-request")
            assert error[0] == 2
            assert b"relay:" in error
            assert dead.closed
            assert relay._board is None
            # Never replay a request that may already have reached the signer.
            assert opened == []
            assert fresh.writes == []

            assert await exchange(b"new-request") == response
            assert len(opened) == 1
            written = b"".join(report[1:] for report in fresh.writes)
            assert written.startswith(make_frame(b"new-request"))
            assert b"first-request" not in written
        finally:
            writer.close()
            await writer.wait_closed()
            relay._drop_board()
