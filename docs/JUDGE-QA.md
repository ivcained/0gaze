# Judge Q&A prep — 0Gaze

Read this once before presenting. Every answer is grounded in something real
in the repo or on-chain; nothing here requires bluffing. Bold = the answer you
say out loud. *Italic = the follow-up if they push.*

---

## The 30-second pitch (memorize this one)

**"0Gaze is a private AI agent that can hold and spend money. The wallet key is
born inside a hardware chip and never leaves it. Every spend approval renders
only inside the wearer's AR glasses, and the wearer approves with a deliberate
head motion matched against their own calibrated signature. The agent thinks on
0G, pays per request over x402 in USDT on Whitechain, and every denial path
fails closed — an agent that can spend, and provably cannot overspend."**

---

## Concept & product

**Q: Why does this need to exist? Agents can already use API keys.**
**An API key is a bearer secret with no spending limits, no human presence, and no per-payment record. When an agent holds a key, a compromised host or a hallucinating loop drains the account silently. 0Gaze gives the agent a wallet whose key never touches the host, whose spends are gated on the human actually being present and consenting physically, and where every payment is an on-chain receipt paired with a journaled decision.**
*If they push: the closest existing thing is a corporate card with spend limits — but card rails can't do per-request authorization bound to a hardware key and a live human-presence proof.*

**Q: Who is this for?**
**Anyone running an agent that spends: inference, data APIs, services. Today that's developers; tomorrow it's consumers with personal agents. The glasses form factor is for people who want approvals to be private — nobody over your shoulder sees what you're approving.**

**Q: Why AR glasses instead of a phone app?**
**Two reasons. Privacy: the approval renders on a display only the wearer sees — a phone popup is visible to everyone around you and to every app with screen access. And presence: the glasses' IMU and proximity sensor prove the device is on a human head that's moving deliberately — a phone in a pocket can't prove presence.**

**Q: What's the business model?**
**The payment rail itself: the facilitator pattern generalizes to any merchant who wants to accept agent payments without custody risk. Longer term, the custody layer — hardware-gated agent wallets — is the product, and x402 makes every inference call a potential settlement.**

---

## 0G track (they will ask these)

**Q: What breaks if we remove 0G?** (required one-sentence answer)
**Everything after the prompt breaks: the agent's decisions come from 0G Private Computer, and the audit trail of why money moved lives on 0G Storage — remove 0G and there's no inference to pay for and no verifiable record of any spend.**

**Q: Is 0G actually in the decision loop, or just logging?**
**In the loop. Every take calls router-api.0g.ai for the inference the agent is buying, and the response's trace ID (x_0g_trace.request_id) is written into the episode record next to the settlement hash. In our journal, 0G request 6ed5058d… pairs with settlement 0xeabe0a… on the explorer. Inference is the product being purchased, not a decoration.**

**Q: Show me the episode log.**
**Episodes journal timestamp, verdict, 0G request ID, and settlement hash to data/episodes.ndjson, and episode roots anchor to 0G Storage. Root 0xaaa3cc31… was re-downloaded from 0G testnet storage nodes on the final morning and is byte-identical to the local journal.**

**Q: What happens when 0G is unreachable?**
**The provider retries three times with backoff, then throws. The loop journals an error episode and signs nothing — no payment, no fallback model, no faked decision. That's not theoretical: the "full agent loop with safe-stop" settlement 0x23c2…d376 is the on-chain record of that path exercised live.**
*This is their explicit disqualifier ("a fallback that fakes the decision disqualifies") — say the words "fails closed, journals the refusal" clearly.*

**Q: The iAI bonus — sign-in with 0G credits?**
**Not integrated; we spent the window on the hardware path instead. The architecture supports it: the spend ladder is provider-agnostic, so a user's daily iAI credits could fund the agent's compute account directly.**

---

## Whitechain track

