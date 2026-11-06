# 0Gaze Brand Brief — the shared contract

* Status: **Pinned by the owner's direction (2026-11-06). Specialists treat this as the contract; propose refinements, never silent overrides.**
* Direction from the owner: **minimal, classic, premium. Top-notch.**
* **Authority order:** this brief pins the direction; `brand/brand-book.md` (written after this brief) owns the final names, hexes, contrast ratios and product vocabulary; `docs/designs/glasses-ui.md` owns the additive-display surface (its §1 color tokens win over the book for the waveguide). Where the two documents disagree, the surface spec wins for its own surface and the book wins for vocabulary.

## Product (one paragraph, canonical)

0Gaze is a private AI agent that can hold and spend money. The wallet key is born inside a Dabao hardware chip and never leaves it. Spending approvals render only inside the wearer's RayNeo AR glasses — no screen, log, or bystander ever sees them. A head-motion profile proves the enrolled human is present at each approval; World ID gates large spends. The agent pays for its own sealed 0G inference per request over x402, settling on Whitechain Sepolia. Built for ETHGlobal Mumbai 2026.

Audience after the demo: a non-crypto person who wants "a hardware wallet with a motion layer" and an agent that handles things — without knowing what a private key is.

## Name

- **0Gaze** — always this capitalization in prose: "0Gaze". The wordmark splits the "0" (brand emerald) from "gaze" (ink).
- The former working name **EyesOnly is dead** — it must not appear anywhere in shipped surfaces.

## The mark (do not redraw)

`brand/0gaze-mark.svg` — a sealed ring (the zero) whose interior is an eye; solid gold iris. Colors: emerald `#0B7C50`, gold `#B78B45`. Concept: "zero external gaze" — an eye that only the wearer has. It appears **once per page** (hero / lockup); it is never tiled, never watermarked, never repeated as decoration.

## Palette (dark-first; the brand book may refine tints, not hue direction)

| Role | Value | Notes |
|---|---|---|
| Ground | `#0B0C0A` | near-black with a green tint |
| Panel | `#151713` / `#1B1E18` | two thicknesses |
| Ink | `#F1F3ED` | warm off-white |
| Muted ink | `#A9AFA2` | secondary text |
| Hairline | `#34382F` | borders, dividers |
| Brand emerald | `#0B7C50` (mark) → accessible tint for text/links on dark (target AA) | the primary accent |
| Gold | `#B78B45` (iris) → sparing accent | eyebrows, key labels, one moment — never body text |

Chartreuse `#d4ff3f` (a previous site accent) is **dropped** — it is the studio's house accent for other products, not 0Gaze's.

## Typography

System stack (SF Pro on Apple, Segoe on Windows) — no webfonts on the public page. Display sizes get tight negative tracking; lowercase-adjacent headings; generous whitespace. Monospace (ui-monospace/Menlo) only for evidence: transaction hashes, commands, request IDs. Premium comes from spacing and hierarchy, not from a display typeface.

## Voice

- ELI5: no protocol or engineering vocabulary in user-facing copy — never "scopes", "TTL", "signer", "gasless", "EIP-3009", "x402", "facilitator". Say "what your agent can do", "asks again in 90 days", "the chip that holds the money".
- One idea and one primary action per screen. Short warm sentences. "You stay in control / approve first" framing.
- Amounts in human units (dollars), testnet honesty kept ("testnet funds only" on the public page and in docs; refined in brand-book §2: product surfaces say "practice money only — nothing here is real money yet").
- Infrastructure achievements are not headline features.
- Tone: calm, certain, quietly premium. Never hype, never "seamlessly".

## Surfaces this brand covers

1. **Public proof page** — `site/index.html`, static single HTML on GitHub Pages (https://ivcained.github.io/0gaze/), no build step. Material: Solid Glass (dark adaptation).
2. **See-through AR glasses UI** — additive waveguide (RayNeo Air): pure black canvas, high-luminance saturated marks, central safe area. The web material does NOT apply there; see the waveguide rules in `docs/designs/glasses-ui.md`.
3. **Social / OG / covers** — lockup of mark + wordmark + tagline on near-black.
4. **Docs and submission video** — restrained: ink on paper/ground, mark once.

## What "classic, minimal, premium" means here (taste gate)

- Restraint over cleverness; one signature moment per page.
- The evidence IS the decoration: real transaction hashes, real blocks, set in monospace like an engraving.
- No gradients across faces, no glow, no neon, no rounded-blob decoration.
- Gold is jewelry, not paint: one label, one rule, one moment.
- Whitespace is a feature.
