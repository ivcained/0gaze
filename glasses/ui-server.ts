/**
 * The glasses UI server: serves the page, bridges the IMU feed to the flow,
 * and pushes state to the browser over WebSocket.
 *
 *   npx tsx ui-server.ts --port 7610 --imu 7605 [--profile sig.json]
 *   npx tsx ui-server.ts --replay capture.ndjson     # loop a recorded capture
 *
 * The page is meant to be opened fullscreen on the RayNeo display.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import net from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import { segmentGestures, liveRate, type Gesture } from "./gestures.js";
import type { ImuSample } from "./motion.js";
import { SessionFlow, labelFor, nextDirection } from "./flow.js";
import { ArmingGate } from "./arming.js";
import { buildSignature, challengeForSpend, describeChallenge, type MotionSignature } from "./signature.js";

const here = dirname(fileURLToPath(import.meta.url));

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

const PORT = Number(arg("--port", "7610"));
const IMU_PORT = Number(arg("--imu", "7605"));
const IMU_HOST = arg("--imu-host", "127.0.0.1")!;
const PROFILE = arg("--profile");
const REPLAY = arg("--replay");

/** Samples are segmented in a rolling window; 2.5 s covers the longest gesture. */
const WINDOW_MS = 2500;

/** What the wearer sees about the payment they are authorizing. */
interface ChallengeSpend {
  id: string;
  amount: string;
  purpose: string;
  chain: string;
}

const flow = new SessionFlow({ repsPerDirection: 4, maxAttempts: 3 });

/**
 * Capture stays closed until the wearer is genuinely still. This is what makes
 * the nod-of-assent impossible: the nod that says "yes" to the request card
 * can never be scored as the first challenge move.
 */
let arming: ArmingGate | null = null;

/** Restore a previously enrolled signature so a demo does not re-enroll. */
if (PROFILE) {
  try {
    const raw = JSON.parse(readFileSync(PROFILE, "utf8"));
    if (raw && raw.version === 1 && raw.directions) {
      flow.takeSignature(raw as MotionSignature);
      console.log(`[ui] loaded signature ${raw.signatureHash.slice(0, 12)} (${Object.keys(raw.directions).length} directions)`);
    }
  } catch (e) {
    console.warn(`[ui] could not load profile: ${(e as Error).message}`);
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(readFileSync(join(here, "ui", "index.html")));
    return;
  }
  if (url.pathname === "/state") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(publicState()));
    return;
  }
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, phase: flow.current.phase, clients: clients.size }));
    return;
  }
  res.writeHead(404).end("not found");
});

const wss = new WebSocketServer({ server, path: "/ws" });
const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: "state", state: publicState() }));
  ws.on("close", () => clients.delete(ws));
});

function broadcast(msg: unknown): void {
  const data = JSON.stringify(msg);
  for (const c of clients) if (c.readyState === 1) c.send(data);
}

/** Strip server-only fields (salt) before anything leaves this process. */
function publicState() {
  const s = flow.current as Record<string, unknown>;
  const armed = flow.captureArmed;
  if (s.phase === "challenge") {
    const { sequence, index, attempts, maxAttempts, spend, lastRejected } = s as unknown as {
      sequence: string[]; index: number; attempts: number; maxAttempts: number;
      spend: Record<string, unknown>; lastRejected: unknown;
    };
    return {
      phase: "challenge",
      sequence,
      goals: describeChallenge(sequence as never),
      index,
      attempts,
      maxAttempts,
      spend,
      lastRejected,
      next: nextDirection(flow.current),
      nextLabel: nextDirection(flow.current) ? labelFor(nextDirection(flow.current)!) : null,
      armed,
    };
  }
  if (s.phase === "enroll") {
    const { direction, rep, repsPerDirection, completed, lastAccepted } = s as unknown as {
      direction: string; rep: number; repsPerDirection: number;
      completed: Record<string, number>; lastAccepted: Gesture | null;
    };
    return {
      phase: "enroll",
      direction,
      rep,
      repsPerDirection,
      completed,
      lastAccepted,
      nextLabel: labelFor(direction as never),
      total: 4 * repsPerDirection,
      done: Object.values(completed).reduce((a, b) => a + b, 0),
      armed,
    };
  }
  if (s.phase === "approved") {
    return {
      phase: "approved",
      sequence: s.sequence,
      spend: s.spend,
      scores: (s.matches as { score: number }[]).map((m) => m.score),
      signatureHash: flow.motionSignature?.signatureHash ?? null,
    };
  }
  if (s.phase === "denied") {
    return { phase: "denied", reason: s.reason, expected: s.expected, spend: s.spend ?? null };
  }
  return { phase: "idle", enrolled: flow.enrolled };
}

