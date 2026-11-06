# 0Gaze Brand Book

*The identity system. Version 1.0 — 2026-11-06. Supersedes nothing, overrides nothing in `brand-brief.md` (the contract); this book is the full working system built on it. Companion volume: `voice-and-tone.md`.*

---

## 1. Brand story

**Story (one paragraph).** Software is starting to spend money. Today that money sits where other people can see it: keys on servers, approvals on screens, balances in ledgers someone else operates. 0Gaze begins from a simpler idea — what you approve should be yours alone to see. The key to your agent's money is born inside a hardware chip and never leaves it. Approvals appear only inside your own glasses, in light that exists for your eyes and no one else's. A turn of your head checks that the person wearing the glasses is you — and large amounts ask for stronger proof. The agent does its work, pays its own way, and shows its receipts. What you approve is yours alone to see. Zero external gaze: the whole product in three words.

**Positioning statement (one paragraph).** For a person who wants an AI agent that handles things — and real money it can spend — 0Gaze is the private agent whose wallet lives in hardware and whose approvals only the wearer can see. Unlike custodial accounts, phone wallets, or server-held keys, 0Gaze combines a sealed chip, an eyes-only approval channel, and a motion check that proves the enrolled human is present — so control stays physical, personal, and quiet. You never need to know what a private key is to own what it protects.

**The spine.** Every brand decision is tested against one sentence: *an eye that only the wearer has.* If a choice makes the brand louder, more public, or more technical than that sentence, it is wrong.

---

## 2. Naming and product vocabulary

This section is the single source of truth for names. When code, docs, and surfaces disagree with this section, the code and docs change — not this section.

### The name

- **0Gaze** — always this capitalization in prose: digit zero, capital G, lowercase aze. Never `0gaze` (except inside the wordmark artwork, which is a logo, not text), never `0GAZE`, `OGaze`, `ZeroGaze`, or `0 Gaze`.
- In the wordmark the `0` sets in brand emerald and `gaze` in ink — the zero is the mark's sibling, the gaze is the word.
- **"EyesOnly" is dead.** The former working name must not appear in any shipped surface, document, string, filename, or comment that a user, judge, or partner could see. Internal historical references may remain in the repo history; nothing new is written under it.
- The network is **0G** (zero-G). The product is **0Gaze**. Never blur them: "private agent payments on 0G," not "a 0G product called Gaze."

### User-facing vocabulary

Engineering names exist for engineers. Users meet these words instead. The right-hand column is canonical for every surface — UI, docs, video, pitch.

| Engineering term (internal) | User-facing name (canonical) | Rule of use |
|---|---|---|
| auto-approve floor / below-floor spend (under $0.05) | **Everyday spends** | "Below your everyday limit, your agent pays on its own — and shows you the receipt after." |
| mid-tier spend ($0.05 → $25) | **Your call** | The approval moment. "This one is your call." |
| above-cap spend (over $25) | **A bigger decision** | Requires the identity check first. "For a bigger decision, your agent asks you to prove it's you." |
| motion gate / motion profile / ZKP motion proof | **Head-turn check** | "A small turn of your head tells your agent it's you." Never "biometric," never "zero-knowledge" to users. |
| approval card (rendered in glasses) | **Approval** | It needs no adjective. If one is required: "eyes-only approval." |
| safe-stop (network lost / storage outage) | **Paused** | "Your agent is paused. Nothing moves until the connection is back." The agent never fakes decisions. |
| Dabao hardware signer | **the chip that holds the money** | First mention. Afterwards: "the chip." |
| World ID verification | **identity check** | "Your agent asks you to prove you're you — not who you are." |
| x402 payment / EIP-3009 authorization | **a payment** / "pays per use" | Protocol names never appear in user copy. |
| 0G Private Computer inference | **your agent's thinking** | "Your agent pays for its own thinking." |
| episode entry on 0G Storage | **receipt** / **record** | "Every spend leaves a receipt only you can read." |
| facilitator / relay / proxy | (no user-facing name) | Infrastructure is invisible. It is never a feature. |
| testnet funds | **practice money** (product surfaces) / **testnet** (public proof page, docs) | In the glasses and the app: "practice money only — nothing here is real money yet." On the public page and in docs the word *testnet* is kept: judges and partners need the precision, and vagueness reads as evasion. Pair the plain gloss with it there: "testnet funds only". |

