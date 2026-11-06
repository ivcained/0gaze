"""0Gaze relay: TCP <-> USB HID bridge for the Dabao.

Accepts the burner's envelope protocol over TCP (the same framing the
emulator exposes on port 7600) and forwards frames verbatim to the real
board over USB HID. Auth: first line must be `AUTH <token>`; the token
comes from the env var named by --token-env (default OGAZE_RELAY_TOKEN).
One client at a time; extra connections are refused.

Board errors are reported to the client as a type-0x02 error-response
(code 5, internal) so stock clients (tools/eth_client.py --tcp) fail
cleanly instead of hanging.
"""
import argparse
import asyncio
import struct
import sys

from hid_transport import HidBoard, BoardUnavailable

TYPE_CUSTOM = 0x02
ERR_INTERNAL = 5


def error_frame(message: str) -> bytes:
    """type-0x02 error-response: {1: 5, 6: message} (status, message)."""
    msg = message.encode()
    # CBOR map(2) { 1: 5, 6: text(msg) }
    if len(msg) < 24:
        body = bytes([0xA2, 0x01, ERR_INTERNAL, 0x06, 0x60 + len(msg)]) + msg
    else:
        body = bytes([0xA2, 0x01, ERR_INTERNAL, 0x06, 0x78, len(msg)]) + msg
    payload = bytes([TYPE_CUSTOM]) + body
    return struct.pack(">I", len(payload)) + payload


class Relay:
    def __init__(self, token: str | None):
        self.token = token
        self._client_lock = asyncio.Lock()
        self._board: HidBoard | None = None

    def _get_board(self) -> HidBoard:
        if self._board is None:
            self._board = HidBoard.open()
        return self._board

    def _drop_board(self):
        if self._board is not None:
            self._board.close()
            self._board = None

    async def handle(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        peer = writer.get_extra_info("peername")
        if self._client_lock.locked():
            print(f"refusing {peer}: a client is already connected")
            writer.close()
            return
        async with self._client_lock:
            try:
                if not await self._auth(reader):
                    print(f"refused {peer}: bad token")
                    writer.close()
                    return
                print(f"client {peer} connected")
                await self._loop(reader, writer)
            except (ConnectionError, asyncio.IncompleteReadError):
                pass
            finally:
                print(f"client {peer} disconnected")
                writer.close()

    async def _auth(self, reader: asyncio.StreamReader) -> bool:
        if self.token is None:  # --no-auth mode, loopback only
            return True
        try:
            line = await asyncio.wait_for(reader.readline(), timeout=3)
        except asyncio.TimeoutError:
            return False
        if len(line) > 4096:
            return False
        return line.decode(errors="replace").strip() == f"AUTH {self.token}"

    async def _loop(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        while True:
            header = await reader.readexactly(4)
            (n,) = struct.unpack(">I", header)
            if n < 1 or n > 65537:
                raise ConnectionError(f"bad frame length {n}")
            body = await reader.readexactly(n)
            frame = header + body
            try:
                resp = await asyncio.to_thread(self._get_board().exchange, frame)
                writer.write(struct.pack(">I", len(resp)) + resp)
            except BoardUnavailable as e:
                print(f"board error: {e}")
                self._drop_board()
                writer.write(error_frame(f"relay: {e}"))
            await writer.drain()


def main():
    ap = argparse.ArgumentParser(description="0Gaze Dabao relay")
    ap.add_argument("--port", type=int, default=7601)
    ap.add_argument("--bind", default="0.0.0.0")
    ap.add_argument("--token-env", default="OGAZE_RELAY_TOKEN")
    ap.add_argument("--no-auth", action="store_true",
                    help="disable the bearer token (loopback binds only, for local dev)")
    args = ap.parse_args()

    import os

    if args.no_auth:
        host = args.bind
        if host not in ("127.0.0.1", "localhost", "::1"):
            print("error: --no-auth requires a loopback --bind", file=sys.stderr)
            sys.exit(2)
        token = None
    else:
        token = os.environ.get(args.token_env)
        if not token:
            print(f"error: env var {args.token_env} is not set", file=sys.stderr)
            sys.exit(2)

    relay = Relay(token)

    async def serve():
        server = await asyncio.start_server(relay.handle, args.bind, args.port)
        print(f"relay listening on {args.bind}:{args.port}")
        async with server:
            await server.serve_forever()

    try:
        asyncio.run(serve())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
