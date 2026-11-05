/**
 * Dabao signer client: speaks the burner's ERC-4527 wire protocol over TCP
 * (length u32 BE || type || CBOR), the same framing the emulator exposes on
 * port 7600 and our relay exposes on 7601 for the real chip.
 */
import net from "node:net";
import { cborEncode, cborDecode, CborTag } from "./cbor.js";

const TYPE_ERC4527 = 0x01;
const TYPE_CUSTOM = 0x02;

export const ERRORS: Record<number, string> = {
  1: "user-rejected", 2: "invalid-request", 3: "unsupported", 4: "busy", 5: "internal", 6: "not-ready",
};

export class SignerError extends Error {
  constructor(readonly code: number, message: string) {
    super(`board error ${code} (${ERRORS[code] ?? "?"}): ${message}`);
  }
}

/** m/44'/60'/0'/0/0 -> Tag(304, {1: [44,true,60,true,0,true,0,false,0,false]}) */
export function keypath(path: string): CborTag {
  const comps: (number | boolean)[] = [];
  for (const c of path.split("/").slice(1)) {
    const hardened = c.endsWith("'") || c.endsWith("h");
    comps.push(parseInt(c.replace(/['h]$/, ""), 10), hardened);
  }
  return new CborTag(304, new Map([[1, comps]]));
}

interface Exchange {
  write(frame: Uint8Array): void;
  read(): Promise<Uint8Array>;
}

function tcpExchange(host: string, port: number): Exchange {
  const chunks: Buffer[] = [];
  let waiter: (() => void) | null = null;
  const socket = net.createConnection({ host, port });
  socket.on("data", (d: Buffer) => { chunks.push(d); waiter?.(); });
  return {
    write(frame) { socket.write(Buffer.from(frame)); },
    read() {
      return new Promise((resolve, reject) => {
        const attempt = () => {
          const total = Buffer.concat(chunks);
          if (total.length < 4) return;
          const n = total.readUInt32BE(0);
          if (total.length < 4 + n) return;
          // consume 4+n bytes
          const rest = total.subarray(4 + n);
          chunks.length = 0;
          if (rest.length) chunks.push(rest);
          resolve(new Uint8Array(total.subarray(4, 4 + n)));
        };
        socket.on("error", reject);
        socket.on("close", () => reject(new Error("board closed the connection")));
        waiter = () => { attempt2(); };
        const attempt2 = () => {
          try { attempt(); } catch (e) { reject(e); }
        };
        attempt2();
      });
    },
  };
}

export class DabaoSigner {
  private ex: Exchange | null = null;
  constructor(private host: string, private port: number) {}

  private async connection(): Promise<Exchange> {
    if (!this.ex) this.ex = tcpExchange(this.host, this.port);
    return this.ex;
  }

  private async exchange(type: number, msg: unknown): Promise<{ type: number; body: unknown }> {
    const ex = await this.connection();
    const payload = cborEncode(msg);
    const frame = new Uint8Array(5 + payload.length);
    new DataView(frame.buffer).setUint32(0, payload.length + 1);
    frame[4] = type;
    frame.set(payload, 5);
    ex.write(frame);
    const body = await ex.read();
    const [resp] = cborDecode(body.subarray(1));
    if (body[0] === TYPE_CUSTOM && resp instanceof Map && (resp.get(1) as number) !== 0) {
      throw new SignerError(resp.get(1) as number, String(resp.get(6) ?? ""));
    }
    return { type: body[0], body: resp };
  }

  async getAddress(path = "m/44'/60'/0'/0/0"): Promise<string> {
    const { body } = await this.exchange(TYPE_CUSTOM, new Map<number, unknown>([[1, 1], [2, keypath(path)]]));
    const resp = body as Map<number, unknown>;
    return resp.get(3) as string;
  }

  /** Sign EIP-712 typed data (JSON structure as in the eth_client fixtures). */
  async signTypedData(typedData: unknown, path = "m/44'/60'/0'/0/0"): Promise<Uint8Array> {
    const json = JSON.stringify(typedData);
    const requestId = crypto.getRandomValues(new Uint8Array(16));
    const req = new Map<number, unknown>([
      [1, new CborTag(37, requestId)],
      [2, new TextEncoder().encode(json)],
      [3, 2],
      [5, keypath(path)],
      [7, "eyesonly-agent"],
    ]);
    const { body } = await this.exchange(TYPE_ERC4527, req);
    const resp = body as Map<number, unknown>;
    const rid = resp.get(1);
    if (!(rid instanceof CborTag) || !bytesEqual(rid.value as Uint8Array, requestId)) {
      throw new SignerError(5, "request-id not echoed");
    }
    return resp.get(2) as Uint8Array;
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}