**Vocabulary rules.**

1. One name per thing, everywhere. If the glasses say **Approval**, the web page and the video say **Approval**.
2. Amounts in human units (dollars), always. `$2.40`, never token jargon.
3. Banned in user-facing copy: *scopes, TTL, signer, gasless, EIP-3009, x402, facilitator, zero-knowledge, biometric, custody* (say "the chip that holds the money"). The full language rules live in `voice-and-tone.md`.
4. Testnet honesty is a brand value, not a disclaimer style: say it plainly, once, where money is shown.
5. **Locale.** Version 1 ships English and dollars only. Every amount renders through one formatting path that already takes the locale's decimal separator into account, so the first non-English surface is a translation job, not a rewrite. Do not ship a language whose number format the formatter has not been tested against.

---

## 3. The mark

The master artwork is `brand/0gaze-mark.svg` (square viewBox `0 0 1000 1000`). **Do not redraw it, re-proportion it, re-color it outside the variants in §3.4, or reinterpret it.** This section documents it.

### 3.1 Concept

A sealed ring — the zero — whose interior is an eye, with a solid gold iris. The ring closes completely around the eye: nothing sees in, nothing leaks out. *Zero external gaze.* The gold iris is the single warm element: the wearer's own eye, the one pair of eyes the system is built for.

### 3.2 Anatomy

Measured from the master artwork (all values as a percentage of the artwork square; ring outer diameter = 71.4%):

| Element | Geometry | Color |
|---|---|---|
| **Ring (the zero)** | outer Ø 714 units, stroke 44 units (≈6.2% of ring Ø), perfectly concentric | brand emerald `#0B7C50` |
| **Halo (the lids)** | outer Ø 836 units, stroke ≈14.5 units; a complete concentric ring around the zero — a second, thinner orbit that holds the eye without touching it | brand emerald `#0B7C50` |
| **Iris** | solid disc, Ø 176 units — exactly 24.7% of the ring's outer Ø, dead center | gold `#B78B45` |

Construction relationships worth knowing: ring : halo : iris ≈ 4 : 4.7 : 1 in diameter. The halo sits 46 units outside the ring, so the eye reads as held, not clamped.

### 3.3 Clearspace and minimum sizes

- **Clearspace:** **0.25 × ring outer diameter** on all sides — i.e. a margin of 178 units in the master grid, or one iris-diameter plus change. Nothing enters it: no type, no rules, no other artwork, no container edge.
- **Minimum sizes, full mark (ring + halo + iris):** **64 px** digital / **20 mm** print. Below this the halo (≈1.1 px at 64 px, measured against the full 836-unit artwork width) no longer survives.
- **Reduced mark — ring + iris only (halo omitted):** permitted from **24 px** up to the full mark's 64 px floor, for favicons and avatars. This is the *only* sanctioned edit to the artwork, and it is an omission, never a redraw. Below 24 px, do not show the mark.
- Never scale non-uniformly, never crop, never rotate.

### 3.4 Color variants

Exactly three variants exist:

1. **On dark ground (primary):** emerald `#0B7C50` ring and halo, gold `#B78B45` iris, on ground `#0B0C0A` or panels `#151713`/`#1B1E18`.
2. **On light ground:** same colors on paper `#F7F6F1` or white. Unchanged — both hold up.
3. **Mono:** the entire mark in one ink — ink `#F1F3ED` on dark, near-black `#14160F` on light. For single-color contexts only (engraving, emboss, fax-grade print, stencil). The iris is *not* punched out or stroked; the mark stays solid fills.

### 3.5 Misuse — never

- Never tile, repeat, or pattern the mark. **It appears once per page, surface, or screen.** It is a seal, not wallpaper.
- Never use it as a watermark, ghost, or background texture.
- Never apply a gradient, glow, drop shadow, bevel, neon, or outline restyle.
- Never recolor it outside §3.4 — no white iris, no gold ring, no chartreuse anything.
- Never redraw it in another stroke weight, style, or "updated geometry."
- Never place it on photography, noise, or busy texture; it sits on flat ground only.
- Never animate the geometry (no blinking, dilating, scanning). A single calm fade-in is the most it ever does.
- Never lock it up with other logos at equal weight; in partner contexts it takes a secondary position rather than a shouting one.

