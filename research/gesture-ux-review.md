# 0Gaze — Gesture Enrollment & Payment-Authorization UX Critique

Reviewer: XR interface architect (spatial UI/UX)
Date: 2026-11-06
Scope: design critique only. Grounded in the measured hardware facts: RayNeo Air 3S Pro, see-through waveguide, 1470x956 @ 120 Hz hardware-mirrored from the Mac, no camera, no controller, no touch, IMU at 496 Hz on TCP 7605, gyro noise floor ~0.6 dps, comfortable casual peak head rotation 66 dps, proximity wearing-state sensor. Segmenter tunables as shipped in `glasses/gestures.ts`: onset 28 dps, offset 12 dps, settle 90 ms, gesture window 130–2600 ms, minimum angle 8°, axis dominance 0.55.

---

## 0. The one fact that shapes everything

The display is a **hardware mirror of the Mac screen**. The wearer sees the entire macOS desktop, not a dedicated XR canvas. Black pixels are transparent; the real world is the background. This means:

- The approval UI **must run fullscreen with a pure black background**, or the wearer is reading payment details overlaid on the builder's desktop wallpaper, browser tabs, and notification banners — which are also, by definition, floating over the real world in front of their face. Every state design below assumes a fullscreen black canvas.
- Privacy ("no screen or bystander ever sees the approval") is only true if the Mac's own display is physically absent or covered. If the Mac screen is live, the glasses show exactly what anyone standing behind the Mac sees. This contradicts the core pitch unless the demo rig runs the Mac headless or with its lid closed / display darkened. **Flag this as a demo-staging requirement, not a UI nicety.**

---

## 1. Is a 3-move challenge the right length?

**Yes — 3 moves is the correct ceiling for the $0.05–$25 tier, and it should be the ceiling, not the floor.**

The math, from the measured numbers:

- Comfortable casual peak rotation: 66 dps. A deliberate, low-effort gesture at 8–15° (just above the 8° minimum) takes roughly 200–600 ms of motion, well inside the 130–2600 ms acceptance window.
- Per-move budget with settle: motion (~0.4 s) + offset detection at 12 dps + 90 ms settle confirmation + reaction time to the next prompt (~0.5–1 s) ≈ **1.2–1.8 s per move**. Three moves ≈ 4–6 s of active capture, which fits comfortably in the 10–15 s sampling window with room for one botched move.
- Four moves pushes toward 8–10 s of continuous deliberate head motion. At that point the wearer is no longer glancing — they are performing. Neck fatigue per attempt is small, but the *social* cost (see §5) scales super-linearly: one or two glances read as "looking at something"; four rhythmic head movements read as "having a moment."

Recommendations, opinionated:

- **Tier the length to the amount.** 2 moves for $0.05–$5, 3 moves for $5–$25, and above $25 keep 3 moves — the added friction there should come from World ID, not from a longer dance. Signal strength comes from the per-person dynamics match (peak rate, duration envelope, smoothness), which the segmenter already measures per gesture; a 4th move adds little discriminative power but doubles the chance of one move failing axis dominance (0.55) and tanking the whole attempt.
- **Cardinals only. Never prompt tilts.** `CARDINALS` already excludes `tiltLeft/tiltRight` — endorse this hard and do not be tempted to "add entropy" with roll gestures. Roll is the slowest, least practiced, most socially conspicuous axis, and at 8° it is the most likely to fall below axis dominance because roll couples into yaw at small angles.
- **Prefer yaw-first sequences.** Left/right turns are the largest comfortable range and the most natural "looking at something" motion. A good challenge generator should open with a yaw move (the easiest, builds confidence) and put the nod last. Avoid two consecutive moves on the same axis in opposite directions (left→right): the return sweep is biomechanically a different motion and pollutes the dynamics signature.
- **Do not accept stitched sequences.** All moves must complete in one continuous capture session (see §4). But do not make the wearer restart from move 1 if move 3 fails — see §4 on retry.

---

## 2. Visual treatment for a 1470x956 see-through waveguide

The rendering model here is **additive light on reality**. Every generic "dark mode" instinct is wrong.

