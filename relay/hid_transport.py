"""USB HID transport for the Dabao board (VID 0x1d50 / PID 0x6197).

Frames are the burner's envelope: length (u32 BE) || type || message.
The HID layer cuts the frame into 64-byte reports, each written as
report-ID 0 (a leading zero byte) + 64 payload bytes, zero-padded.
Mirrors tools/eth_client.py's HidTransport in the dabao workshop repo.
"""
import struct

VID, PID = 0x1D50, 0x6197
REPORT_SIZE = 64
REPORT_TIMEOUT_MS = 500
REQUEST_TIMEOUT_MS = 5000


class BoardUnavailable(Exception):
    """The board is missing, unplugged mid-frame, or not answering."""


class HidBoard:
    def __init__(self, dev):
        self._dev = dev  # hid.device-like: .write(bytes), .read(n, timeout_ms)

    @classmethod
    def open(cls):
        import hid

        d = hid.device()
        try:
            d.open(VID, PID)
        except OSError as e:
            raise BoardUnavailable(str(e)) from e
        return cls(d)

    def exchange(self, frame: bytes) -> bytes:
        """Send a full envelope (with length prefix); return type||message.

        hidapi reports a physical re-enumeration as ``OSError``. Convert it to
        the transport-level error so the relay can close this handle and open a
        fresh one for the next request. The failed request is never retried:
        after a disconnect its signing outcome is unknown.
        """
        for off in range(0, len(frame), REPORT_SIZE):
            chunk = frame[off : off + REPORT_SIZE].ljust(REPORT_SIZE, b"\0")
            try:
                self._dev.write(b"\0" + chunk)  # report id 0
            except OSError as e:
                raise BoardUnavailable(f"HID write failed: {e}") from e

        first = self._read_report()
        if len(first) < 4:
            raise BoardUnavailable("short first report")
        n = struct.unpack(">I", first[:4])[0]
        if n < 1 or n > 65536:
            raise BoardUnavailable(f"implausible response length {n}")
        buf = bytearray(first)
        import time

        deadline = time.monotonic() + REQUEST_TIMEOUT_MS / 1000
        while len(buf) < 4 + n:
            if time.monotonic() > deadline:
                raise BoardUnavailable("response timed out")
            buf += self._read_report()
        return bytes(buf[4 : 4 + n])

    def _read_report(self) -> bytes:
        try:
            data = bytes(self._dev.read(REPORT_SIZE, REPORT_TIMEOUT_MS))
        except OSError as e:
            raise BoardUnavailable(f"HID read failed: {e}") from e
        if not data:
            raise BoardUnavailable("report read timed out")
        return data

    def close(self):
        try:
            self._dev.close()
        except Exception:
            pass