/** Handle a completed gesture: advance the flow and notify the UI. */
function onGesture(gesture: Gesture): void {
  const before = flow.current.phase;
  const result = flow.onGesture(gesture);

  // A gesture that lands before the arming gate opens (the nod-of-assent, or
  // an impatient wearer) must never be silently eaten: tell them to hold still.
  if (result.ignored === "before_armed") {
    broadcast({ type: "holdstill" });
    return;
  }

  if (result.enrolled && before === "enroll") {
    const s = flow.current as { captured: Gesture[] };
    const sig = buildSignature(s.captured);
    flow.takeSignature(sig);
    console.log(`[ui] enrolled: ${sig.signatureHash.slice(0, 16)} from ${s.captured.length} gestures`);
    broadcast({ type: "enrolled", signatureHash: sig.signatureHash, commitment: sig.commitment, directions: sig.directions });
    flow.reset();
  }

  broadcast({ type: "gesture", gesture, state: publicState() });

  if (result.approved) {
    console.log("[ui] APPROVED");
    broadcast({ type: "verdict", verdict: "approved", state: publicState() });
  }
  if (result.denied) {
    console.log(`[ui] DENIED (${(flow.current as { reason: string }).reason})`);
    broadcast({ type: "verdict", verdict: "denied", state: publicState() });
  }
}

// --- IMU feed -----------------------------------------------------------------

let buffer: ImuSample[] = [];
let retryTimer: NodeJS.Timeout | null = null;
let connected = false;

/**
 * Reconnect at most once per failure. Scheduling from both 'error' and 'close'
 * doubles the retry rate on every attempt and explodes into an out-of-memory
 * crash within minutes; this guard keeps exactly one timer alive.
 */
function scheduleReconnect(reason: string): void {
  if (retryTimer) return;
  console.warn(`[ui] IMU ${reason}; retrying in 2s`);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    connectImu();
  }, 2000);
}

/**
 * Replay a recorded capture: real samples, real timestamps, looped. Used for
 * demos and for driving the UI without the glasses attached.
 */
function startReplay(path: string): void {
  const all = readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as ImuSample)
    .filter((s) => s.valid === 1);
  if (all.length === 0) throw new Error(`no valid samples in ${path}`);
  console.log(`[ui] replaying ${all.length} samples from ${path}`);

  const span = all[all.length - 1].t - all[0].t;
  let index = 0;
  let offset = 0;
  const tick = () => {
    if (index >= all.length) {
      index = 0;
      offset += span;
    }
    const sample = { ...all[index], t: all[index].t + offset };
    index++;
    buffer.push(sample);
    if (buffer.length === 1 || index % 40 === 0) processWindow();
  };
  // 496 Hz
  setInterval(tick, 1000 / 496);
}

/** Segment the rolling window, advance the flow, broadcast level. */
function processWindow(): void {
  if (buffer.length === 0) return;
  const cutoff = buffer[buffer.length - 1].t - WINDOW_MS;
  let drop = 0;
  while (drop < buffer.length && buffer[drop].t < cutoff) drop++;
  if (drop > 0) buffer = buffer.slice(drop);

  const gestures = segmentGestures(buffer);
  for (const gesture of gestures) onGesture(gesture);
  if (gestures.length > 0) {
    const last = gestures[gestures.length - 1];
    const lastEnd = last.startMs + last.durationMs;
    buffer = buffer.filter((x) => x.t > lastEnd);
  }

  // Drive the arming gate from the same live stream the segmenter sees.
  if (arming) {
    const state = arming.update(buffer, Date.now());
    if (state.armed && !flow.captureArmed) {
      flow.armCapture();
      console.log("[ui] capture armed: the wearer is still and ready");
    }
    broadcast({ type: "arming", arming: state, armed: flow.captureArmed });
    if (state.armed) arming = null;
  }

  broadcast({ type: "level", rate: liveRate(buffer, 140), phase: flow.current.phase });
}

