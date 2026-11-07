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
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import net from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import { segmentLive, rollBuffer, liveRate, GESTURE, type Gesture, type GyroBias } from "./gestures.js";
import type { ImuSample } from "./motion.js";
import { SessionFlow, labelFor, nextDirection } from "./flow.js";
import { ArmingGate } from "./arming.js";
import { buildSignature, challengeForSpend, describeChallenge, type MotionSignature } from "./signature.js";

const here = dirname(fileURLToPath(import.meta.url));

function arg(name: string, fallback?: string): string | undefined {
  // Accept both "--name value" and "--name=value". The demo script passes
  // --profile=<path>; before this fix the equals form silently parsed as
  // undefined and the take ran UNCALIBRATED (the 23:00 denial).
  const eq = process.argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

const PORT = Number(arg("--port", "7610"));
const IMU_PORT = Number(arg("--imu", "7605"));
const IMU_HOST = arg("--imu-host", "127.0.0.1")!;
const PROFILE = arg("--profile");
const REPLAY = arg("--replay");

/** Samples are segmented in a rolling window; 3.2 s covers the longest
 *  gesture (maxDurationMs 2.6 s) plus settle, so an age trim can never cut
 *  a slow deliberate sweep in half. */
const WINDOW_MS = 3200;

/** What the wearer sees about the payment they are authorizing. */
interface ChallengeSpend {
  id: string;
  amount: string;
  purpose: string;
  chain: string;
}

const flow = new SessionFlow({ repsPerDirection: 4, maxAttempts: 5 });

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
      console.log(`[ui] loaded signature ${raw.signatureHash.slice(0, 12)} (${Object.keys(raw.directions).length} directions, ${Object.keys(raw.vectors ?? {}).length} vectors)`);
    } else {
      console.warn(`[ui] WARNING: ${PROFILE} is not a v1 signature — running UNCALIBRATED`);
    }
  } catch (e) {
    console.warn(`[ui] WARNING: could not load profile ${PROFILE}: ${(e as Error).message} — running UNCALIBRATED`);
  }
} else {
  console.warn("[ui] no --profile given: running UNCALIBRATED (raw direction labels, no envelopes)");
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
    res.end(JSON.stringify({
      ok: true, phase: flow.current.phase, clients: clients.size,
      pageClients: pageClients.size,
      worn: wear.seenPs ? wear.worn : null, ps: Math.round(wear.ps),
      takeRunning: takeChild !== null,
      stream: streamHealth(),
    }));
    return;
  }
  if (url.pathname === "/control") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(readFileSync(join(here, "ui", "control.html")));
    return;
  }
  if (url.pathname === "/api/take" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 4096) req.destroy(); });
    req.on("end", () => {
      let seq = "left";
      try { seq = String((JSON.parse(body || "{}") as { sequence?: string }).sequence ?? "left"); } catch { /* default */ }
      if (!/^[a-zA-Z,]{1,64}$/.test(seq)) seq = "left";
      const r = startTake(seq);
      res.writeHead(r.ok ? 200 : 409, { "content-type": "application/json" });
      res.end(JSON.stringify(r));
    });
    return;
  }
  if (url.pathname === "/api/take/stop" && req.method === "POST") {
    if (takeChild) takeChild.kill("SIGTERM");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404).end("not found");
});

const wss = new WebSocketServer({ server, path: "/ws" });
const clients = new Set<WebSocket>();
/** Browser pages rendering the glasses card (they announce with {type:"ui-page"}). */
const pageClients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: "state", state: publicState() }));
  ws.on("close", () => { clients.delete(ws); pageClients.delete(ws); });
});

function broadcast(msg: unknown): void {
  const data = JSON.stringify(msg);
  for (const c of clients) if (c.readyState === 1) c.send(data);
}

