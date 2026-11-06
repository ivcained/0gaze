/**
 * Capture every screen of the glasses UI at the real display size (1470x956)
 * by driving the flow over its control socket.
 *
 *   node shots.mjs [outDir]
 */
import puppeteer from "puppeteer-core";
import WebSocket from "ws";
import { mkdirSync } from "node:fs";

const OUT = process.argv[2] ?? "/Users/lc/.hermes/cache/scratch/ui";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--hide-scrollbars", "--force-device-scale-factor=1"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1470, height: 956, deviceScaleFactor: 1 });
await page.goto("http://127.0.0.1:7610/", { waitUntil: "domcontentloaded" });
await new Promise((r) => setTimeout(r, 1200));

const ctl = new WebSocket("ws://127.0.0.1:7610/ws");
await new Promise((r) => ctl.on("open", r));
const send = (m) => ctl.send(JSON.stringify(m));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const m = await page.evaluate(() => {
    const g = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { top: Math.round(r.top), bot: Math.round(r.bottom), h: Math.round(r.height) };
    };
    const dir = document.getElementById("directive");
    const kick = document.getElementById("kicker");
    const hint = document.getElementById("hint");
    return {
      vh: innerHeight,
      compose: g(".compose"),
      arena: g(".arena"),
      ask: g(".ask"),
      text: { kicker: kick?.textContent, directive: dir?.textContent, hint: hint?.textContent },
    };
  });
  console.log(name, JSON.stringify(m));
}

await shot("01-idle");

send({ type: "enroll" });
await wait(500);
await shot("02-enroll");

// Simulate a completed left rep so the check flash and counter are exercised.
await page.evaluate(() => {
  const ev = new CustomEvent("__inject");
  window.dispatchEvent(ev);
});
send({ type: "challenge", spendId: "spend-demo-1" });
await wait(500);
await shot("03-challenge");

ctl.close();
await browser.close();
console.log("wrote screenshots to", OUT);