**Q: Walk me through the payment.**
**The merchant answers the agent's request with a 402 and an x402 v2 quote — eip155:1874, official USDT. The Dabao chip signs an EIP-3009 transferWithAuthorization — typed data, on the board, key never leaves. Our facilitator verifies the signature, submits it, and pays the gas. USDT moves from the chip to the merchant; the wearer never holds WBT and never sees a chain name.**

**Q: You deployed no contracts. The requirement says contracts verified on the explorer.**
**Correct, and we disclose it in the README: EIP-3009 pull payments don't need a custom contract — the official USDT token IS the contract, and the track's own recommended idea is "pay-per-request APIs settled through a facilitator you run." We chose not to deploy a box-checking contract we don't need. What IS on the explorer: five hardware-signed USDT settlements, including a 0.10 USDT payment approved by head gesture — links are in the README.**
*If they push: we're happy to add an on-chain approval registry (motion-signature commitments) post-event; it's real utility, but it wasn't honest to rush unaudited Solidity on deadline day.*

**Q: How does the facilitator not get drained?**
**It only submits authorizations it received in exchange for a served resource, amounts are bounded by the merchant's quote, and EIP-3009 nonce plus validBefore/validAfter kill replay. The key is testnet-only with a small balance — worst case leaks gas, not funds under management. It's documented in merchant/facilitator/README.md.**

**Q: Why does this need a chain at all? Stripe could do agent payments.**
**A card rail can't give an autonomous agent a hardware-rooted, per-request, human-presence-gated spend with no stored credentials and no checkout session. Here the authorization IS the settlement — the agent's spending power is exactly as revocable as physical access to the wearer's glasses and chip. And every receipt is public and verifiable, which an agent economy needs and card statements don't provide.**

**Q: curl your live endpoint.**
**`curl -i https://0gaze.tech/generate` — a real 402 with an x402 v2 quote: chain eip155:1874, official USDT, resource 0gaze://generate, 0.01 USDT. Judges can decode it themselves.**

---

## World ID track

**Q: Did you actually verify a World ID proof?**
**The verification path is real, tested code — RP-signed requests binding action, nonce and a five-minute expiry, server-side verification against the v4 verify endpoint, nullifier extraction for replay protection. We did not run a live World App proof during the event, which the track itself anticipates — your page says proofs are mocked event-wide now. Everything is disclosed in docs/WORLDID-DEBRIEF.md, including what we'd exercise before production.**
*Never overclaim here. The honesty IS the qualification — they require the debrief.*

**Q: Where does World ID fit? It's not in your demo video's live path.**
**It's the escalation tier of a three-tier spend ladder: under 5 cents the agent pays silently; up to $25 my calibrated head-motion on the glasses is the gate; above $25, World ID — a unique human, proven present — must approve. The video shows the ladder; the motion tier is what fires at demo amounts. The gate code and its denied paths (worldid_denied, worldid_expired, not_configured → spend blocked) are in agent/gate.ts and gate.test.ts.**

**Q: Show me the denied path.**
**With RP credentials unset, verification returns a structured denial and the agent declines — a missing credential can never become an approval. gate.test.ts covers denied, expired, and not-configured; all fail closed with the action not occurring.**

**Q: Feedback for the World team?**
**The v4 verify contract is refreshingly boring — send the proof untouched, get success/code/nullifier. Two asks: a reference for the rp_context request-signing conventions for non-JS backends, and a device-code pairing flow for headless/wearable agents — our glasses could render the QR, the human confirms in World App, no browser redirect needed.**

---

## Security — the hard questions (they WILL ask)

**Q: Anyone can look left. How is a head gesture a biometric?**
**It's not "a head gesture" — it's YOUR gesture, matched against a signature calibrated from your own head: amplitude, speed, duration and rotation-vector envelopes per direction. Your look-left at 53 degrees, 84-125 degrees per second, in 500-700 milliseconds. A stranger's head produces similarity scores of 0.03 to 0.05 against that envelope — rejected by a factor of eight below the pass bar. And it's one factor: it only unlocks a chip signature for a bounded amount, on a device that must be on your head.**

