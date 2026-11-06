# ETHGlobal Mumbai 2026 submission

## Project

**Name:** EyesOnly

**One-line pitch:** A private AI agent that thinks on 0G, proves the wearer is present with a motion ZKP, and pays through a Dabao hardware signer, with approvals visible only inside RayNeo AR glasses.

**Public repository:** https://github.com/ivcained/eyesonly

**Live deployment:** https://ivcained.github.io/eyesonly/

## Submission requirements

| Requirement | Status | Evidence / next step |
|---|---|---|
| Public GitHub repository | Done | https://github.com/ivcained/eyesonly |
| Frequent public commits | Done and ongoing | Existing implementation history pushed; continue pushing each verified change |
| Live deployment accessible publicly | In progress | GitHub Pages workflow deploys `site/` on every main push |
| Demo video on ETHGlobal.com | Pending | 2–4 minutes, at least 720p, narration with no music |
| Completed submission form | Pending | Owner submits on ETHGlobal.com using this file and the links above |

## Sponsor submissions

1. **0G Physical AI** — real sealed inference inside the decision loop, per-request trace IDs, episode logging, and local safe-stop.
2. **World ID Agent Pass** — above-cap identity gate and the denied path. Proofs are explicitly mocked where the hackathon requires it.
3. **Whitechain Scale** — actual hardware-signed EIP-3009 payments settling USDT through our facilitator on Whitechain Sepolia.

## Live proof transactions

- First real-chip payment: https://explorer.testnet.whitechain.io/tx/0xc765630294e801e2c1cf80efa4dfd9a1206b6533a5976969a01ff71190d690ca
- Real 0G inference paid by the chip: https://explorer.testnet.whitechain.io/tx/0x2cb94dd11edcb3c2ee11c7e304e974bfa847de99a24c911901089d3379266e2e
- Full loop and safe-stop: https://explorer.testnet.whitechain.io/tx/0x23c28fd3557b1125f705c4499218327b9d894e715ac4d8e4ba8bdb7eee29d376

## Video outline (target: 2:45)

1. **0:00–0:20 — Problem:** an agent can think, but nobody should hand it a seed phrase.
2. **0:20–0:45 — Product:** glasses-only approval, Dabao hardware key, three-tier spend rule.
3. **0:45–1:35 — Live payment:** prompt → real 0G response → chip signature → Whitechain receipt.
4. **1:35–2:10 — ZKP presence:** real proof → verification → Dabao witness signature → tamper rejection.
5. **2:10–2:30 — Failure paths:** motion mismatch / World ID denial and local safe-stop.
6. **2:30–2:45 — Close:** six privates and the links to code and public proof.

Record narration only, no music. Capture at least 1280×720; 1920×1080 preferred.

## Final pre-submit checks

- [ ] Public page loads in a signed-out browser and all transaction links resolve
- [ ] Video is uploaded to ETHGlobal.com and plays with audible narration
- [ ] Repository README links to the live page and explains exactly what is real vs. mocked
- [ ] All sponsor-specific forms and debriefs are completed
- [ ] Submission form saved early; continue edits until the deadline
