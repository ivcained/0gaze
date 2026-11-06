# 0Gaze — Glasses UI Specification

*The see-through AR approval surface. This document is the complete contract for the Unity implementer.*
*Owner direction: minimal, classic, premium. Calm, certain, quietly premium — never hype.*

---

## 0. Rendering model — read before anything else

The display is an **additive see-through waveguide** (RayNeo Air class). Light adds to the real world; it cannot subtract.

- **Black pixels are transparent.** There is no panel behind content. The real world is the background, always.
- **Fullscreen pure black canvas, always.** Nothing else renders behind or around the approval surface — no desktop mirror, no phone UI, no second window. If the canvas is not fullscreen black, the wearer reads payment details overlaid on whatever else the display is showing.
- **Contrast is against the world, not against a background.** A bright window, a sky, a lit room is the worst case. Every mark must survive daylight.
- **Nothing below ~30% luminance renders.** Mid-greys and hairlines dissolve into invisible haze. The web brand's muted greys (`#A9AFA2`, `#34382F`) are **banned** on this surface. *(In this document "luminance" means the sRGB dominant-channel value: `#6E6E6E` = 43%, `#A9AFA2` = 68%, the floor is ~30%. It is not WCAG relative luminance — under that measure a mid-grey scores 15.6% and every judgement below would invert. The rule exists because mid-greys read as haze over the real world, whatever their contrast ratio.)*
- **Display buffer: 1470×956, hardware-mirrored from the Mac at 120 Hz.** This is the buffer the rig actually ships; every px value in this document is at 1470×956. (Secondary note: if a future rig drives a native 1920×1080 phone buffer, scale **all** px by **1.130 uniformly** — the y factor, the limiting dimension — about the optical center, then re-run the verification checklist, §7. The extra horizontal real estate becomes margin, not layout. It is not the primary assumption.)

### Safe area

Critical content lives in the **central 60%** of the frame — waveguide edges have the worst uniformity, glare, and ghosting.

```
Safe rect (1470×956): x 294–1176, y 191–765  (882 × 574)
Optical center:       (735, 478)
Nothing interactive, and no text, outside this rect.
```

This is the exact centered central-60% rect: (294 + 1176) / 2 = 735 and (191 + 765) / 2 = 478, so the safe rect and the optical center agree by construction. The measured review (`research/gesture-ux-review.md`) gives the same region rounded outward (x 290–1180, y 190–765); this spec uses the exact rect so that centering math is exact.

### Type scale

| Role | Size | Weight | Notes |
|---|---|---|---|
| Amount / hero | **56 px** | semibold | the one thing that must read at a glance; never below 48 px |
| Current move glyph (arrow) | **72 px** | — | arrow/chevron glyphs, stroke ≥ 6 px |
| Instruction line | **22 px** | regular | one short sentence. This is the number the 1470×956 rebase produced from the 28 px draft; it sits below the 28–40 px comfort band the gesture review measured for time-pressured text, and that is deliberate — the 72 px glyph is what the wearer performs, the line only confirms it. If a future revision has room, raise this line first. |
| Secondary labels | **19 px** | regular | "2 of 3", step captions |
| Tertiary / legal | **15 px** | regular | "practice money only" — **the absolute floor at this buffer; nothing renders below 15 px** |

System font stack (SF Pro / the platform default). No custom display face — premium comes from spacing and hierarchy. No monospace on the glasses: there is never a hash, address, or chain ID on this surface.

---

## 1. Color tokens

The web brand emerald `#0B7C50` and gold `#B78B45` are **too dark for an additive display** — they sit near the dissolve threshold. These are their daylight-surviving adaptations. Hue direction is preserved; luminance is raised hard.

| Token | Hex | Role |
|---|---|---|
| `gaze-emerald` | `#1FE894` | The brand emerald adapted. Presence, success, approved, the live meter fill, idle dot. |
| `treasury-gold` | `#FFC45C` | The brand gold adapted. Attention, approval request, "act now", the current-step outline. Jewelry, not paint: one accent moment per state. |
| `ember-white` | `#F1F3ED` | Primary text and glyphs. Render at 100% for hero text, 78% (`#BCBEB9`-equivalent via alpha 0.78 over black) for secondary. Never below 78% for text. |
| `signal-red` | `#FF4D5E` | Denied, failure, timeout. Diagnostic states only. |
| `guide-cyan` | `#4DD8FF` | Functional mode color for guidance/preview (not a brand color — a "you are in preview, not performing" signal). Never used for money or outcomes. |
| `meter-track` | `#6E6E6E` | Unfilled ring/meter track outline — 43% dominant-channel value, the deliberate margin above the 30% floor so unfilled tracks never read as dead pixels. The one functional grey on this surface. |