- **Black is free; use it as the canvas.** Pure black pixels show the real world. Fullscreen black canvas, and nothing else on screen.
- **Contrast is against the world, not against a background color.** White text is unreadable against a bright window, a sky, or a lit room — the exact conditions of a demo. Use high-luminance saturated colors that survive bright backgrounds: **green (#00FF66-ish) for normal state, cyan for information, amber for "act now", red for failure**. Green-on-world is the classic see-through HUD choice for a reason: it stays legible across the widest range of real-world luminance. Never render gray — mid-luminance grays wash out into a faint haze.
- **Safe area:** waveguide combiners have their worst color uniformity, glare, and ghosting toward the edges. Keep all critical content inside the **central ~60% of the frame — roughly x 290–1180, y 190–765 of the 1470x956 buffer**. Nothing interactive in the outer 20% ring.
- **Text size:** at a typical ~40–46° horizontal FOV for this class of glasses, 1470 px ≈ 32–36 px/degree. Comfortable reading wants ≥ ~0.3° per character cell, i.e. **~12 px absolute floor and 28–40 px for anything the wearer must read under time pressure**. The amount and the challenge words are the only two things that must be readable at a glance — give them 48 px+. Everything else can be smaller or omitted.
- **Peripheral visibility:** the prompt for the *next* move should sit where the head is already pointing after the previous move — i.e., recentre the UI between moves rather than forcing the wearer to hunt for a fixed widget. A prompt anchored to the world ("look left at the arrow on the left edge") is wrong twice: the edge is in the bad-uniformity zone, and once they look left they've already done half the gesture before reading the instruction. Put the arrow just off-center (~150–250 px from center) so the gesture starts from near-neutral.
- **No fine detail, ever.** No tx hashes, no chain IDs, no 8-decimal amounts on the capture screen. "0.10 USDT → 0G inference" is the whole payload. The full details belong in the pre-capture review state (§3) where there is no time pressure.
- **120 Hz is wasted on this UI — except for the live feedback meter.** The live rate indicator (driven by `liveRate`, 120 ms window) is the one element where latency is felt; render it every frame. Everything else can update at 10 Hz.

---

## 3. Progress and failure with no controller and no touch

There is exactly one input channel: head rotation, sampled at 496 Hz, with a noise floor of 0.6 dps against an onset threshold of 28 dps — a healthy ~33 dB of separation, so detection reliability is not the problem. The problems are **mode confusion** and **dead ends**.

Rules:

- **Two mutually exclusive modes, visually unmistakable.** *Dwell mode* (head = pointer; look at a target for ~800 ms to select it) and *capture mode* (head = signature; any onset ≥ 28 dps is a gesture). Never blend them. Dwell mode gets a visible cursor dot that follows head yaw/pitch; capture mode removes the cursor entirely so the wearer stops trying to "aim." The transition must be explicit — a distinct full-screen color shift (cyan = choosing, amber = performing).
- **Progress = step dots + per-move confirmation, not a progress bar.** Three dots at top-center. Each successful move: dot fills with a satisfying pop and the next direction prompt appears immediately. A continuous progress bar invites the wearer to watch the bar instead of performing the move; discrete dots match the discrete grammar of the challenge.
- **Timeout is the only cancel.** With no buttons, "do nothing for 5 s" must cleanly exit capture mode back to the request card. State this on screen: *"Hold still to cancel."* This doubles as a safety valve for the social-embarrassment case — freezing is always socially available.
- **Failure feedback must be diagnostic, not just red.** The segmenter gives you *why*: too slow (never hit 28 dps onset), too fast/jerky (low smoothness), wrong axis (dominance < 0.55), too small (< 8°), too long (> 2600 ms). Map each to one plain instruction: "Bigger turn," "Slower — one smooth sweep," "That was a tilt, turn left instead," "Hold still to finish." "Try again" alone will produce the same failure three times.
- **Never capture during guidance.** This is the single highest-value rule in this document. While instructions are on screen, the wearer *will* nod, tilt to read, and glance at arrows — all above 28 dps. Guidance and capture must be separated by an explicit "ready" beat (dwell on a target, or a 1.5 s hold-still countdown confirmed by the offset/settle detector). See §6, misread #2.

---

## 4. The six states

All states render on the fullscreen black canvas, central safe area, green/cyan/amber/red palette.

**1. Idle.**
Nothing, or a single small dim-green dot at center confirming the glasses are live (driven by the proximity wearing-state sensor). The real world is the UI. If the glasses are on but no agent is connected, one line: "Agent offline" — do not render an idle desktop mirror of anything else.

**2. Request arrives.**
Amber card, no countdown yet. Amount large (48 px+), recipient and purpose in one line: "**0.10 USDT** — pay 0G for inference." Below: the tier-appropriate action line — "2 moves to approve" — and two dwell targets: **Approve** (center-left) / **Dismiss** (center-right). Request does not auto-start; an agent payment demand must never hijack the wearer's attention mid-crossing-the-street. If the proximity sensor says the glasses were just put on, delay the card ~2 s — IMU stream and wearer both need a moment to settle.

**3. Guidance.**
Cyan. Shows the full sequence as icons, not one at a time: `←   ↑   ←` with a legend ("look left, then up, then left"). Then the explicit arming beat: "Hold still… 2… 1…" using the settle detector (rate < 12 dps for 90 ms) as the actual trigger, not a blind timer — the countdown should *verify* stillness and restart if the wearer moves.

**4. Live capture.**
Amber. Full sequence icons stay on screen, current move highlighted and enlarged just off-center toward the neutral position (per §2). Step dots at top. Live rate meter as a thin arc at the bottom of the safe area — it confirms "the glasses can feel you" and is the single best defense against the wearer thinking the system is frozen. Capture ends on the third settled gesture or on 5 s of stillness (cancel).

**5. Success.**
Green flash, checkmark, one line: "Signed. 0.10 USDT → 0G." Auto-dismiss in ~1.5 s. No dwell target required — success should never demand another gesture. The Dabao signature and facilitator settlement can lag; the UI should say "approved" on gate pass and let settlement confirm asynchronously (a tiny persistent dot can flip green when the tx lands). Do not hold the wearer in a loading state for a network round trip.

**6. Failure and retry.**
Red, one diagnostic line from §3's mapping ("Too fast — one smooth sweep"), then a branch: **Retry** (dwell, re-arms guidance) / **Dismiss** (dwell). After the *second* consecutive failure of the same challenge, stop offering retry of that challenge and escalate per §5.

---

## 5. Error recovery: re-ask the same challenge or issue a new one?

**Hybrid, and the rule is simple: user-mechanics failures keep the challenge; signature-mismatch failures rotate it.**

- **Timeout, no-gesture-detected, or cancelled** → re-present the *same* challenge. The wearer learned nothing new about the sequence by failing to start; rotating it forces them to memorize a new sequence for no security gain.
- **Gesture completed but rejected on dynamics (mismatch)** → after the first failure, same challenge (most first failures are execution, not identity). After the **second** failure, issue a **new challenge**. Reason: if the same person fails the same sequence twice, the failure is systematic — that particular combination of directions sits outside their enrolled envelope (e.g. their enrolled "up" is 12° and the challenge is reading 7° against the 8° floor). Repeating it a third time is asking them to fail the same way again; a fresh draw has a real chance of landing inside their envelope. This also caps the embarrassment spiral in public (§6).
- **Third failure total** → stop. Fall to the escalation path that already exists in the design: World ID for the above-cap tier, or "deny + log episode" for mid-tier. This matches the documented posture — a false reject escalates, never blocks forever.
- **Never resume mid-sequence after a failed move.** If move 3 of 3 fails, restart the sequence (same challenge). Accepting a re-done move 3 stitched onto moves 1–2 breaks the "one continuous session" property and trains wearers that they can brute-force one move at a time.

---

## 6. The social-embarrassment problem, and concrete mitigations

Head gestures in public read on a spectrum: a single glance left = normal; three rhythmic turns = conspicuous; a failed third attempt with escalating arm-waving-adjacent head motion = a story someone tells later. Mitigations, in order of value:

1. **Make the gestures small.** The segmenter floor is 8° — that is a glance, not a headbang. *Show* the wearer the expected amplitude during enrollment and during guidance: a small arc, captioned "a glance is enough." Wearers massively over-perform when told to "turn left"; calibrate them down. Small gestures also keep peak rate nearer the comfortable 66 dps band instead of spiking into jerky territory that fails smoothness.
2. **Disguise as natural behavior.** Sequence design should read as ordinary head movement: left→up reads as "checking the room, then the sky." Frame it in the UI as "glance left" not "TURN LEFT." Avoid anything rhythmically regular; avoid tilts entirely (nobody naturally tilts their head 10° in public except at puppies).
3. **"Not now" is a first-class outcome.** The Dismiss dwell target, the 5-second freeze-to-cancel, and a "snooze 10 min" option on the request card. An agent that demands a gesture performance at a bad moment is an agent that gets uninstalled. Every auto-pay under $0.05 already buys goodwill; do not squander it by nagging above the floor.
4. **Bounded attempts, quiet escalation.** Two attempts per challenge, then a new challenge, then World ID / deny (§5). In public, the wearer should know the worst case is "it stops asking and falls back," which the tiering already guarantees.
5. **Amount-aware prompting.** For a $0.10 inference call, 2 small glances. Save the 3-move performance for amounts that justify it. The wearer will forgive conspicuousness at $20 that they will not forgive at $0.10.
6. **Private-mode enrollment warning.** Enrollment is 5+ minutes of repeated deliberate rotation. Tell the wearer plainly: *"Do this at home, alone, with the door closed."* Enrollment is the one phase where embarrassment is unavoidable; move it somewhere it doesn't matter.

---

## 7. What the wearer will misread or fail to do (explicit list)

1. **Nod "yes" at the approval card** — the most predictable failure in the system. The card asks them to approve; nodding is approval in every human culture. If capture is armed when the card appears, the nod becomes move 1 of the challenge and the sequence is poisoned. This is why the arming beat (hold-still countdown) in §4 state 3 is non-negotiable.
2. **Perform the gestures while reading the guidance.** Reading "look left, then up" makes people look left, then up. Guidance must never be live-capture (§3, highest-value rule).
3. **Look at the arrow to check where it points, mid-gesture.** If the direction prompt is placed at the edge, reading it *is* performing the gesture. Place prompts near center (§2).
4. **Confuse screen-left with their left after a turn.** After move 1 ("left"), the whole mirrored UI has rotated relative to the room; the wearer re-reads the card from a turned head and misparses the next arrow. Recentre the UI between moves.
5. **Over-rotate.** Told to "turn left," most people turn 30–45°, blowing past the intended 8–15° band and often exiting the comfortable-rate envelope, which distorts the dynamics signature they enrolled with. Guidance must show amplitude, not just direction (§6.1).
6. **Go too fast.** Under a perceived countdown, people snap. Peak rate spikes well above 66 dps, smoothness drops (sign changes from overshoot correction), gesture rejected. The diagnostic message "Slower — one smooth sweep" exists for exactly this (§3).
7. **Go too slow and stall.** A 5°/s drift never crosses the 28 dps onset; the wearer thinks they're doing move 2 while the system sees nothing. The live rate meter is the fix — if the arc isn't moving, they aren't gesturing.
8. **Tilt instead of turn** (roll contaminating yaw). Below the 0.55 axis-dominance threshold the gesture is discarded as "mixed." This will be the most common mechanical rejection for non-technical wearers. Diagnostic: "That was a tilt, turn your head like shaking 'no.'"
9. **Read top-of-frame text by tilting the head back** during capture, injecting an "up" nod. Another reason critical text lives in the central 60%.
10. **Assume black = broken.** On first use, a fullscreen black canvas with one line of green text reads as "the glasses are off." First-run onboarding needs one beat that demonstrates see-through-by-design ("the screen is clear so you can see the world — UI appears only when needed").
11. **Take the glasses off to "look at the phone" when confused.** Proximity sensor reports not-wearing; any in-flight capture must abort immediately and the request must return to the card state, not fail the challenge. A doffed device mid-capture is a cancel, not a mismatch — never record it as a signature failure.
12. **Expect a sound.** These glasses have speakers, but the brief's flow is silent; a wearer in a quiet room will not know the request arrived without a visual salience pop. Use the amber state-change flash as the "notification sound."

---

## Summary of opinions

- 3 moves is the right maximum; tier it 2/3/3 by amount and never use tilts.
- Fullscreen black canvas, saturated green/cyan/amber/red, central 60% safe area, 28–48 px type, prompts near center, recentre between moves.
- Dwell-to-select and capture are separate, visually unmistakable modes; hold-still is the only cancel.
- Capture is never armed during guidance; an arming countdown gated on the real settle detector (12 dps / 90 ms) is mandatory.
- Retry the same challenge once, rotate on the second dynamics failure, escalate on the third; never stitch partial sequences.
- Treat social cost as a budget: small glances, natural-looking sequences, dismiss/snooze always available, and enrollment explicitly done in private.
- The nod-of-assent at the approval card is the single most dangerous UX bug in this design. Design the state machine so it is impossible to capture it.
