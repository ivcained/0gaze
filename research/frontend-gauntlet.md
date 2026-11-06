# 0Gaze — Frontend Gauntlet (site/index.html)

*Run 2026-11-07. Bar: Linear's live product page at 1440×900 and 390×844, plus the Solid Glass blocks gallery as the material reference. Critics were three independent vision agents with fresh context; ours was presented blind among the references.*

## Method, and one measurement caveat

Screenshots were taken with headless Chrome at `--window-size=1440,900` and, for mobile, through a 390 px iframe wrapper. Reason: headless Chrome on macOS enforces a **500 px minimum window width**, so a `--window-size=390` capture renders at 500 and crops to 390. That artifact produced a false "mobile text overflow" finding in the first pass; re-measuring inside a real 390 px viewport showed `innerWidth == scrollWidth == 500` for the probe and no overflow in the iframe render. Any future mobile screenshot in this repo must go through `wrap390.html`, not `--window-size=390`.

## Round 1 — verdicts and disposition

| # | Critic | Verdict | Action |
|---|---|---|---|
| 1 | Agency UI Designer (blind A/B/C + mobile) | best desktop: **the Solid Glass blocks gallery**; best mobile: **ours**. Biggest gap: "no primary CTA in the hero" | **Applied in part** (see below) |
| 2 | Agency UI Finish-Gate Reviewer | most owned: **ours**; most generic: the blocks gallery. One fix: strip gradient hairlines and emerald edge-glow | **Applied in part**, one finding rejected with evidence |
| 3 | Agency Accessibility Auditor | **PASS WITH FIXES**: zero contrast failures at pixel level; target sizes and small text to fix; DOM checks outstanding | **All applied** |

### Applied

- **The hero had no product anchor.** Half the viewport was empty black. The hero is now a two-column composition: copy left, the actual approval card right (amount, emerald ring, step dots, filled Approve, caption). This is the change the first two critics were circling.
- **One gold.** The header rule and the eyebrow were gold, on a page whose mark already spends the one gold on its iris (brand book §4.4). Both moved to hairline and muted ink. Gold now appears exactly once.
- **Canonical copy.** Descriptor eyebrow instead of "Private by design"; the tagline "Zero external gaze." in the Georgia italic the book sanctions; "tells your agent it's you" replacing the stronger identity claim; the stale "three-glance challenge" claim removed (the tier table puts a $0.10 approval at two glances, and the live take ran three — the copy now asserts no count).
- **Evidence as the jewel.** Explorer links set in monospace, 44 px hit rows; the primary CTA is the on-page proof, with the repo secondary.
- **Accessibility.** Approval targets raised to 44 px with a filled primary; meta and captions 13 → 14 px; eyebrow 13 px with looser tracking; the RPC status line is now a muted sentence with a dot marker rather than a green paragraph; skip link, section nav, and `theme-color` added.
- **Cross-surface token leak.** The page was using the waveguide palette (`#1FE894`) for the mock ring and step dots. The book says the AR tokens belong to the glasses surface only; both are now `--emerald-tint` `#2FB37C`.

### Rejected, with evidence

- **"The gesture ring is a gradient arc and cards carry emerald edge-glow."** `grep -n 'gradient' site/*.css site/index.html` returns zero gradients. What the critic saw is the Solid Glass rim: `inset 0 1px 0 rgb(255 255 255 / 0.14)` plus a hairline and a shade shadow. Nothing to strip.
- **"The mark appears twice — the wordmark's emerald 0 and the hero eye."** Brand book §2 and §6.3 set the wordmark's `0` in emerald as *text*, and §3.5 governs the **mark**, which appears once. Not a violation.
- **"Neither desktop page has a primary CTA."** The page has always had two; the critic was reading a crop that cut the CTA row. The CTA order was still worth swapping (proof first).
- **"Replace the mock with live evidence."** The page already carries a live-evidence section with explorer links and a browser RPC check. The card is a product vignette (what the wearer sees), not a substitute for the evidence.

## Round 2 — final blind A/B against Linear

Two fresh critics, ours blind among the pair at 1440 and 390. No Solid Glass gallery this time: it is a component catalog, not a comparable landing page, and round 1's critics kept judging the catalog as a product page.

| Critic | Verdict | Action |
|---|---|---|
| Agency UI Designer | **Linear wins 1440, ours wins 390.** The honest gap: Linear's hero shows a dense *real* product surface, ours showed a "fictional mock card" | **Applied**: the hero card now carries one real receipt (monospace hash, block number, explorer link) under the caption |
| Agency Finish-Gate Reviewer | "Could only be this product". Flagged an identity claim as overclaiming. **SHIP AFTER ONE FIX** | **Applied**: the head-turn step now reads "a tripwire, not a lock — large spends always need the identity check too" (product truth, `0gaze.md:119`); the "proves it's you" wording had already been changed |

Round 2 closed with no repeated biggest-gap, so the loop ends here. Residual judgement call, stated plainly: Linear's hero shows a real screenshot of its app because its product *is* a screen. 0Gaze's product is a field of view that only exists inside a waveguide, so the card is a reconstruction, not a screenshot. That is a category difference, not a craft gap, and it is why the receipt line matters: it is the one thing on that card a judge can verify.

## Verification

- `lintapple` against `site/ui-policy.json`: **0 findings, exit 0**, at 390 and 1440, dark.
- `ui-policy.json` gained `Georgia` and `Times New Roman` — the brand book sanctions Georgia italic for the tagline; without the declaration the audit reports a policy mismatch, not a defect.
- Reflow checked at **320 px** and 390 px: nothing clipped, nav wraps to one line, approval targets wrap 2-up then 1.
- DOM checks the auditor could not do from pixels: one `<h1>`, tagline is a `<p>`, five `<h2>` sections, `header` / `main` / `nav` / `footer` landmarks present, mockup is real DOM text (not an image), focus styles come from `solid-glass.css`.