**Q: Can someone replay my recorded motion?**
**Three layers. The challenge is fresh per spend. Capture is gated by an arming sequence — minimum card time, a measured stillness beat, then a countdown — so motion has to be deliberate and present-tense, not continuous. And the wear gate: a proximity sensor locks the challenge entirely when the glasses aren't on a head. A recording can't satisfy "on a head, still, then moving on cue."**

**Q: What about the nod-of-assent? I read the card and nod yes.**
**That's exactly why the arming gate exists. Capture is CLOSED while you read — your nod scores nothing because nothing is being scored yet. It opens only after stillness plus countdown, or auto-arms after five seconds so you can never be locked out. The instinctive nod is structurally impossible to count, not just unlikely.**

**Q: What if someone coerces me — "look left or else"?**
**Same threat model as any authentication: duress is a human problem. What 0Gaze adds is bounded blast radius — the spend ladder means a coerced gesture unlocks at most the motion tier ($25), not the wallet. Bulk funds belong in a 2-of-3 Safe where the chip holds only a float. That's on the roadmap, and it's the honest answer.**

**Q: The chip is the root of trust. What if the Dabao is compromised?**
**The Dabao runs xous on an ESP32-S3; the key is generated in its keystore and never leaves — we've never read it out, only requested signatures. Physical extraction of an ESP32-S3 is within a well-funded attacker's reach, so the burner model applies: testnets and small amounts, chip holds a float, Safe holds the rest. The security claim is "no remote/software compromise of the key," not "immune to a decapping lab."**

**Q: You loosened the matching threshold the morning of the demo (0.55 → 0.40). Doesn't that weaken the biometric?**
**It widens acceptance for the honest wearer — under recording pressure I move at 70% of my calibration amplitude, and the tighter bar denied me while strangers still scored 0.03-0.05, eight times below even the loosened threshold. The discrimination margin between wearer and stranger barely moved. In production the threshold is a policy dial per spend tier, not a constant.**

**Q: Your IMU stream lost 27.9% of samples once. Is this reliable?**
**That failure is why the stream-quality gate exists: the bridge was starved by machine contention, gestures fragmented, and the take was correctly DENIED — fail-closed did its job. We rewrote the bridge with bounded queues and dedicated writer threads (verified 496.8 Hz lossless under blocked stdout), and preflight now refuses to run on a degraded feed. The system's answer to unreliable input is to deny, not to guess.**

**Q: Why not just use Face ID / a fingerprint reader?**
**Those prove the device is unlocked, not that a human is present and consenting to THIS spend right now. The glasses path proves presence (on-head), attention (stillness arming), and intent (a deliberate motion bound to a fresh challenge) — continuously, without a sensor that only fires at unlock.**

---

## Technical deep-dives

**Q: How does the gesture pipeline actually work?**
**496.5 Hz gyro stream from the RayNeo IMU over USB, per-session median-bias correction, gaps under 250 ms bridged by holding the last rate. A segmenter emits closed sweeps only after a settle period; each sweep gets angle, peak rate, duration, smoothness, and a rotation vector classified against the wearer's calibrated directions. Junk filter: ambient noise (8-27°) and mirror-return sweeps are discarded before scoring. 92 tests cover it, plus offline replay tooling against a 490 MB real-motion recording.**

**Q: Why no nods in the vocabulary?**
**Worn devices read eye-line, not neck pitch — people turn their eyes, not their head, for vertical attention, and pitch on the face is dominated by walking and chewing. Yaw and roll are deliberate, distinctive, and comfortable. Four moves: look left, look right, bend left, bend right.**

**Q: What is x402, briefly?**
**An open standard for machine-to-machine HTTP 402 payments: the server answers a request with 402 and a signed quote; the client attaches a payment signature; the server verifies and settles. We run the whole loop: agent-side client, merchant quoting, and the facilitator that settles EIP-3009 authorizations on Whitechain.**

