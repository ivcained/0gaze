# 0Gaze — Design Consistency Review

*Finish-gate review of the brand system against the owner's direction (minimal, classic, premium, top-notch), against product truth (`docs/designs/0gaze.md`), and against itself. Reviewer: UI Finish-Gate Reviewer. Date: 2026-11-06.*

**Documents reviewed (md5-stamped; line numbers cite these exact versions):**

| File | md5 | Note |
|---|---|---|
| `brand/brand-brief.md` | `db846335…` | the pinned contract |
| `brand/brand-book.md` | `ff78fb50…` | identity system v1.0 |
| `brand/voice-and-tone.md` | `ef37979b…` | sentence-canonical voice guide |
| `docs/designs/glasses-ui.md` | `2df6b345…` | the 1470×956 revision (see note below) |
| `docs/designs/0gaze.md` | `f8db48de…` | product truth (renamed from `eyesonly.md` in `54788ed`) |
| `brand/0gaze-mark.svg` | — | master artwork, measured directly |

**Churn caveat:** `docs/designs/glasses-ui.md` was rewritten mid-review (a 1920×1080 draft was replaced by the 1470×956 hardware-mirror revision while this review was running). All findings below cite the 1470×956 revision. The rebase itself was spot-checked and is internally consistent (uniform 0.766 scale verified on 8 element pairs and 4 y-coordinates).

**Method:** every hex was run through the WCAG 2.1 relative-luminance formula; every anatomy number was recomputed from the SVG path data; every banned word was grep'd across all four brand documents; every cross-document number (tier boundaries, buffer sizes, safe rects, message contracts) was compared by hand.

---

## BLOCKERS (2)

### B1 — The brand book's halo anatomy is false against the master artwork

**File:** `brand/brand-book.md:72`
> "the upper and lower arcs run from 9 o'clock to 3 o'clock, leaving open gaps at left and right — the eye's corners. It breathes: the ring is sealed, the halo is open"

**Why wrong:** The master artwork (`brand/0gaze-mark.svg`, lines 6–8) draws the halo as two **full-circle** subpaths under `fill-rule="evenodd"`: outer radius 418 (`M 165 500 A 418.00 418.00 0 0 1 835 500 A 418.00 418.00 0 0 1 165 500 Z` — two semicircular arcs, upper then lower, forming a closed circle), inner radius 403.46, same construction. The result is a **closed annulus** — there are no gaps at left and right. Every other number in §3.2 checks out (see Confirmed-correct), which makes this worse: the section is trustworthy except for the one sentence that describes the mark's defining gesture. An implementer or QA pass that trusts the book will "fix" the SVG by cutting gaps into it — i.e., redraw the artwork the brief forbids redrawing (brief:18–20, book:59).

**Fix (one of the two must change; recommend changing the book, since the artwork is pinned):** replace book:72's geometry clause with:
> "outer Ø 836 units, stroke ≈14.5 units; a complete concentric ring around the zero — a second, thinner orbit that holds the eye without touching it"

and delete "It breathes: the ring is sealed, the halo is open" or rewrite as "the halo floats free of the ring — 46 units of clear space between them." If the open-gap design is the intended one, then the SVG is wrong instead, and that is an owner-level artwork decision — but the two artifacts cannot stay as they are.

### B2 — The money-honesty line contradicts itself on the review screen

**File:** `docs/designs/glasses-ui.md:203`
> "Footer, 15 px, `ember-white@78%`: "Testnet funds only.""

and the type-scale example at `glasses-ui.md:38`:
> "Tertiary / legal | **15 px** | … | "testnet funds only"…"

**Why wrong:** The vocabulary owner (`brand/brand-book.md:46`, which `glasses-ui.md:379` explicitly defers to — "that table wins over anything here") rules: in the glasses, the line is **"practice money only — nothing here is real money yet"**; the word *testnet* is reserved for the public proof page and docs. The glasses spec's own §5 (`glasses-ui.md:383`) agrees with the book: *"Honest about the network: 'Practice money only — nothing here is real money yet.' on the review screen."* State 3 **is** the review screen. So the spec mandates string A in its rules and prints string B in the layout — on the single sentence the brand calls "a brand value, not a disclaimer style" (book:53). The Unity implementer cannot satisfy both. (Root cause visible upstream: the brief's voice section, `brand-brief.md:44`, still gives "testnet funds only" as the example string; the book later refined the split. The brief should be annotated so the stale example stops regenerating this bug.)

