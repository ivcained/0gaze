import { describe, it, expect } from "vitest";
import { cborEncode, cborDecode, CborTag } from "./cbor.js";

describe("cbor roundtrip", () => {
  it("roundtrips integers", () => {
    for (const v of [0, 1, 23, 24, 255, 256, 65535, 65536]) {
      const [out] = cborDecode(cborEncode(v));
      expect(out).toBe(v);
    }
  });

  it("roundtrips negative integers", () => {
    for (const v of [-1, -24, -25, -256]) {
      const [out] = cborDecode(cborEncode(v));
      expect(out).toBe(v);
    }
  });

  it("roundtrips strings and bytes", () => {
    expect(cborDecode(cborEncode("Tether USD"))[0]).toBe("Tether USD");
    const b = new Uint8Array([1, 2, 3, 200]);
    const [out] = cborDecode(cborEncode(b));
    expect(out).toEqual(b);
  });

  it("roundtrips booleans and null", () => {
    expect(cborDecode(cborEncode(true))[0]).toBe(true);
    expect(cborDecode(cborEncode(false))[0]).toBe(false);
    expect(cborDecode(cborEncode(null))[0]).toBe(null);
  });

  it("roundtrips arrays and maps", () => {
    const arr = [1, "two", true];
    expect(cborDecode(cborEncode(arr))[0]).toEqual(arr);
    const m = new Map<number, unknown>([[1, "ok"], [2, 5]]);
    const [out] = cborDecode(cborEncode(m));
    expect((out as Map<number, unknown>).get(1)).toBe("ok");
    expect((out as Map<number, unknown>).get(2)).toBe(5);
  });

  it("roundtrips tags (37 request-id, 304 keypath)", () => {
    const t = new CborTag(37, new Uint8Array(16).fill(7));
    const [out] = cborDecode(cborEncode(t));
    expect(out).toBeInstanceOf(CborTag);
    expect((out as CborTag).tag).toBe(37);
    expect((out as CborTag).value).toEqual(new Uint8Array(16).fill(7));

    const kp = new CborTag(304, new Map([[1, [44, true, 60, true, 0, false]]]));
    const [out2] = cborDecode(cborEncode(kp));
    const inner = (out2 as CborTag).value as Map<number, unknown>;
    expect(inner.get(1)).toEqual([44, true, 60, true, 0, false]);
  });
});