Rules:
- One mode color dominates each state (§3 lists it per state). Never mix mode colors in one state.
- No gradients, no glow, no neon bloom, no drop shadows. Flat saturated fills and strokes only.
- Gold appears at most once per state (the request card's amount, or the current-step outline — never both in the same state).

---

## 2. Motion language

The head-motion profile is the presence proof. The gestures are **small glances, not theatrical turns** — the wearer should look like they're checking the room, not performing.

### Vocabulary (cardinals only)

| Move | Glyph | Wearer's motion | Typical amplitude |
|---|---|---|---|
| glance left | `←` | a small look to the left, like checking a door | 8–15° yaw |
| glance right | `→` | a small look to the right | 8–15° yaw |
| glance up | `↑` | a small look up, like checking the sky | 8–15° pitch |

- **No head rolls/tilts, ever.** Roll is slow, conspicuous, and couples into yaw at small angles — the most common mechanical rejection.
- Yaw-first sequences: open with a glance left/right (easiest, builds confidence); put the nod last. Never two consecutive opposite moves on the same axis (left→right) — the return sweep pollutes the dynamics signature.

### Move counts per tier

The three spend tiers are the brand's, not the engine's: **Everyday spends** (below the floor), **Your call** (floor → cap), **A bigger decision** (above the cap, identity check first). The floor is **$0.05** and the cap is **$25** — do not invent a middle boundary.

| Spend tier | Wearer-facing name | Moves |
|---|---|---|
| below $0.05 | Everyday spends | 0 — auto-pay, logged, no card (§3, state 2 note) |
| $0.05 – $25 | Your call | 2 glances |
| above $25 | A bigger decision | 3 glances **+ the identity check** (the added friction comes from the identity check, never a longer dance) |

### The one live meter

Exactly **one** element updates at display refresh rate: a progress **ring** whose fill is driven by live head-rotation rate. It is the proof of presence — "the glasses can feel you" — and the single best defense against the wearer thinking the system froze.

- Ring fills clockwise from 12 o'clock as the current gesture progresses; it snaps to full with a small scale-pop (1.0→1.06→1.0, 180 ms) when the move is accepted.
- **Butt linecaps on the ring stroke.** Round caps leave a false "completed" dot at zero progress.
- The unfilled track uses `meter-track` (§1) with a 3 px stroke so it never reads as dead pixels.
- Everything else on screen updates at ~10 Hz.

---

## 3. State machine

### States

1. `IDLE`
2. `APPROVAL_REQUEST`
3. `PRE_CAPTURE_REVIEW`
4. `GUIDANCE`
5. `STILLNESS_COUNTDOWN`
6. `LIVE_CAPTURE`
7. `APPROVED`
8. `DENIED_WRONG_WEARER`
9. `DENIED_WRONG_DIRECTION`
10. `DENIED_TIMEOUT`
11. `WORLDID_ESCALATION`
12. `OFFLINE_SAFE_STOP`
13. `ENROLLMENT`

### WebSocket contract (agent ↔ app)

| Message | Direction | Payload | Triggers |
|---|---|---|---|
| `approval_request` | agent → app | `{amount, token, chain, purpose, spendTier}` | `IDLE → APPROVAL_REQUEST` |
| `motion_verdict` | app → agent | `{match, score}` | emitted on `LIVE_CAPTURE` completion; `match:true → APPROVED`, `match:false → DENIED_WRONG_WEARER` |
| `worldid_verdict` | agent → app | `{verified \| denied \| expired}` | `WORLDID_ESCALATION → APPROVED` (`verified`) / `→ DENIED_WRONG_WEARER` (`denied`/`expired`) |
| `sign_result` | agent → app | `{signature \| error}` | `APPROVED` confirmation beat (settlement is asynchronous — see state 7) |

Auto-pay (below $0.05) sends **no** `approval_request` to the glasses. Every auto-pay is logged agent-side; the glasses stay in `IDLE`.

### Transition table

| From | Event | To |
|---|---|---|
| `IDLE` | `approval_request` received | `APPROVAL_REQUEST` |
| `IDLE` | WebSocket lost / agent unreachable | `OFFLINE_SAFE_STOP` |
| any state | WebSocket lost | `OFFLINE_SAFE_STOP` (in-flight capture aborts; never recorded as a failure) |
| any state | proximity sensor: not-wearing | `IDLE` (doff = cancel, never a signature failure) |
| `APPROVAL_REQUEST` | wearer dwell-selects **Approve** | `GUIDANCE` |
| `APPROVAL_REQUEST` | wearer dwell-selects **Details** | `PRE_CAPTURE_REVIEW` |
| `APPROVAL_REQUEST` | wearer dwell-selects **Dismiss** / 20 s no input | `IDLE` (denial sent to agent) |
| `PRE_CAPTURE_REVIEW` | dwell **Approve** | `GUIDANCE` |
| `PRE_CAPTURE_REVIEW` | dwell **Back** | `APPROVAL_REQUEST` |
| `GUIDANCE` | guidance shown 2.5 s | `STILLNESS_COUNTDOWN` |
| `STILLNESS_COUNTDOWN` | stillness verified (rate < threshold for 90 ms × countdown) | `LIVE_CAPTURE` |
| `STILLNESS_COUNTDOWN` | motion detected mid-countdown | restart countdown (stay in state) |
| `LIVE_CAPTURE` | all moves accepted | emit `motion_verdict`; `match:true → APPROVED` |
| `LIVE_CAPTURE` | final move wrong direction | `DENIED_WRONG_DIRECTION` |
| `LIVE_CAPTURE` | final move dynamics mismatch | emit `motion_verdict{match:false}`; `DENIED_WRONG_WEARER` |
| `LIVE_CAPTURE` | 5 s stillness / no onset | `DENIED_TIMEOUT` (first timeout re-presents same challenge via `GUIDANCE` on retry) |
| `DENIED_WRONG_DIRECTION` | dwell **Try again** | `GUIDANCE` (same challenge) |
| `DENIED_TIMEOUT` | dwell **Try again** | `GUIDANCE` (same challenge) |
| `DENIED_WRONG_WEARER` | first failure, dwell **Try again** | `GUIDANCE` (same challenge) |
| `DENIED_WRONG_WEARER` | second consecutive failure | rotate challenge; `GUIDANCE` |
| `DENIED_WRONG_WEARER` | third failure total | `WORLDID_ESCALATION` |
| `APPROVAL_REQUEST` (`spendTier: worldid`) | dwell **Continue** | `WORLDID_ESCALATION` (World ID first, then motion) |
| `WORLDID_ESCALATION` | `worldid_verdict: verified` | `GUIDANCE` (motion gate still runs) |
| `WORLDID_ESCALATION` | `worldid_verdict: denied/expired` | `DENIED_WRONG_WEARER` (escalation exhausted — hard stop, no retry) |
| `APPROVED` | 2.0 s elapsed | `IDLE` |
| any DENIED | dwell **Dismiss** | `IDLE` |
| `OFFLINE_SAFE_STOP` | WebSocket restored | `IDLE` |

**Two modes, visually unmistakable.** `APPROVAL_REQUEST` / `PRE_CAPTURE_REVIEW` / DENIED states are *dwell mode*: an 8 px `ember-white` cursor dot follows head yaw/pitch; look at a target for 800 ms to select it. `LIVE_CAPTURE` is *capture mode*: the cursor is removed entirely so the wearer stops trying to aim. The mode switch is signaled by the dominant color change (gold = choosing, emerald ring live = performing). **Capture is never armed during guidance** — the stillness countdown is the only path into capture, so the inevitable nod-of-assent at the approval card can never poison move 1.

---

## 4. Per-state layouts

All coordinates are px in the 1470×956 buffer, origin top-left. Optical center (735, 478). Geometry was rebased from the old 1920×1080 draft with a single uniform scale of 0.766 (1470/1920) about the optical center — x and y are never scaled by different factors, so rings and orbs stay circular. **Composed-block centering rule:** wherever a ring and text appear together, measure the *combined bounds* of ring + text and center that block on (735, 478) — never stack a ring in a tall grid with the instruction appended below (the block rides high with dead space above it).

### State 1 — `IDLE`

Mode color: none. The real world is the UI.

- Optional: one 5 px `gaze-emerald` dot at (735, 478), 40% alpha — "the glasses are live." Driven by the wearing sensor; hidden when doffed.
- If the glasses are on but the agent is disconnected, `OFFLINE_SAFE_STOP` takes over — idle never shows "offline" itself.

### State 2 — `APPROVAL_REQUEST` (dwell mode)

Mode color: `treasury-gold`. Entry: gentle 200 ms fade-in. If the glasses were just put on, delay the card 2 s — wearer and IMU both settle.

```
                                        ┄┄ safe rect ┄┄
        "Your agent asks to spend"            19 px ember-white@78%   y ≈ 355
        $0.10                                 56 px treasury-gold      y ≈ 413  (gold's one moment)
        "to pay for its own thinking"         19 px ember-white        y ≈ 467

   [Approve]            [Details]            [Dismiss]
   dwell targets, 19 px labels inside 153×49 px pill outlines
   Approve: ember-white outline at 100% (the primary — primary-ness carried by
   luminance, not a second gold). Details/Dismiss: ember-white@78% outline.
   centers y ≈ 570, x = 505 / 735 / 965
```

- Purpose string comes from the agent verbatim but is capped at ~40 chars at 19 px; longer purposes live only in `PRE_CAPTURE_REVIEW`.
- No countdown on this state. A payment demand must never hijack attention mid-crossing-the-street; the card waits patiently (20 s no-input → dismiss).
- Below-floor auto-pays never reach this state.
- For an above-cap request (`spendTier: worldid`) the primary target reads **Continue to identity check** instead of **Approve**; gold's one moment is still the amount.

### State 3 — `PRE_CAPTURE_REVIEW` (dwell mode)

Mode color: `ember-white`. The only state where detail is allowed — there is no time pressure here.

- Same layout skeleton as state 2, plus a detail column (left-aligned at x 429, right edge ≤ 1041):
  - Amount in dollars, 48 px, `ember-white` — hero stays readable.
  - Line per fact, 19 px, `ember-white@78%`: "Amount in full: 0.10 USDT" · "Goes to: the thinking service" · "Network: Whitechain test network" · "The chip that holds your money will sign this."
- Footer, 15 px, `ember-white@78%`: "Practice money only — nothing here is real money yet."
- Dwell targets: **Approve** (ember-white outline at 100%) / **Back** (78%). No gold on this state: the mode color here is white, and the amount is not the gold hero. Never a hash, address, or base-unit number anywhere on this screen (§6 — formatting bugs are safety bugs).

### State 4 — `GUIDANCE`

Mode color: `guide-cyan`. Shows the **full sequence first**, as glyphs, so the wearer memorizes before performing. Capture is not armed.

```
        "Three small glances — like checking the room"   22 px ember-white   y ≈ 371

             ←      ↑      ←                            72 px guide-cyan     y ≈ 447
                                                       (2-move tier: two glyphs)

        "A glance is enough — small and easy"            19 px ember-white@78% y ≈ 516
        (small 60° arc icon under the text showing amplitude)
```

- Duration: 2.5 s, then auto-advance to `STILLNESS_COUNTDOWN`. No dwell target — this state is a read-only preview; letting the wearer "skip" it invites them to skip the memorization.
- Sequence glyphs are spaced 138 px apart, centered as one row on x 735.

### State 5 — `STILLNESS_COUNTDOWN`

Mode color: `guide-cyan` → transitions to emerald at the end. The arming beat — the single most important guardrail in the system.

```
        "Now hold still"            22 px ember-white          y ≈ 394

              2                     72 px guide-cyan           y ≈ 478  (counts 2…1…)
```

- The countdown is **gated on the real settle detector**, not a blind timer: the head-rotation rate must stay below the offset threshold for the full beat. If the wearer moves mid-count, the number resets to 2 and the copy stays patient: "Easy — hold still."
- Exit → `LIVE_CAPTURE` with a 120 ms emerald flash on the ring track as the "capture is live" signal.

### State 6 — `LIVE_CAPTURE` (capture mode — no cursor)

Mode color: `gaze-emerald`. The live state. Composed block: ring + current glyph + step counter, centered as ONE block on (735, 478).

```
   step pills:  ●  ○  ○              12 px pills, 74 px spacing     y ≈ 317
                 (completed = filled gaze-emerald;
                  current   = hollow gaze-emerald outline, 3 px stroke;
                  upcoming  = meter-track outline)
                 — a filled current pill reads as "already done"; never fill it early

            ╭──────╮
            │  ←   │      ring: 168 px diameter, 9 px stroke, butt caps
            ╰──────╯      track: meter-track 3 px outline (kept at 3 px —
                          below this the unfilled track reads as dead pixels)
      ring fill = live head-rate, display refresh rate
      current glyph 72 px ember-white INSIDE the ring, offset 0 — the glyph
      is what the wearer performs toward, so it sits at the center of the block

        "Glance left"             22 px ember-white              y ≈ 601
        "2 of 3"                  19 px ember-white@78%          y ≈ 635
        "Hold still to cancel"    15 px ember-white@78%          y ≈ 677
```

- The current glyph sits just off-center toward neutral (the block recenters between moves) so the gesture starts from near-neutral and reading the prompt never *is* performing the gesture.
- Between accepted moves: 150 ms emerald pop on the step pill, block recenters, next glyph appears immediately. Momentum matters — no interstitial screens.
- 5 s of stillness = cancel → `DENIED_TIMEOUT`. Holding still is always socially available; it is the polite escape hatch.

### State 7 — `APPROVED`

Mode color: `gaze-emerald`.

```
              ✓            72 px gaze-emerald, 200 ms draw-on    y ≈ 424
        "Approved — $0.10 for your agent's thinking"
                               22 px ember-white                 y ≈ 493
        "You stay in control." 19 px ember-white@78%             y ≈ 532
```

- **Approve immediately on gate pass. Settlement confirms asynchronously** — a 5 px `gaze-emerald` dot appears at (735, 355) when `sign_result` lands; if it hasn't landed before dismiss, the dot persists into `IDLE` for 10 s. Never hold the wearer in a loading state for a network round trip.
- Success never demands another gesture. Auto-dismiss in 2.0 s → `IDLE`. No dwell targets.

### State 8 — `DENIED_WRONG_WEARER` (dynamics mismatch)

Mode color: `signal-red`, restrained — one red element, not a red screen. No blame, no alarm. The wearer may simply be tired, wearing the glasses differently, or it may genuinely be someone else; the copy must be true for both.

```
        "That didn't move like you"      22 px ember-white         y ≈ 409
        "No money moved."                19 px signal-red          y ≈ 447

   [Try again]                    [Verify it's you]
   dwell targets y ≈ 555, x = 612 / 858
```

- "Verify it's you" → `WORLDID_ESCALATION`. Copy deliberately offers the escape ramp from the first failure — never accuse.
- After the second consecutive failure the challenge rotates silently (new sequence at next `GUIDANCE`). After the third total failure, retry is removed; only "Verify it's you" and "Not now" remain.

### State 9 — `DENIED_WRONG_DIRECTION` (mechanical miss)

Mode color: `signal-red` accent. Diagnostic, one line, mapped to the actual failure:

| Detector reason | On-screen line (22 px, y ≈ 409) |
|---|---|
| wrong direction / tilt instead of turn | "That was a tilt — turn like shaking your head 'no'" |
| too small (below onset) | "A little bigger — one clear glance" |
| too fast / jerky | "Slower — one smooth sweep" |
| too long | "Quicker — a glance, not a stare" |

- Below the line: "No money moved." (19 px, `signal-red`) — always reassure first, instruct second.
- Dwell targets: **Try again** (same challenge) / **Not now**. Never resume mid-sequence; a failed move restarts the sequence from move 1.

### State 10 — `DENIED_TIMEOUT`

Mode color: `ember-white` (not red — a freeze is a choice, not a failure).

```
        "No rush — nothing happened"     22 px ember-white    y ≈ 424
        "No money moved."                19 px ember-white@78% y ≈ 462

   [Try again]      [Not now]           dwell targets y ≈ 539
```

### State 11 — `WORLDID_ESCALATION`

Mode color: `treasury-gold`.

```
        "One more check for a larger amount"   22 px ember-white    y ≈ 394

        [World ID orb glyph: 49 px ring,       y ≈ 478
         treasury-gold outline, hollow]

        "Confirm it's you in the World app.
         Nothing is signed until you do."       19 px ember-white@78% y ≈ 539–570
```

- The app deep-links to the World app; the glasses wait on `worldid_verdict`. While waiting, the state holds with a slow 2 s breathing pulse (alpha 0.6↔1.0) on the orb — the only animation allowed besides the live meter, and it runs at 10 Hz.
- The World app is the one place its proper name is allowed: the wearer has to physically open it, so naming it removes a support call. Everywhere else this is "an identity check".
- **Not now** stays available the whole time the glasses wait on `worldid_verdict`: dwelling it dismisses to `IDLE` and sends the denial to the agent. Nobody is trapped in a wait they cannot leave.
- `expired` verdict: copy swaps to "That check timed out — try again when you're ready." Dwell: **Try again** / **Not now**.

### State 12 — `OFFLINE_SAFE_STOP`

Mode color: `treasury-gold`. Glasses-visible, honest, no faked decisions. This is a safety feature, not an error page.

```
        "Your agent is paused"                22 px ember-white    y ≈ 417
        "It can't spend or decide anything
         until it's back."                     19 px ember-white@78% y ≈ 459–490

        ● paused                                15 px treasury-gold  y ≈ 539
```

- Entry: on WebSocket loss, from **any** state. An in-flight capture aborts silently and is **never** recorded as a motion failure; the request returns to the agent as cancelled.
- No dwell targets — nothing to do, and that is the message. The banner persists until the socket restores, then → `IDLE` with a 200 ms fade.
- The agent in safe-stop sends no new requests; if one arrives anyway (race), it is refused unanswered and the banner holds.

### State 13 — `ENROLLMENT` (5-minute passive head recording)

Mode color: `gaze-emerald`. Runs once, on first boot, explicitly in private.

Intro card (dwell mode):

```
        "Teach your glasses how you move"      22 px ember-white    y ≈ 394
        "For five minutes, just wear them and
         move naturally — look around, nod,
         read. There's nothing to perform."     19 px ember-white@78% y ≈ 440–470
        "Do this at home, alone. This is the
         one part you don't want an audience for." 19 px ember-white@78% y ≈ 516–547

   [Begin]                [Later]
```

During recording:

- One live meter ring (the same component as capture — driven by live head rate) at center, with a thin progress arc counting the 5 minutes. Copy: "Learning how you move — 3:12 left" (19 px, updates at 1 Hz).
- The wearer may cancel any time; partial recordings under 3 minutes are discarded with "Not enough yet — we'll finish another time."
- Completion: emerald check, "Done — your glasses know you now." Then the app continues to the World ID link (outside the glasses surface).

---

## 5. Microcopy rules (all states)

- ELI5, always. Never "x402", "EIP-3009", "signer", "facilitator", "gas", "nonce". Say "the chip that holds your money", "your agent", "the thinking service".
- **Vocabulary is owned by `brand/brand-book.md` §2 — that table wins over anything here.** Tiers: **Everyday spends / Your call / A bigger decision**. The motion check: **Head-turn check**. The approval screen: **Approval**. The offline state: **Paused**. World ID: the **identity check** (the World app may be named only where the wearer must physically open it). Engine words (motion gate, signer, facilitator, tier names like `worldid`) are internal — they live in this document's state and message names, never on screen.
- Amounts in dollars, human units: "$0.10", never "100000" or "0.10 USDT" outside the review screen.
- Short warm sentences, one idea per screen, one primary action per state.
- "You stay in control" framing on outcomes. Every **refusal** (wrong wearer, wrong direction) says "No money moved." in `signal-red` under the headline. A **timeout** is not a refusal — nobody was rejected — so it reassures differently: "No rush — nothing happened." with "No money moved." at 78% white, not red.
- Honest about the network: "Practice money only — nothing here is real money yet." on the review screen.
- Never the word "seamlessly". Never hype.

---

## 6. Accessibility & safety

- **Daylight visibility.** All tokens are validated against the worst case (bright sky through the waveguide). Nothing below ~30% dominant-channel value renders (§0 defines the unit); text never below 78% white. If ambient light overwhelms even that, the correct degradation is *fewer, bigger* elements — amount + ring only — never dimmer ones.
- **Timeout defaults.** Request card: 20 s to dismiss. Capture cancel: 5 s stillness. Approved auto-dismiss: 2.0 s. Stillness countdown: motion resets it, forever — there is no "you took too long to be still" failure.
- **No sound assumed.** State-change color flashes are the notification channel (gold flash on request, emerald flash on capture arm).
- **Doff = cancel.** Proximity sensor reporting not-wearing aborts any capture instantly and is never recorded as a failure.
- **Formatting bugs are safety bugs.** An approval screen that renders `100000` instead of `$0.10` is a safety defect on the same tier as a signing bug — the wearer cannot consent to a number they can't read. Amount formatting goes through exactly one code path, unit-tested against base-unit, decimal, and malformed inputs, and the review screen is the only place a raw token amount may appear (and there, in human units with the token name).
- **One idea per screen is a safety property.** A confused wearer holds still — which is cancel — so confusion fails safe.

---

## 7. Verification checklist (run at real buffer size, 1470×956)

1. Every state in §3–§4 screenshotted at the real buffer size, fullscreen black confirmed behind content (no desktop, no second surface).
2. Optical centering **measured, not eyeballed**: for every ring+text state, the composed bounds' centroid is within ±6 px of (735, 478).
3. All critical content inside x 294–1176, y 191–765; nothing interactive outside it.
4. Arrow direction matches instruction text in every challenge draw (`←` = "Glance left", programmatically asserted — a flipped glyph is a safety bug).
5. Step-pill semantics: completed filled, current hollow outline, upcoming dim outline; a screenshot at each step index of a 3-move capture.
6. Ring: butt caps confirmed (screenshot at 0% fill shows **no** dot at 12 o'clock); unfilled track visible at `meter-track`.
7. Exactly one element animating at display refresh (the ring); everything else ≤ 10 Hz (frame-diff two captures 100 ms apart outside the ring region — must be identical).
8. Type sizes measured in the screenshot: amount ≥ 48 px, secondary 19 px, no text below 15 px.
9. Color audit: every rendered element's dominant channel ≥ 30% of full scale (sRGB value, not WCAG relative luminance — see §0), with `meter-track` at 43% and `signal-red` at full red channel both passing. No web-brand grey (`#A9AFA2`, `#34382F`) present anywhere.
10. No hashes, chain IDs, or base-unit amounts on any capture or outcome state (grep the rendered text layer).
11. Mode separation: cursor present in all dwell states, absent in `LIVE_CAPTURE`; capture provably unarmed during `GUIDANCE` (inject a nod during guidance — no move may register).
12. Nod-of-assent test: nod at the approval card, then approve — the sequence must start clean from the stillness countdown.
13. Offline: kill the socket mid-capture — banner appears, capture aborts, no failure is recorded, no fake decision is shown.
14. Daylight pass: all screenshots re-checked against a bright-window real-world backdrop on hardware, not just the bench monitor.

---

## 8. Riskiest implementation details (flagged for the build)

1. **The nod-of-assent race.** The wearer will nod "yes" at the approval card — it is approval in every human culture. If capture is armed even one frame before the stillness countdown gates it, that nod becomes move 1 and the sequence is poisoned. The arming path must be structurally impossible to enter except through a verified stillness beat, and the countdown must re-verify (not assume) stillness on every frame.
2. **Composed-block centering vs. Unity layout groups.** Stacking a ring in a vertical layout group with the instruction appended below produces a block that rides high with dead space above — on a waveguide, that reads as broken, and it pushes the instruction toward the bad-uniformity zone. The implementer must measure the composed bounds of ring + glyph + labels and center *that* rect on (735, 478), not trust a layout container. This is the easiest thing to get subtly wrong and the hardest to notice on a desktop monitor.
3. **Base-unit amount formatting.** The agent sends `{amount}` in base units; the current code divides by 1e6 inline in the card. One missed conversion, one locale decimal separator, one token with different decimals, and the wearer approves a number they cannot parse. On an approval screen this is a safety bug, not a UI bug — the single formatting code path, with unit tests and a rendered-text audit, is non-negotiable.
