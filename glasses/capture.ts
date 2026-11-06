/**
 * Capture a window of real RayNeo IMU samples from the bridge TCP feed, or
 * from a recorded NDJSON file.
 */
import net from "node:net";
import { readFileSync } from "node:fs";
import type { ImuSample } from "./motion.js";

export interface CaptureOptions {
  tcp?: number;
  host?: string;
  file?: string;
  seconds: number;
  /** Ignore samples below this rate (calibration zeros). */
  minValid?: number;
}

export function readNdjson(path: string): ImuSample[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ImuSample)
    .filter((s) => s.valid === 1);
}

export async function captureWindow(opts: CaptureOptions): Promise<ImuSample[]> {
  if (opts.file) {
    const all = readNdjson(opts.file);
    const start = all[0]?.t ?? 0;
    return all.filter((s) => s.t - start <= opts.seconds * 1000);
  }
  if (!opts.tcp) throw new Error("either --tcp or --file is required");
  const host = opts.host ?? "127.0.0.1";

  return new Promise<ImuSample[]>((resolve, reject) => {
    const samples: ImuSample[] = [];
    let buffer = "";
    let start: number | null = null;
    const socket = net.createConnection({ host, port: opts.tcp! });
    const timer = setTimeout(() => {
      socket.destroy();
      if (samples.length === 0) reject(new Error("no IMU samples arrived"));
      else resolve(samples);
    }, opts.seconds * 1000 + 1500);

    socket.on("connect", () => console.error(`[capture] connected to ${host}:${opts.tcp}`));
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let s: ImuSample;
        try {
          s = JSON.parse(line);
        } catch {
          continue;
        }
        if (s.valid !== 1) continue;
        if (start === null) start = s.t;
        if (s.t - start > opts.seconds * 1000) {
          clearTimeout(timer);
          socket.destroy();
          resolve(samples);
          return;
        }
        samples.push(s);
      }
    });
    socket.on("error", reject);
    socket.on("close", () => {
      clearTimeout(timer);
      if (samples.length > 0) resolve(samples);
    });
  });
}