function connectImu(): void {
  if (connected) return;
  connected = true;
  const socket = net.createConnection({ host: IMU_HOST, port: IMU_PORT });
  let raw = "";
  let settled = false;
  const done = (reason: string) => {
    if (settled) return;
    settled = true;
    connected = false;
    socket.destroy();
    scheduleReconnect(reason);
  };

  socket.on("connect", () => console.log(`[ui] IMU connected on ${IMU_HOST}:${IMU_PORT}`));
  socket.on("data", (chunk) => {
    raw += chunk.toString();
    const lines = raw.split("\n");
    raw = lines.pop() ?? "";
    // A runaway producer must not grow this string without bound.
    if (raw.length > 1_000_000) raw = raw.slice(-10_000);
    for (const line of lines) {
      if (!line.trim()) continue;
      let s: ImuSample;
      try { s = JSON.parse(line); } catch { continue; }
      if (s.valid !== 1) continue;
      buffer.push(s);
    }
    if (buffer.length === 0) return;
    const cutoff = buffer[buffer.length - 1].t - WINDOW_MS;
    // Trim without shifting one element at a time.
    let drop = 0;
    while (drop < buffer.length && buffer[drop].t < cutoff) drop++;
    if (drop > 0) buffer = buffer.slice(drop);

    const gestures = segmentGestures(buffer);
    for (const gesture of gestures) onGesture(gesture);
    // Only keep what follows the last gesture so it is not re-reported.
    if (gestures.length > 0) {
      const last = gestures[gestures.length - 1];
      const lastEnd = last.startMs + last.durationMs;
      buffer = buffer.filter((x) => x.t > lastEnd);
    }

    broadcast({ type: "level", rate: liveRate(buffer, 140), phase: flow.current.phase });
  });
  socket.on("error", (e) => done(`unavailable (${e.message})`));
  socket.on("close", () => done("stream closed"));
}

// --- control API (for the demo harness) ---------------------------------------

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    let msg: { type?: string; spendId?: string; sequence?: string[]; action?: string; spend?: ChallengeSpend };
    try { msg = JSON.parse(data.toString()); } catch { return; }

    if (msg.type === "gesture" && (msg as unknown as { gesture?: unknown }).gesture) {
      // Synthetic / test gesture injected over the control socket. Goes
      // through exactly the same flow handler as real hardware motion, so the
      // arming guard applies to it too.
      onGesture((msg as unknown as { gesture: Gesture }).gesture);
      return;
    }
    if (msg.type === "arm") {
      flow.armCapture();
      console.log("[ui] capture armed by the harness");
      broadcast({ type: "state", state: publicState() });
      return;
    }
    if (msg.type === "enroll") {
      flow.startEnrollment();
      arming = new ArmingGate(Date.now());
      console.log("[ui] enrollment started (capture closed until the wearer is still)");
      broadcast({ type: "state", state: publicState() });
    }
    if (msg.type === "challenge") {
      const sequence = (msg.sequence as never) ?? challengeForSpend(msg.spendId ?? String(Date.now()), process.env.EYESONLY_CHALLENGE_SECRET ?? "eyesonly-dev-secret");
      const spend = (msg.spend as ChallengeSpend | undefined) ?? {
        id: msg.spendId ?? "demo",
        amount: "100000",
        purpose: "inference",
        chain: "eip155:1874",
      };
      flow.startChallenge(spend, sequence);
      arming = new ArmingGate(Date.now());
      console.log(`[ui] challenge started: ${describeChallenge(sequence as never).join(" -> ")} for ${spend.amount} base units`);
      broadcast({ type: "state", state: publicState() });
    }
    if (msg.type === "cancel") {
      flow.cancel("wearer_declined");
      broadcast({ type: "state", state: publicState() });
    }
    if (msg.type === "reset") {
      flow.reset();
      broadcast({ type: "state", state: publicState() });
    }
    if (msg.type === "agent-error") {
      // The agent loop failed mid-take: the wearer must see the run stopped
      // (and why) instead of a silent idle card.
      const { stage, message } = msg as unknown as { stage: string; message: string };
      console.warn(`[ui] agent error (${stage}): ${message.split("\n")[0].slice(0, 160)}`);
      broadcast({ type: "agent-error", stage, message: message.split("\n")[0].slice(0, 120) });
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[ui] http://127.0.0.1:${PORT}  (open fullscreen on the glasses display)`);
  if (flow.enrolled) console.log("[ui] a motion signature is already loaded");
  if (REPLAY) {
    startReplay(REPLAY);
  } else {
    connectImu();
  }
});
