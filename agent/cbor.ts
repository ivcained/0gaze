/** Minimal CBOR codec (subset used by the Dabao ERC-4527 protocol). */

export class CborTag {
  constructor(readonly tag: number, readonly value: unknown) {}
}

function head(major: number, n: number): Uint8Array {
  if (n < 24) return new Uint8Array([(major << 5) | n]);
  if (n < 0x100) return new Uint8Array([(major << 5) | 24, n]);
  if (n < 0x10000) {
    const b = new Uint8Array([(major << 5) | 25, n >> 8, n & 0xff]);
    return b;
  }
  if (n < 0x100000000) {
    const b = new Uint8Array([(major << 5) | 26, n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
    return b;
  }
  const b = new Uint8Array(9);
  b[0] = (major << 5) | 27;
  let v = BigInt(n);
  for (let i = 8; i >= 1; i--) { b[i] = Number(v & 0xffn); v >>= 8n; }
  return b;
}

export function cborEncode(v: unknown): Uint8Array {
  if (v === true) return new Uint8Array([0xf5]);
  if (v === false) return new Uint8Array([0xf4]);
  if (v === null) return new Uint8Array([0xf6]);
  if (typeof v === "bigint") return v >= 0n ? head(0, Number(v)) : head(1, Number(-1n - v));
  if (typeof v === "number") {
    if (!Number.isInteger(v)) throw new TypeError("non-integer numbers unsupported");
    return v >= 0 ? head(0, v) : head(1, -1 - v);
  }
  if (v instanceof Uint8Array) {
    const h = head(2, v.length);
    const out = new Uint8Array(h.length + v.length);
    out.set(h); out.set(v, h.length);
    return out;
  }
  if (typeof v === "string") {
    const bytes = new TextEncoder().encode(v);
    const h = head(3, bytes.length);
    const out = new Uint8Array(h.length + bytes.length);
    out.set(h); out.set(bytes, h.length);
    return out;
  }
  if (Array.isArray(v)) {
    const parts = v.map(cborEncode);
    const len = parts.reduce((a, p) => a + p.length, 0);
    const h = head(4, parts.length);
    const out = new Uint8Array(h.length + len);
    out.set(h);
    let o = h.length;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  if (v instanceof CborTag) {
    const h = head(6, v.tag);
    const inner = cborEncode(v.value);
    const out = new Uint8Array(h.length + inner.length);
    out.set(h); out.set(inner, h.length);
    return out;
  }
  if (v instanceof Map) {
    const parts: Uint8Array[] = [];
    for (const [k, val] of v) parts.push(cborEncode(k), cborEncode(val));
    const len = parts.reduce((a, p) => a + p.length, 0);
    const h = head(5, parts.length / 2);
    const out = new Uint8Array(h.length + len);
    out.set(h);
    let o = h.length;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  throw new TypeError(`unsupported CBOR value: ${typeof v}`);
}

export function cborDecode(b: Uint8Array, i = 0): [unknown, number] {
  const ib = b[i];
  const major = ib >> 5, ai = ib & 31;
  i += 1;
  let n: number;
  if (ai < 24) n = ai;
  else {
    const size = ai === 24 ? 1 : ai === 25 ? 2 : ai === 26 ? 4 : 8;
    n = 0;
    for (let k = 0; k < size; k++) n = n * 256 + b[i + k];
    i += size;
  }
  switch (major) {
    case 0: return [n, i];
    case 1: return [-1 - n, i];
    case 2: return [b.slice(i, i + n), i + n];
    case 3: return [new TextDecoder().decode(b.slice(i, i + n)), i + n];
    case 4: {
      const out: unknown[] = [];
      for (let k = 0; k < n; k++) { const [x, j] = cborDecode(b, i); out.push(x); i = j; }
      return [out, i];
    }
    case 5: {
      const out = new Map<unknown, unknown>();
      for (let k = 0; k < n; k++) {
        const [key, j1] = cborDecode(b, i);
        const [val, j2] = cborDecode(b, j1);
        out.set(key, val);
        i = j2;
      }
      return [out, i];
    }
    case 6: {
      const [val, j] = cborDecode(b, i);
      return [new CborTag(n, val), j];
    }
    case 7:
      if (ai === 20) return [false, i];
      if (ai === 21) return [true, i];
      if (ai === 22) return [null, i];
      throw new Error("unsupported CBOR simple value");
    default:
      throw new Error("unreachable");
  }
}