**Fix:** change glasses-ui.md:203 to:
> "Footer, 15 px, `ember-white@78%`: "Practice money only — nothing here is real money yet.""

change the :38 example to `"practice money only"`, and add one line to `brand-brief.md:44`: "(refined in brand-book §2: 'practice money' on product surfaces, 'testnet' on the public page)".

---

## SHOULD-FIX (10)

### S1 — State 2 uses gold twice, violating the spec's own one-gold rule

**File:** `docs/designs/glasses-ui.md:183` + `:188`, rule at `:60`
> Rule: "Gold appears at most once per state (the request card's amount, **or** the current-step outline — never both in the same state)."
> Layout: "$0.10 … 56 px treasury-gold … (gold's one moment)" **and** "Approve: gold outline (the primary)."

**Why wrong:** The amount in gold *and* the Approve outline in gold is both-in-the-same-state. The layout even annotates the amount as "gold's one moment" while spending a second one two lines later.

**Fix:** keep the amount gold (the rule names it as gold's moment) and change :188 to "Approve: ember-white outline at 100% (the primary — full-strength white, vs 78% for Details/Dismiss)". Primary-ness is carried by luminance, not a second gold.

### S2 — The canonical cover spends gold twice, violating §4.4

**File:** `brand/brand-book.md:211` (tagline "gold") + mark's gold iris; rule at `brand-book.md:147`
> Rule: "If a screen uses gold twice, it is wrong once." Also :122/:126 — gold is "decorative only… one moment per surface," and :139 — "never words that must be read."

**Why wrong:** The §6.3 cover lockup puts a gold iris (inside the mark) and a gold tagline ("italic serif, gold") on one near-black surface. That is two golds, and the tagline is exactly "words that must be read." The book's own proportion rule convicts its own cover recipe. (On dark, gold measures 6.34:1, so legibility is not the issue — the brand's one-moment discipline is.)

**Fix (pick one, recommend the first):** set the tagline in `ink` `#F1F3ED` italic Georgia and let the iris be the cover's one gold moment — "the one warm element" reads *stronger* when it is literally the only warm element; or amend §4.1/§4.4 with an explicit exception: "the mark's iris never counts against a surface's gold budget." If the exception route is taken, state it in §4.4, not just §6.3.

### S3 — The 78%-of-white hex equivalent is the wrong hex

**File:** `docs/designs/glasses-ui.md:52`
> "Render at 100% for hero text, 78% (`#C6C9BE`-equivalent via alpha 0.78) for secondary."

**Why wrong:** `#F1F3ED` × 0.78 over black = `#BCBEB9` (241×0.78=188=`BC`, 243×0.78=190=`BE`, 237×0.78=185=`B9`). `#C6C9BE` corresponds to alpha ≈ 0.80–0.83, not 0.78. An implementer hand-coding the hex instead of the alpha gets a brighter secondary text than specified; an implementer doing the reverse gets a dimmer one.

**Fix:** change :52 to "…78% (`#BCBEB9`-equivalent via alpha 0.78 over black)…".

### S4 — "Luminance" is used in two incompatible units, and the 30% floor fails its own tokens under one of them

**File:** `docs/designs/glasses-ui.md:15`, `:55`, `:390`, `:409` (checklist item 9); echoed at `brand/brand-book.md:197`
> "`meter-track` `#6E6E6E` … 43% luminance, the deliberate margin above the 30% floor"

**Why wrong:** 43% is the sRGB channel value (110/255). WCAG relative luminance of `#6E6E6E` is **15.6%** — *below* the 30% floor the same sentence invokes. Meanwhile the web muted grey the spec bans for failing the threshold, `#A9AFA2`, is **41.7%** WCAG luminance — *above* it. And `signal-red` `#FF4D5E`, a mandated diagnostic token, is 27.4% WCAG — below the floor. As written, checklist item 9 ("every rendered pixel ≥ 30% luminance") simultaneously convicts the meter track and acquits the banned grey. The physics intuition (mid-greys read as haze; saturated marks survive) is sound; the units are not.