/** Strip server-only fields (salt) before anything leaves this process. */
function stateInner() {
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

/** Public state = flow state + wear flag (null when the feed carries no ps). */
function publicState() {
  return { ...stateInner(), worn: wear.seenPs ? wear.worn : null };
}

/** Handle a completed gesture: advance the flow and notify the UI. */
function onGesture(gesture: Gesture): void {
  if (wearBlocks()) return; // glasses off the head: no motion counts
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
/**
 * Gyro bias persists across windows: a challenge window can be almost all
 * motion with too little stillness to re-estimate, and running on raw rates
 * there integrates drift straight into the angle.
 */
let gyroBias: GyroBias | null = null;
/** Throttle for live window processing (~12 Hz at 496 Hz); starts hot so the first chunk processes immediately. */
let samplesSinceProcess = 40;

/**
 * Live stream-quality telemetry. The 23:00 take lost 27.9% of its IMU samples
 * to >50ms gaps (max 3.6s) under machine load, which fragmented every gesture
 * into 8-22deg spikes and denied the payment. A take must never be rolled on a
 * degraded feed, so measure real delivery continuously and expose it.
 */
const quality = {
  samples: 0, gaps: 0, lostMs: 0, maxGapMs: 0,
  totalGaps: 0, totalLostMs: 0, totalLostPct: 0,
  windowStart: 0, lastT: 0, hz: 0, lostPct: 0,
};
/**
 * Below this the feed is too lossy to classify gestures. lostPct counts only
 * UNBRIDGEABLE loss (gaps > GESTURE.gapBridgeMs): the integrator recovers
 * shorter gaps by holding the last rate, so they cost no accuracy. The failed
 * take lost 27.9% of wall time with holes up to 3.6s — unbridgeable; a clean
 * session loses ~3%, almost all bridged. totalLostPct keeps the raw number
 * for diagnostics.
 */
export const MIN_STREAM_HZ = 350;
const BRIDGE_MS = GESTURE.gapBridgeMs;

function trackQuality(s: ImuSample): void {
  const now = Date.now();
  if (quality.windowStart === 0) { quality.windowStart = now; quality.lastT = s.t; }
  if (quality.lastT) {
    const dt = s.t - quality.lastT;
    if (dt > 50) {
      quality.totalGaps++;
      quality.totalLostMs += dt - 2;
      if (dt > BRIDGE_MS) {
        quality.gaps++;
        quality.lostMs += dt - 2;
        if (dt > quality.maxGapMs) quality.maxGapMs = dt;
      }
    }
  }
  quality.lastT = s.t;
  quality.samples++;
  const spanMs = now - quality.windowStart;
  if (spanMs >= 5000) {
    const spanS = spanMs / 1000;
    quality.hz = quality.samples / spanS;
    quality.lostPct = Math.min(100, (quality.lostMs / 1000 / spanS) * 100);
    quality.totalLostPct = Math.min(100, (quality.totalLostMs / 1000 / spanS) * 100);
    quality.samples = 0; quality.gaps = 0; quality.lostMs = 0; quality.maxGapMs = 0;
    quality.totalLostMs = 0; quality.totalGaps = 0;
    quality.windowStart = now;
  }
}

function streamHealth() {
  return {
    hz: Number(quality.hz.toFixed(1)),
    lostPct: Number(quality.lostPct.toFixed(1)),
    totalLostPct: Number(quality.totalLostPct.toFixed(1)),
    maxGapMs: quality.maxGapMs,
    degraded: quality.hz > 0 && (quality.hz < MIN_STREAM_HZ || quality.lostPct > 8),
    minHz: MIN_STREAM_HZ,
  };
}

// --- wear detection (proximity sensor) ----------------------------------------
// The bridge emits `ps` on every sample: the glasses' proximity sensor (packet
// offset 44 in the Monado-derived RayNeo layout; ~12752 when worn on this unit).
// Hysteresis gate: worn flips ON at >= WEAR_ON and OFF at <= WEAR_OFF. If the
// feed carries no `ps` at all (older bridge), the gate fails OPEN — a demo can
// never brick on a missing field.
const WEAR_ON = Number(process.env.WEAR_ON ?? "3000");
const WEAR_OFF = Number(process.env.WEAR_OFF ?? "1200");
const wear = { ps: 0, worn: true, seenPs: false, lastBroadcast: 0 };
let lastPutonAt = 0;

function trackWear(s: ImuSample): void {
  const ps = (s as unknown as { ps?: number }).ps;
  if (typeof ps !== "number" || !Number.isFinite(ps)) return;
  wear.seenPs = true;
  wear.ps = ps;
  const was = wear.worn;
  if (!wear.worn && ps >= WEAR_ON) wear.worn = true;
  else if (wear.worn && ps <= WEAR_OFF) wear.worn = false;
  const now = Date.now();
  if (wear.worn !== was) {
    console.log(`[ui] wear: ${wear.worn ? "WORN" : "NOT WORN"} (ps=${ps.toFixed(0)})`);
    wear.lastBroadcast = now;
    broadcast({ type: "wear", worn: wear.worn, ps });
    if (!wear.worn) broadcast({ type: "puton" });
  } else if (now - wear.lastBroadcast > 500) {
    wear.lastBroadcast = now;
    broadcast({ type: "wear", worn: wear.worn, ps });
  }
}

/** True when the proximity sensor says the glasses are OFF the head. */
function wearBlocks(): boolean {
  return wear.seenPs && !wear.worn;
}

// --- control panel: spawn the live take from the browser ----------------------
let takeChild: ChildProcess | null = null;

function readAgentEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const p = join(here, "..", "agent", ".secrets", "0g-wallet.env");
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 1) continue;
      const key = t.slice(0, eq).replace(/^export\s+/, "").trim();
      env[key] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch { /* no secrets file: run-live fails loudly in the console pane */ }
  return env;
}

