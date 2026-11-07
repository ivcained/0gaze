# 0Gaze — post-hackathon roadmap

Written 2026-11-07, after submission. Three tracks in order: **product → brand → socials.**
Reason for that order: buzz on a product that needs a terminal, four services and a hardware
ritual to demo converts to nothing. Every spike of attention should land on something a
stranger can try.

---

## 0. The decision that shapes everything

Two products are hiding inside 0Gaze. Pick a primary:

**A. The consent device (consumer).** Glasses + chip. The wow, the story, the privacy
differentiator. Costs: hardware partnerships (RayNeo SDK on phone), support burden,
a consumer go-to-market. Slowest to revenue, strongest identity.

**B. The payment rail (developer).** Software only: x402 merchant + facilitator + the
spend-ladder approval gate with a soft-factor interface. Anyone building an agent that
pays can adopt it *without* hardware — the glasses become one approval provider among
several (phone, chip button, glasses). Fastest to launch, real revenue path, and it makes
the hardware story a premium tier instead of a prerequisite.

**Recommendation: B as the product, A as the flagship demo and brand.** Ship the rail
so people can use it this month; keep the glasses as the artifact that makes people look.
The rail is also what sponsors will keep caring about (0G inference billing, Whitechain
settlement) — and it is buildable solo, in weeks, with your skill set.

Single-sentence positioning that works for both:
*"0Gaze gives agents a wallet a human can actually trust: the key stays in hardware, the
approval happens in your own field of view, and every refusal is recorded."*

---

## 1. Product: define "flawless" narrowly, then hit it

Flawless does not mean feature-complete. One bar:

> **A stranger goes from clone to a settled payment without you in the room.**

Today that takes: 4 services, a relay venv, a calibration CLI, a hardware ritual (PROG
press, hub quirks), and knowledge that lives in your head. Ranked work to close it:

1. **`0gaze up` — one command bring-up.** Starts bridge supervisor, relay, merchant, UI;
   prints a single readiness table (chip address, stream Hz, calibration, merchant, live
   402); refuses to start a take if anything is degraded. Today this knowledge is in
   `scripts/demo-video.sh` and in your memorized ritual — move it into the product.
2. **Self-healing hardware.** What we hit live today, made invisible: board in UF2
   bootloader (detect `BAOCHIP` volume → prompt "press PROG"), stale HID handle (already
   auto-recovered — surface it as "reconnecting to chip" not an error), hub power
   (detect no-enumeration → prompt "try a powered port"), glasses asleep (wake hint).
   Every one of these is a known failure with a known fix; encode the fix, not the message.
3. **Guided calibration in the glasses.** Replace the ENTER-press CLI with an on-display
   flow: "look left… good, that's 54° — once more." Two minutes, zero terminal, per wearer.
   This is the single biggest UX gap between demo and product.
4. **Enrollment + multi-wearer.** Signature per wearer, named profiles, a reset path.
   Needed the moment two people touch the same device.
5. **Real World ID credentials.** Register the RP, run one live proof end-to-end. Removes
   the "mocked" caveat from every future pitch and unlocks the escalation tier for real.
6. **Error copy pass.** Every failure says what happened and what to do next (the
   notification layer already does this — extend it to setup/calibration/hardware).
7. **Ledger + limits.** Per-agent spend caps, a balance view, and a "why was this approved"
   record a user can read without the journal.

Definition of done for v0.1: a fresh Mac, a chip, and one `0gaze up` → settled payment in
under 10 minutes, with no step that requires reading source code.

---

## 2. Brand: make the artifact look like the thesis

You already have: emerald `#4CC993`, "Your agent. Your eyes only.", "An agent that spends.
A gaze that doesn't leave you.", the waveguide color story (black is transparent on AR).

Gaps, in order of impact:

1. **One landing page that sells the mechanism, not the tech.** Hero: the head-gesture
   moment (loop of the approval, 6 seconds, no sound needed). Then three proof strips:
   `curl -i https://0gaze.tech/generate` (live 402), the explorer receipt, the 0G
   evidence line. Then "how it works" in four beats. Then one honest limitations block —
   disclosed limits read as confidence.
2. **A mark that survives 16px.** The current brand book defines color and voice; a
   wordmark + glyph (an eye/aperture that reads as a keyhole) is the missing asset.
   One idea: the glyph is the approval ring mid-sweep.
3. **A single demo asset, cut three ways:** 6-second loop (hero/social), 30-second cut
   (X/embeds), 2:50 full (docs/judges). Never re-shoot for a different length.
4. **A docs page that matches the product.** Quickstart, the spend ladder, the security
   model in plain words, and the "what's mocked" table. Developer trust is a brand
   property.
5. **Naming hygiene.** One name everywhere: 0Gaze (`0gaze.tech`), repo `0gaze`, the chip
   as "the chip", the glasses card as "approval". Kill leftover "EyesOnly" references.

---

## 3. Socials: earn attention with artifacts, not scheduling

Cadence: **3 posts a week, each with one idea and one asset.** Not more. Reply-driven
growth beats posting volume for a solo founder.

**The five posts that carry the launch (in order):**

1. **The six-second approval.** Clip only: red lock → glasses on → green check → card →
   look left → settled. Caption: *"This is a wallet approval. No phone, no popup, no
   seed phrase. The key never left the chip."* Tag @0G_labs, @Whitechain_io, @worldnetwork.
2. **The refusal.** Clip of a wrong/foreign motion → denied, nothing signed. Caption:
   *"The feature nobody demos: it refuses. Watch an agent try to spend and get told no."*
   This is the post judges and builders actually reply to.
3. **The teardown.** Thread: why the arming gate exists (nod-of-assent), the calibration
   envelopes, the stream-quality gate that blocks a degraded take. Numbers, no hype.
4. **The rail explainer.** "How an AI agent pays a business in USDT without knowing what a
   chain is" — the x402 + EIP-3009 + facilitator story, with the live curl line.
5. **Build-in-public milestone.** Whatever the next shipped thing is (one-command setup,
   real World ID, Needle on chip). Include a failure honestly — it reads as progress.

**Distribution mechanics that actually work:**
- Post the demo clip **as native video**, not a link (reach). Link in the first reply.
- Reply to 0G / World / Whitechain / Optimism posts with substance, not "check out our
  project". Two sentences that add information.
- Put the video + live 402 in the repo README's first screen — GitHub is a discovery
  surface for this audience.
- One long-form post per month (a real technical write-up). It compounds; tweets don't.
- **Do not** do follow-for-follow, engagement pods, or reply-spam. It reads as bot activity
  to exactly the audience you want.

**What to measure:** replies from builders, repo stars, DMs from teams wanting the rail,
and people running the curl. Not impressions.

---

## 4. Order of work (next 3 weeks, solo)

**Week 1 — make it repeatable.** `0gaze up` + hardware self-healing + a readiness table.
Ship it. Post the six-second clip and the refusal clip.

**Week 2 — make it teachable.** Guided calibration on the glasses; docs quickstart; the
limitations table; README first-screen rewrite. Post the teardown thread.

**Week 3 — make it real.** Real World ID credentials (one live proof), then the rail
explainer post. Decide on the B-first plan: extract the merchant + facilitator + gate into
a small hosted service with an API key, priced per request.

**Do not start:** the macOS .dmg, the phone app, or a token. None of them move the bar
above.

---

## 5. The trap to avoid

"Flawless first, then launch" is how solo products die quietly. The bar is *a stranger can
settle a payment unaided*. Hit that, publish the artifacts, and let the replies tell you
what to fix next. Polish continues in public.