**Fix:** pick one measure and restate the floor in it. Recommended: keep the practical rule in sRGB terms — add to :15 "('luminance' in this document = sRGB dominant-channel value; `#6E6E6E` = 43%, the floor is ~30%)" — and change checklist item 9 to "every rendered element's dominant channel ≥ 30% of full scale; no web-brand grey present." Then the meter track passes, the greys stay banned for the haze reason (state it: "mid-greys read as smear regardless of threshold"), and signal-red's membership is coherent.

### S5 — The future-buffer note prescribes non-uniform scaling that contradicts the rebase rationale

**File:** `docs/designs/glasses-ui.md:16` vs `:167`
> :16 — "multiply all px by 1.306 (x) and 1.130 (y)"
> :167 — "x and y are never scaled by different factors, so rings and orbs stay circular"

**Why wrong:** 1.306 ≠ 1.130. Scaling x and y by different factors turns the 168 px progress ring and the World ID orb into ellipses — the exact outcome :167 says the uniform 0.766 rebase exists to prevent (verified: the 1920→1470 rebase *was* uniform; the note's reverse direction is not).

**Fix:** change :16's parenthetical to: "if a future rig drives a native 1920×1080 phone buffer, scale all px by **1.130 uniformly** (the y factor — the limiting dimension) about the optical center, then re-run the verification checklist, §7; the extra horizontal real estate is margin, not layout."

### S6 — Canonical sentences drift across three documents

**File:** `brand/voice-and-tone.md:3` ("this volume is canonical for sentences") vs the actual sentences shipped:

| Moment | Voice (canonical) | Brand book §2 | Glasses spec |
|---|---|---|---|
| Paused | "Your agent is paused. Nothing moves — and nothing is spent — until the connection is back." (:111) | "Your agent is paused. Nothing moves until the connection is back." (:39, :237) | "Your agent is paused" / "It can't spend or decide anything until it's back." (:340–342) |
| Wrong wearer | "This doesn't look like the person this agent belongs to. Nothing was spent. …" (:103) | — | "That didn't move like you" / "No money moved." (:283–284) |
| Approved | "Approved. $18.50 paid. The receipt is in your records." (:77) | — | "Approved — $0.10 for your agent's thinking" (:270) |

Also: glasses §5 (:382) mandates '"No money moved" on every denial,' but state 10 (`DENIED_TIMEOUT`, :312) shows "No rush — nothing happened" with no money-reassurance line.

**Why wrong:** Three sources, three sentences for the same moment, while voice claims sentence-level canonicity. The glasses variants are *good* (arguably better — "That didn't move like you" is motion-specific), but then the canonical document must bless them, or every future surface will improvise a fourth variant.

**Fix:** decide per moment and align: (a) promote the glasses variants into voice-and-tone §3.5/§3.6 as the canonical glasses phrasing ("on the glasses surface, say…"), keeping the longer lines for web/docs; and (b) add "No money moved." (15 px, `signal-red`) under state 10's headline, or scope §5's rule to "every refusal" (wrong-wearer/wrong-direction), excluding timeouts.

### S7 — Two honesty overclaims in the brand story

**File:** `brand/brand-book.md:9`
> "A turn of your head proves it is really you." / "Nothing about you is exposed in the process."

**Why wrong:** Product truth (`docs/designs/0gaze.md:119`): "the gate is a tripwire, not a lock," and :67: the security argument is "presented as design intent, not as a proven guarantee." A tripwire that escalates does not "prove it is really you." Second, settlement is on Whitechain Sepolia — a public testnet: the chip's address and every payment hash are publicly visible, so "nothing about you is exposed" overclaims; the true claim is about *approvals*, not about the ledger. (The pinned brief line, "proves the enrolled human is present," is the presence framing; "proves it is really you" is an identity claim one notch stronger. The canonical voice line "A small turn of your head proves it's you" (:89) inherits this — softening it is the owner's call, flagged here so it's a decision rather than a default.)

**Fix:** book:9 — replace with "A turn of your head checks that the person wearing the glasses is you — and large amounts ask for stronger proof." Replace "Nothing about you is exposed in the process." with "What you approve is yours alone to see." Optionally soften voice:89 to "A small turn of your head tells your agent it's you."

### S8 — The glasses "signature moment" names an element the spec doesn't contain

**File:** `brand/brand-book.md:200`
> "**Signature moment:** the gold iris opening the approval — the one warm light in the wearer's field of view."

**Why wrong:** The glasses spec renders no mark and no iris in any of its 13 states. Gold's actual moment in the glasses is the amount on the request card (state 2). As written, the book promises a brand beat the implementer cannot find — and if they improvise one (an iris animation at approval), they'd be drawing the mark on a surface where the book never sanctioned it, at a fidelity the waveguide can't hold.

**Fix:** replace book:200 with: "**Signature moment:** the amount in treasury gold on the request card — the one warm light in the wearer's field of view. The mark itself never renders in the waveguide; the iris survives only as the memory of it." (Or, if an iris motif is wanted, the glasses spec needs a new element — owner decision.)

### S9 — Motion-gate duration disagrees with the product doc

**File:** `docs/designs/0gaze.md:61` and `:163` vs `docs/designs/glasses-ui.md:79–87`
> Product doc: "the motion gate samples 10-15 seconds and must pass" / "motion sampling window 10-15 seconds."
> Glasses spec: "Your call" = 2 glances — guidance 2.5 s + stillness countdown (~2 s) + two ~1–2 s glances ≈ 6–8 s of flow, of which live sampling is roughly half.

**Why wrong:** Same system, two numbers. The 10–15 s figure predates the 2-glance design (or the 2-glance design under-samples the profile the doc describes). A judge watching the demo against the design doc will notice a ~6 s gate sold as 10–15 s.

**Fix:** align one side. Recommended: change 0gaze.md:61/:163 to "the motion gate samples across a short glance sequence (roughly 5–8 seconds in the glasses)" — unless the gate genuinely needs 10–15 s of IMU, in which case the tier table needs more moves.

### S10 — Minimizing "just" in user-facing copy (two instances)

**Files:** `brand/brand-book.md:34` and `docs/designs/glasses-ui.md:359`
> "Below your everyday limit, your agent **just** pays — and shows you the receipt after."
> "For five minutes, **just** wear them and move naturally…"

**Why wrong:** Voice-and-tone bans "just" when it minimizes (:31: "'just approve' → 'approve'"). Both instances minimize exactly as banned — and the book's §2 table is the canonical vocabulary source, so the violation sits in the document other documents copy from. (The rest of the corpus is clean: these are the only two minimizing-`just` instances in user-facing strings across all four documents; `glasses-ui.md:260`'s "just off-center" is a spatial description, not minimizing.)

