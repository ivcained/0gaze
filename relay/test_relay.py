"""Relay test suite: fake HID board + real TCP loopback."""
import asyncio
import struct
import sys
import os

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from hid_transport import HidBoard, BoardUnavailable, REPORT_SIZE
from server import Relay, error_frame, TYPE_CUSTOM, ERR_INTERNAL


class FakeHid:
    """Stands in for hid.device. Echoes a canned response for any frame."""

    def __init__(self, response_body: bytes = b"", writes_to_fail: int = 0):
        self.writes = []
        self._response_body = response_body
        self._writes_to_fail = writes_to_fail

    def write(self, report: bytes):
        if self._writes_to_fail > 0:
            self._writes_to_fail -= 1
            raise OSError("write failed")
        self.writes.append(report)

    def read(self, size: int, timeout_ms: int) -> bytes:
        assert size == 64
        if self._response_body is None:
            return b""
        return self._next_report()

    def _next_report(self):
        if not hasattr(self, "_reports"):
            frame = struct.pack(">I", len(self._response_body)) + self._response_body
            self._reports = [
                frame[off : off + 64].ljust(64, b"\0")
                for off in range(0, max(len(frame), 1), 64)
            ] or [b"\0" * 64]
            self._idx = 0
        if self._idx >= len(self._reports):
            return b"\0" * 64
        r = self._reports[self._idx]
        self._idx += 1
        return r

    def close(self):
        pass


def make_frame(payload: bytes, ty: int = 0x01) -> bytes:
    body = bytes([ty]) + payload
    return struct.pack(">I", len(body)) + body


# ------------------------------------------------------------ HID transport

@pytest.mark.parametrize("size", [1, 63, 64, 65, 128, 129, 256])
def test_write_chunking_and_padding(size):
    resp = b"\x02\xa1\x01\x00"  # type 0x02, cbor {1: 0}
    fake = FakeHid(response_body=resp)
    board = HidBoard(fake)
    frame = make_frame(bytes(range(256))[:size] if size <= 256 else b"", 0x01)
    frame = frame[: 4 + 1 + size]  # exact envelope of 1+size body bytes
    out = board.exchange(frame)

    assert out == resp
    # every write is exactly 65 bytes: report-id 0 + 64 payload bytes
    expected_reports = -(-len(frame) // REPORT_SIZE)
    assert len(fake.writes) == expected_reports
    for w in fake.writes:
        assert len(w) == 65 and w[0] == 0
    # concatenated payloads reproduce the frame (last report zero-padded)
    assert b"".join(w[1:] for w in fake.writes)[: len(frame)] == frame


def test_response_reassembly_across_reports():
    resp_body = bytes([0x02]) + bytes(200)  # type + 200 bytes -> 4 reports
    fake = FakeHid(response_body=resp_body)
    board = HidBoard(fake)
    out = board.exchange(make_frame(b"ping"))
    assert out == resp_body


def test_read_timeout_raises_board_unavailable():
    fake = FakeHid()
    fake._response_body = None  # read() returns b"" forever
    board = HidBoard(fake)
    with pytest.raises(BoardUnavailable):
        board.exchange(make_frame(b"ping"))


def test_write_failure_becomes_transport_error():
    fake = FakeHid(response_body=b"\x02\xa1\x01\x00", writes_to_fail=1)
    board = HidBoard(fake)
    with pytest.raises(BoardUnavailable, match="HID write failed") as exc:
        board.exchange(make_frame(b"ping"))
    assert isinstance(exc.value.__cause__, OSError)


# ------------------------------------------------------------ error frames

def test_error_frame_decodes_with_workshop_decoder():
    """Cross-check our hand-rolled CBOR against the workshop's own decoder."""
    workshop_tools = os.path.expanduser(
        "~/dabao-workshop/ethereum-app/dabao-app-eth-burner/tools"
    )
    sys.path.insert(0, workshop_tools)
    import eth_client  # noqa: E402

    frame = error_frame("relay: board unavailable")
    (n,) = struct.unpack(">I", frame[:4])
    body = frame[4 : 4 + n]
    assert body[0] == TYPE_CUSTOM
    resp, _ = eth_client.cbor_decode(body[1:])
    assert resp == {1: ERR_INTERNAL, 6: "relay: board unavailable"}


def test_error_frame_long_message():
    frame = error_frame("x" * 100)
    (n,) = struct.unpack(">I", frame[:4])
    assert 4 + n == len(frame)


# ------------------------------------------------------------ TCP server

async def _start_server(relay):
    server = await asyncio.start_server(relay.handle, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    return server, port


async def _exchange(port, token, frame):
    r, w = await asyncio.open_connection("127.0.0.1", port)
    w.write(f"AUTH {token}\n".encode())
    await w.drain()
    w.write(frame)
    await w.drain()
    header = await r.readexactly(4)
    (n,) = struct.unpack(">I", header)
    body = await r.readexactly(n)
    w.close()
    return body


@pytest.mark.asyncio
async def test_auth_refusal():
    relay = Relay(token="secret")
    relay._board = HidBoard(FakeHid(response_body=b"\x02\xa1\x01\x00"))
    server, port = await _start_server(relay)
    async with server:
        r, w = await asyncio.open_connection("127.0.0.1", port)
        w.write(b"AUTH wrong\n")
        await w.drain()
        w.write(make_frame(b"\x01"))
        await w.drain()
        with pytest.raises((asyncio.IncompleteReadError, ConnectionError)):
            await r.readexactly(4)


@pytest.mark.asyncio
async def test_concurrent_client_refused():
    relay = Relay(token="secret")
    # a board that never answers, so client 1 holds the lock
    slow = FakeHid()
    slow._response_body = None
    relay._board = HidBoard(slow)
    server, port = await _start_server(relay)
    async with server:
        r1, w1 = await asyncio.open_connection("127.0.0.1", port)
        w1.write(b"AUTH secret\n")
        await w1.drain()
        w1.write(make_frame(b"\x01"))
        await w1.drain()
        await asyncio.sleep(0.1)  # client 1 is inside the exchange

        r2, w2 = await asyncio.open_connection("127.0.0.1", port)
        w2.write(b"AUTH secret\n")
        await w2.drain()
        w2.write(make_frame(b"\x02"))
        await w2.drain()
        with pytest.raises((asyncio.IncompleteReadError, ConnectionError)):
            await r2.readexactly(4)
        w1.close()
        w2.close()


@pytest.mark.asyncio
async def test_board_error_returns_error_frame_not_hang():
    relay = Relay(token="secret")

    class DeadBoard:
        def exchange(self, frame):
            raise BoardUnavailable("gone")

    relay._board = DeadBoard()
    relay._drop_board = lambda: None
    server, port = await _start_server(relay)
    async with server:
        body = await _exchange(port, "secret", make_frame(b"\x01"))
        assert body[0] == TYPE_CUSTOM


@pytest.mark.asyncio
async def test_happy_path_round_trip():
    resp = b"\x02\xa1\x01\x00"
    relay = Relay(token="secret")
    relay._board = HidBoard(FakeHid(response_body=resp))
    server, port = await _start_server(relay)
    async with server:
        body = await _exchange(port, "secret", make_frame(b"\x01"))
        assert body == resp