**Q: EIP-3009 replay protection?**
**The authorization carries a nonce and a validity window; the token contract marks the nonce used on execution. The facilitator additionally checks the amount and payee against the merchant's quote before submitting. Our relay has a harder rule too: it never replays a signing request after a USB disconnect, because a signature's outcome being unknown means a retry could double-pay.**

**Q: The Groth16 proof — what does it prove?**
**That a motion window matching the wearer's signature features was captured, without revealing the raw biometric window. Proven end-to-end with snarkjs (keygen, proof, verify, plus wrong-challenge and tamper rejection) and bound to a Dabao-signed EIP-712 witness. On-chain verification is Phase 2 — RIP-7212 or a verifier contract. It's disclosed as off-chain binding today, in the README.**

**Q: What's your test coverage?**
**159 tests green on the final morning: agent 38 (loop, gate, tiers, World ID denials), glasses 92 (segmenter, signature matching, flow, arming, stream quality), merchant 10 (quotes, verification, Whitechain integration), relay 19 (framing, HID recovery, re-enumeration). Plus the ZKP end-to-end and offline motion replay against recorded real data.**

---

## Demo & logistics

**Q: Can you demo it live?**
**Yes — full bench travels with one laptop, the glasses on USB-C, and the Dabao chip. Preflight gates everything (chip, relay, bridge stream quality, calibration, merchant, live 402) and refuses to start on a degraded feed. The take is one button: glasses off shows a red lock, putting them on starts the flow, one deliberate look left settles real USDT on Whitechain Sepolia, and the explorer receipt opens itself.**
*If they ask for a live demo and you have the bench: run it. Preflight takes 10 seconds. If you don't have hardware with you: the video plus `curl -i https://0gaze.tech/generate` live in a terminal is your fallback — the 402 is real and decodable in front of them.*

**Q: What if it fails on stage?**
**Then you see the product's actual behavior: every failure path fails closed and tells you why. Wrong motion, not worn, stream degraded, 0G unreachable — denial with a journaled reason, never a silent wrong answer. That's the design, not an excuse.**

**Q: Mirror mode in the video — you claim "only the wearer sees it" but the card is on your screen.**
**Fair catch, and it's disclosed in the README: the video records in mirror mode so one capture shows the wearer AND the terminal. The product path — proven on this hardware — runs the glasses as an independent display where the card renders on the glasses and nowhere else. Extended mode is one flag: `scripts/demo-video.sh --extended`.**

---

## What's next (they always ask)

1. **On-chip policy reasoning**: Needle 2 (45M-param tool-calling LLM, ~14 MB at 2-bit) on an N16R8-class board — the signer itself evaluates spends against your policy before signing, escalating to the glasses challenge only when uncertain. Roadmap in docs/SUBMISSION.md; the current Dabao's 8 MB flash can't hold it, which we measured rather than hoped.
2. **Custody at scale**: 2-of-3 Safe vault for bulk funds, chip holds a spending float; notarized macOS .dmg distribution.
3. **On-chain verification**: Groth16/RIP-7212 motion-proof verification in a contract, and an on-chain approval registry binding signature commitments.
4. **World ID device-code pairing** for wearable agents — QR on the glasses, confirm in World App.
5. **Encrypted profile blobs** on 0G Storage (episodes are plaintext metadata today).

---

## Trap discipline (three rules for the room)

1. **Never overclaim the mocked paths.** World ID proofs are mocked, ZKP binding is off-chain, the phone bridge is descoped. Every one is disclosed in the README's limitations — point at it proudly. Judges reward disclosed limits and punish discovered ones.
2. **Answer with the number.** 496.5 Hz. 0.03-0.05 stranger scores. Five settlements. 159 tests. $0.004 per inference call. Numbers end arguments.
3. **"Fails closed" is your spine.** Every hard question — coercion, replay, outage, stage failure — routes to the same true answer: the system denies and journals rather than guessing. Say it plainly every time.