**Fix:** book:34 → "Below your everyday limit, your agent pays on its own — and shows you the receipt after." (This also matches voice §3.2's own Do line.) glasses-ui.md:359 → "For five minutes, wear them and move naturally — look around, nod, read. There's nothing to perform."

---

## NICE-TO-HAVE (9)

- **N1 — "No greys, ever" is falsified by the palette it defers to.** `brand-book.md:196` ("Every element is either off (black) or fully saturated") vs the spec's `meter-track` `#6E6E6E` — a zero-saturation mid-grey, deliberately chosen. Fix: "No content greys, ever. One functional grey exists — the meter track, specified in the surface spec — everything else is off or fully saturated."
- **N2 — The AR palette quote is incomplete and overclaims hue unity.** `brand-book.md:197` lists five of the six tokens (omits `guide-cyan #4DD8FF`) and says "same hue family (≈155°)" — true of the emeralds (156.6° → 154.9°), but gold is 38°, cyan 193°, red 354°. Fix: "…meter track `#6E6E6E`, plus one functional cyan for guidance that is not a brand color. The emerald and gold hold the brand's hue directions (≈155° / ≈38°); the cyan and red are functional signals, deliberately outside the brand hues."
- **N3 — Halo thinness math uses the wrong basis.** `brand-book.md:80` says the halo is "1.3 px at 64 px." At a 64 px artwork width the halo spans the full width (Ø 836), so the stroke renders at 14.5 × 64/836 = **1.11 px**. 1.3 px is the figure on a ring-Ø basis (64 px ring = 75 px artwork). Fix: "Below this the halo (≈1.1 px at 64 px) no longer survives."
- **N4 — 48–64 px is a dead zone.** Full mark minimum 64 px (`:80`); reduced mark permitted "from 24 px up to 48 px" (`:81`). Nothing is sanctioned at 48–64 px. Fix: "reduced mark permitted from 24 px up to the full mark's 64 px floor."
- **N5 — The wordmark recipe can't be reproduced, and the OG export can't be a scale.** `brand-book.md:210` specifies "heavy rounded sans" with no typeface (and §5 forbids display faces and webfonts — is the wordmark SF Pro Rounded? custom lettering?), and :215 says OG exports at 1200×630 "keep the same recipe, scaled" — but 640×360 is 1.78:1 and 1200×630 is 1.90:1; a pure scale cannot produce it. Fix: name the wordmark typeface or declare it outline artwork ("the wordmark is artwork; never set it in live type"), and change :215 to "OG exports at 1200×630 keep the same recipe, re-centered on the wider frame; side margins grow, nothing scales non-uniformly."
- **N6 — The worldid-tier request card's primary target is unspecified.** The transition table (:154) sends `spendTier: worldid` to escalation via a dwell target labeled **Continue**, but state 2's layout (:186–188) defines only Approve / Details / Dismiss. Fix: add one line to state 2: "For above-cap requests the primary target reads **Continue to identity check** (gold's moment stays the amount)."
- **N7 — No cancel path during WORLDID_ESCALATION's wait.** While waiting on `worldid_verdict` (:331) the wearer is committed; `Try again`/`Not now` exist only for the `expired` verdict (:333). Fix: add "Dwell **Not now** during the wait dismisses to `IDLE` (denial sent to agent)."
- **N8 — The tier numbers exist nowhere in brand documents.** $0.05 / $25 appear only in the glasses spec (:81) and the product doc (:107). A web-page designer writing about Everyday spends cannot learn the floor from the brand book or voice guide (voice says only "under a few cents" — which is accurate, but unanchored). Fix: add the figures to book §2's tier rows: "Everyday spends (under $0.05)… A bigger decision (over $25)…".
- **N9 — Unowned gaps a designer will hit:** (a) light mode has no panel/elevation tokens — docs on paper get `ground-light` and a hairline but no card color; (b) no localization stance anywhere (dollars-only is assumed; the glasses spec's own formatting-risk paragraph mentions locale decimal separators, so the question is already open); (c) icon guidance is negative-only ("no padlocks, shields, glowing vaults") — the glasses glyphs are specified, but the web surface has no positive icon rule; (d) the glasses instruction line dropped from 28 px (1920 draft) to 22 px (1470 rebase), below the measured review's 28–40 px comfort band for time-pressured text (`research/gesture-ux-review.md:44`) — defensible since the 72 px glyph is the performable target, but the spec should say so rather than drift into it.

---

## Confirmed correct (do not re-litigate)

**Palette and contrast (all recomputed via WCAG 2.1 relative luminance):** every ratio quoted in the brand book is accurate within rounding — dark: ink 17.53:1, ink-muted 8.72:1, hairline 1.64:1, emerald 3.75:1, emerald-text 7.34:1 on ground / 6.75:1 on panel-1 / 6.31:1 on panel-2, hover 8.91:1, gold 6.34:1; light: ink 16.86:1, muted 6.31:1, emerald-on-paper 4.84:1, hover 6.06:1, gold 2.86:1. AR scale on black: emerald 13.03:1, gold 13.30:1, text 18.78:1 — all as quoted. `emerald-text #2FB37C` holds hue direction (155.0° vs the mark's 156.6°) — the brief's "refine tints, not hue direction" is honored. Chartreuse appears nowhere as a live color (only as the dropped-color rule).

**Mark anatomy (measured from `0gaze-mark.svg` path data):** ring outer Ø 714, stroke 44 (6.16% ≈ "≈6.2%"); halo outer Ø 836, stroke 14.54 (≈14.5); halo sits 46.46 units outside the ring ("46 units"); iris Ø 176 = 24.65% of ring Ø ("exactly 24.7%"); ring:halo:iris = 4.06:4.75:1 ("≈ 4 : 4.7 : 1"); clearspace 0.25 × 714 = 178.5 ("178 units… one iris-diameter plus change"); fills are exactly `#0B7C50`/`#B78B45`; viewBox `0 0 1000 1000`. Only the halo-openness *description* is wrong (B1) — every *number* is right.

**Product truth alignment:** tier boundaries $0.05 / $25 identical in the product doc (:107) and glasses spec (:81); the four-message WebSocket contract (`approval_request`, `motion_verdict`, `worldid_verdict`, `sign_result`) is identical in both; auto-pay below the floor never reaches the glasses in both; World-ID-first-then-motion for above-cap in both; the Dabao key-never-leaves-chip claim in the brand matches the product doc (:13); no document implies mainnet.

**Voice hygiene:** zero exclamation marks in any system copy; zero positive uses of "seamlessly", "revolutionary", "cutting-edge", "unlock"; all banned engineering terms appear only in banned-word lists, Don't examples, or explicitly-internal state/message names (which glasses §5 sanctions); "EyesOnly" appears only in the two "is dead" statements — the rename commit (`54788ed`) is real, and `docs/designs/eyesonly.md` no longer exists.

**Glasses geometry (1470×956 revision):** safe rect x 294–1176 / y 191–765 = exactly central 60%, centers on (735, 478) by construction; the `research/gesture-ux-review.md` cross-reference (1470×956 @ 120 Hz, rounded rect x 290–1180 / y 190–765) matches the review document's actual text; the 0.766 uniform rebase is verified on ring (220→168), glyph (96→72), amount (72→56), pills (16→12), pill outlines (200×64→153×49), and y-coordinates (455→413, 380→355, 700→601); type floor 15 px sits above the measured 12 px hardware floor; state-2 buttons and the approved-dot land inside the safe rect; the state-2 example amount ($0.10) is correctly above the $0.05 floor for an approval card; brand assets referenced in §6.3 (`0gaze-cover-640x360.png`) and elsewhere (`0gaze-mark.svg`, `0gaze-logo-512.png`, `0gaze-mark-transparent.png`) all exist.

**Generic-slop audit:** the corpus is specific throughout — palette proportions, per-state coordinates, named failure modes, real tier numbers. No interchangeable-benefit lists, no template hero copy; the repeated phrases ("quietly premium", "the evidence is the decoration", "gold is jewelry, not paint") are deliberate system rules, not filler. The em-dash habit in the internal documents is heavy but these are working docs; watch that it doesn't leak into public copy, where the voice guide is silent on dashes.

---

## Summary

- **Blockers: 2** — (B1) halo anatomy contradicts the master SVG; (B2) the money-honesty footer contradicts the vocabulary owner and the spec's own §5.
- **Should-fix: 10** — gold-twice violations on two surfaces, a wrong hex equivalent, the luminance-unit confusion, the non-uniform future-scale note, canonical-sentence drift, two honesty overclaims, the unimplementable "gold iris" signature moment, the 10–15 s sampling mismatch, and two minimizing "just"s.
- **Nice-to-have: 9** — see N1–N9.
- **Single most important fix: B2.** It is the sentence that sits next to money, on the one surface where the brand declares honesty "a brand value, not a disclaimer style" — and two documents that both claim authority over it currently disagree. The fix is one string in two places plus a one-line annotation in the brief.

*Review only — no source documents were modified.*

**Status: APPLIED 2026-11-07.** All 2 blockers and all 10 should-fixes are applied; N1–N8 are applied and N9(a)–(d) are closed with new spec text (light-mode `panel-light`, the locale rule in brand-book §2, the positive icon rule in §7, the 22 px instruction-line rationale). Owner-call made while applying: "proves it's you" became "tells your agent it's you" (book §2 + voice §3.4) to match the brief's presence framing and the product doc's tripwire honesty — revert with one word if you want the stronger claim back.