function startTake(sequence: string): { ok: boolean; error?: string } {
  if (takeChild) return { ok: false, error: "a take is already running" };
  // Clear any stale phase (a previous take that timed out mid-challenge).
  flow.reset();
  broadcast({ type: "state", state: publicState() });
  const child = spawn(
    "npx",
    ["tsx", "run-live.ts",
     `--glasses-ui=ws://127.0.0.1:${PORT}/ws`,
     `--sequence=${sequence}`,
     "--glasses-ui-timeout=120000",
     "7601",
     "say one sentence about why private agent payments matter"],
    { cwd: join(here, "..", "agent"), env: { ...process.env, ...readAgentEnv() } },
  );
  takeChild = child;
  broadcast({ type: "take-started", sequence });
  const pipe = (stream: NodeJS.ReadableStream | null) => {
    if (!stream) return;
    let buf = "";
    stream.on("data", (d: Buffer) => {
      buf += d.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        broadcast({ type: "console", line: line.slice(0, 400) });
        const m = line.match(/settled: (0x[0-9a-fA-F]{64})/);
        if (m) {
          broadcast({ type: "settled", txHash: m[1], explorerUrl: `https://explorer.testnet.whitechain.io/tx/${m[1]}` });
        }
      }
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  child.on("exit", (code) => {
    broadcast({ type: "take-done", code });
    takeChild = null;
  });
  return { ok: true };
}
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

  // Streaming-safe segmentation: only gestures CLOSED by a settle period are
  // emitted. The old path force-closed the sweep in progress at the window
  // edge on every tick, so one clean 25° turn was scored as two ~10°
  // fragments — each too small for the envelope, burning attempts and
  // denying honest wearers. The pending sweep stays in the buffer (with a
  // quiet baseline before its onset) and is emitted whole once it settles.
  const seg = segmentLive(buffer, gyroBias);
  if (seg.bias) gyroBias = seg.bias;

  for (const gesture of seg.gestures) onGesture(gesture);
  buffer = rollBuffer(buffer, seg, WINDOW_MS);

  // Drive the arming gate from the same live stream the segmenter sees.
  if (arming && wearBlocks()) {
    // Not worn: capture stays closed; remind the wearer (throttled).
    if (Date.now() - lastPutonAt > 1500) { lastPutonAt = Date.now(); broadcast({ type: "puton" }); }
  } else if (arming) {
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
    let added = 0;
    for (const line of lines) {
      if (!line.trim()) continue;
      let s: ImuSample;
      try { s = JSON.parse(line); } catch { continue; }
      if (s.valid !== 1) continue;
      trackQuality(s);
      trackWear(s);
      buffer.push(s);
      added++;
    }
    if (added === 0) return;
    // One code path for live and replay: processWindow trims, segments,
    // drives the arming gate and broadcasts the level. Throttle to ~12 Hz
    // (every 40 samples at 496 Hz), matching the replay ticker. The live
    // path used to duplicate this logic WITHOUT the arming gate, so on real
    // glasses capture never armed and every gesture was silently ignored
    // as "before_armed" (the 21:21 bench symptom: the rate ring moved but
    // no gesture ever completed).
    samplesSinceProcess += added;
    if (samplesSinceProcess >= 40) {
      samplesSinceProcess = 0;
      processWindow();
    }
  });
  socket.on("error", (e) => done(`unavailable (${e.message})`));
  socket.on("close", () => done("stream closed"));
}

// --- control API (for the demo harness) ---------------------------------------

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    let msg: { type?: string; spendId?: string; sequence?: string[]; action?: string; spend?: ChallengeSpend };
    try { msg = JSON.parse(data.toString()); } catch { return; }

    if (msg.type === "ui-page") { pageClients.add(ws); return; }

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
      const sequence = (msg.sequence as never) ?? challengeForSpend(msg.spendId ?? String(Date.now()), process.env.OGAZE_CHALLENGE_SECRET ?? "0gaze-dev-secret");
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