---

## 4. Palette

Dark-first. All contrast ratios measured against WCAG 2.1 relative luminance; AA requires 4.5:1 for body text, 3:1 for large text and non-text UI.

### 4.1 Dark mode (primary)

| Token | Hex | Role | Contrast on `#0B0C0A` |
|---|---|---|---|
| `ground` | `#0B0C0A` | page ground, near-black with a green tint | — |
| `panel-1` | `#151713` | first surface thickness | — |
| `panel-2` | `#1B1E18` | second surface thickness | — |
| `ink` | `#F1F3ED` | primary text | **17.5:1** — AAA |
| `ink-muted` | `#A9AFA2` | secondary text, captions | **8.7:1** — AAA |
| `hairline` | `#34382F` | borders, dividers; non-text only (1.6:1) | — |
| `emerald` | `#0B7C50` | the mark, fills, large display moments. 3.75:1 on ground — passes large-text/graphic AA, **never body text** | 3.75:1 |
| `emerald-text` | `#2FB37C` | **all** emerald text and links on dark | **7.3:1** — AAA |
| `emerald-text-hover` | `#3CC58A` | link hover/active only | 8.9:1 |
| `gold` | `#B78B45` | **decorative only.** The iris; one eyebrow label, one key detail, one signature moment per surface | 6.3:1 |

**The emerald rule, stated plainly:** the brief's mark emerald `#0B7C50` fails AA for body text on the ground (3.75:1 < 4.5:1). For text and links the brand uses the refined tint **`#2FB37C`, measured 7.34:1 on `#0B0C0A`** (6.75:1 on `panel-1`, 6.31:1 on `panel-2`) — comfortably past AA, past AAA. Hue direction unchanged; tint refined, as the contract allows.

**The gold rule, stated plainly:** `#B78B45` is **decorative-only**. It measures 6.3:1 on the ground, but gold is jewelry, not paint: it is never body text, never a paragraph, never a button fill. One label, one rule, one moment per surface. Anywhere gold carries meaning (a state, a warning, a required action), pair it with a shape or word so color is never the only signal.

### 4.2 Light mode (paper)

Used for docs, print, and any surface where dark would feel like a posture.

| Token | Hex | Role | Contrast on `#F7F6F1` |
|---|---|---|---|
| `ground-light` | `#F7F6F1` | warm paper | — |
| `ink-light` | `#14160F` | primary text | **16.9:1** — AAA |
| `ink-muted-light` | `#565D50` | secondary text | **6.3:1** — AA/AAA large |
| `panel-light` | `#FFFFFF` | the sheet: card and panel fill on paper, separated from `ground-light` by the hairline | — |
| `hairline-light` | `#C9CBC0` | borders; non-text only | — |
| `emerald` | `#0B7C50` | mark **and** text/links on light — on paper the mark emerald passes AA for text as-is (**4.84:1**); hover `#0A6B45` (6.1:1) | 4.8:1 |
| `gold` | `#B78B45` | decorative-only on light too (2.9:1 — fails text AA; jewelry, never words that must be read) | 2.9:1 |

### 4.3 Dropped

Chartreuse `#D4FF3F` is **not** a 0Gaze color. It is the studio's house accent for other products. It must not appear in any 0Gaze surface.

### 4.4 Proportion

Roughly: 85% ground and panels, 10% ink, 4% emerald, 1% gold. If a screen uses gold twice, it is wrong once.

The mark's own iris is the exception: wherever the mark appears, its gold iris is that surface's gold and nothing else on the surface may be gold. This is why the cover lockup sets its tagline in ink (§6.3).

---

## 5. Typography

Premium comes from spacing and hierarchy, not from a display typeface. No webfonts anywhere.

### 5.1 Stack

- **UI and display:** `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, sans-serif` — SF Pro on Apple, Segoe on Windows.
- **Evidence (monospace):** `ui-monospace, "SF Mono", Menlo, Consolas, monospace`.

### 5.2 Scale and rules

| Level | Size / line | Weight | Tracking | Case |
|---|---|---|---|---|
| Display | 56–72 / 1.05 | 700 | −0.03em | sentence case, lowercase-adjacent |
| H1 | 40–48 / 1.1 | 700 | −0.025em | sentence case |
| H2 | 28–32 / 1.15 | 600 | −0.02em | sentence case |
| Eyebrow | 12–13 / 1.3 | 600 | +0.12em | ALL CAPS — the gold label's natural home |
| Body | 17–18 / 1.6 | 400 | 0 | sentence case |
| Caption | 13–14 / 1.5 | 400 | +0.01em | sentence case |
| Evidence | 13–15 / 1.6 | 400 | 0 | verbatim |

- Display sizes get tight negative tracking; tracking loosens as size shrinks. Never letterspace body text.
- Headings sit close to lowercase in feel: sentence case, no title case, no all-caps except eyebrows and the one-line descriptor.
- **Monospace is reserved for evidence:** transaction hashes, block numbers, request IDs, commands, addresses. Set like an engraving — small, calm, ink or ink-muted, never emerald-large, never gold. The evidence is the decoration; the type treats it with that respect.
- Numbers in money contexts use tabular figures where the platform offers them.

---

## 6. Application rules — the three surfaces

One signature moment per surface. Restraint over cleverness, everywhere.

### 6.1 Public proof page (`site/index.html` — Solid Glass, dark adaptation)

- Dark mode palette only (§4.1). Panels are the Solid Glass material over `ground`: `panel-1`/`panel-2` with hairline `#34382F` borders. No gradients across faces, no glow, no neon, no rounded-blob decoration.
- The mark appears **once**, in the hero lockup. Nowhere else on the page — not in the footer, not in the nav, not as a bullet.
- **Signature moment:** the live evidence. Real transaction hashes, real blocks, set in monospace like an engraving. This — not an animation, not an illustration — is the page's jewel.
- Links and the single primary action use `emerald-text` `#2FB37C`. Gold appears at most once: one eyebrow label or one key detail.
- One idea and one primary action per screen. Generous whitespace is a feature; do not fill it.

### 6.2 See-through AR glasses UI (RayNeo Air — additive waveguide)

**This surface obeys physics, not the web material.** The display is additive: light is added to the wearer's view of the real world, and **pure black renders as transparent**. Therefore:

- **Canvas is pure black `#000000`, which the wearer experiences as clear glass.** There is no `ground`, no panels, no glass material — the real world is the background.
- **No content greys, ever.** A mid-grey is a half-bright smear floating over reality. Every content element is either off (black) or fully saturated at high luminance. One functional grey exists and only one: the `meter-track` `#6E6E6E` unfilled ring outline specified in the surface spec, whose whole job is to sit just above the dissolve threshold.
- **AR palette (separate scale, tuned for additive light):** the authoritative set lives in the surface spec, **`docs/designs/glasses-ui.md` §1** — emerald `#1FE894` (13.0:1 on black), gold `#FFC45C` (13.3:1), text `#F1F3ED` (18.8:1), signal red `#FF4D5E`, guide cyan `#4DD8FF`, meter track `#6E6E6E`. These are luminous tints of the brand hues, raised for light emission, and they belong to this surface only: emerald holds the brand's green direction (≈155°) and gold its warm direction (≈38°); the cyan and the red are functional signals, deliberately outside the brand hues. One owner: the surface spec wins. This book states the intent only — higher luminance than the web scale, and every rendered element's dominant channel at 30% of full scale or above (the surface spec defines that floor precisely; it is an sRGB channel value, not WCAG relative luminance) — and defers the values.
- All content sits in the **central safe area**; nothing critical near the lens edges.
- The approval is the whole UI when it appears: amount, recipient in plain words, and the head-turn check. One screen, one decision, then it is gone. The glasses never become a dashboard.
- **Signature moment:** the amount in treasury gold on the approval — the one warm light in the wearer's field of view. The mark itself never renders in the waveguide; at this fidelity the iris survives only as the memory of it.
- **Vocabulary on this surface is the brand's, not the engine's:** the tiers are **Everyday spends / Your call / A bigger decision**, the head-motion check is the **Head-turn check**, the approval screen is simply **Approval**, the offline state is **Paused**, and World ID is the **identity check** (the World app may be named where the wearer must physically open it). The motion gate, the signer, the facilitator, and the protocol names never appear.

### 6.3 Social / OG / cover lockup

The canonical raster is `brand/0gaze-cover-640x360.png`. Its recipe, so future covers match:

- Near-black ground; the lockup is a single horizontal group, **centered on the canvas** with equal side margins.
- Mark on the left, Ø ≈ 40% of frame height; gap of ≈ 0.4 × mark Ø to the text block.
- Text block, all left-aligned on one shared edge, top to bottom:
  1. **Wordmark** `0gaze` — outline artwork, never set in live type; heavy rounded sans, lowercase, `0` in emerald and `gaze` in ink, with the letterforms locked as drawn in the canonical cover.
  2. **Tagline** *Zero external gaze.* — italic serif (Georgia), **ink** `#F1F3ED`, sentence case, terminal period. The mark's iris is the cover's one gold moment; a gold tagline would spend gold twice (§4.4) and gold is never words that must be read.
  3. A hairline emerald rule the width of the text block.
  4. **Descriptor** `PRIVATE AGENT PAYMENTS ON 0G` — small caps, tracked out, muted ink.
- The cover is the one surface where mark, wordmark, tagline, and descriptor all appear together. Nothing else joins them — no URL, no date, no partner badges in the artwork.
- OG exports at 1200×630 keep the same recipe, re-centered on the wider frame: the mark keeps its 40%-of-height diameter, the side margins grow, and nothing scales non-uniformly. Mark clearspace (§3.3) is respected against the frame edges.

### 6.4 Docs and submission video

Restraint: ink on paper or ground, the mark once (title frame or title page), evidence in monospace, the descriptor used sparingly. The video's end card is the cover lockup, unmodified.

---

## 7. Do / Don't gallery (in words)

**Do** let one screen say one thing. **Don't** stack three features into a hero.

**Do** set a real transaction hash in quiet monospace and let it carry the proof. **Don't** illustrate "security" with padlocks, shields, or glowing vaults.

**Do** draw icons as single-weight line glyphs from the product's own vocabulary — an arrow, a check, a ring, a dot, the chip drawn as a plain rectangle. **Don't** mix filled and outlined sets, use illustration-style spot art, or import an icon library whose stroke weight contradicts the type.

**Do** use gold the way jewelry is used — one small, deliberate point. **Don't** paint sections gold, gradient gold, or use it for body text.

**Do** say "the chip that holds the money." **Don't** say "hardware signer," "custody solution," or "EIP-3009."

**Do** leave the mark alone on the page, once, with its clearspace. **Don't** repeat it in the footer, watermark it behind text, or shrink it into a bullet.

**Do** say "testnet funds — practice money only" plainly where money appears. **Don't** bury it or make it apologetic.

**Do** write "Your agent is paused. Nothing moves until the connection is back." **Don't** write "Safe-stop engaged" or let the agent fake progress offline.

**Do** keep the glasses UI to a single approval floating in darkness. **Don't** port panels, cards, or greys from the web material into the waveguide.

**Do** end the pitch video on the cover lockup. **Don't** end it on a feature list.

---

## 8. Tagline system

### 8.1 Primary (kept)

**Zero external gaze.**

It is the product's whole argument in three words, it decodes the name, and it already lives in the cover lockup. Keep it exactly: sentence case, terminal period, gold italic serif in lockups.

### 8.2 Alternates, ranked

1. **Only your eyes approve.** — The most human of the set; names the mechanism (eyes-only approval) as a benefit. Best for the hero of the public page if the primary ever feels abstract.
2. **Your money. Your agent. Your eyes only.** — Triple rhythm, ownership-forward; strongest for social and the video, where repetition carries. Slightly longer, so it never replaces the primary in the lockup.
3. **An agent that spends. A gaze that doesn't leave you.** — The most poetic; reserve for the submission video narration or a long-form README, where cadence has room.

### 8.3 One-line product descriptor

**Private agent payments on 0G** — set in tracked small caps under the lockup. This is the canonical descriptor (already on the cover); it is the only descriptor. When a sentence is needed instead: *"0Gaze is a private AI agent that holds and spends money — with the key in a hardware chip and approvals only you can see."*

---

*Questions of taste this book doesn't answer default to the contract (`brand-brief.md`), and then to the spine: an eye that only the wearer has.*
