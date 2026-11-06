# 0Gaze Voice and Tone

*How 0Gaze sounds. Companion to `brand-book.md`; the vocabulary table there is canonical for names, this volume is canonical for sentences. Version 1.0 — 2026-11-06.*

---

## 1. The voice in one breath

Calm, certain, quietly premium. 0Gaze speaks like a person you would trust with your wallet: unhurried, exact, and warm without being chummy. It never sells, never shouts, and never hides behind jargon. When the system does something remarkable, the copy stays plain — the evidence (a real hash, a real receipt) does the impressing.

**Three tests for any sentence:**

1. Could a non-crypto person read it aloud without stumbling?
2. Does it leave the wearer feeling in control?
3. Is there a shorter way to say it?

If any answer is no, rewrite.

## 2. Principles

**ELI5, always.** No protocol or engineering vocabulary in user-facing copy. The reader should never need to know what a private key is.

**Control framing.** Every approval message leads with the wearer's choice: "You approve first," "Your call," "Nothing moves without you." The agent is capable; the wearer is in charge.

**One idea, one action.** A screen says one thing and asks for one thing. If a message needs "and" twice, it is two messages.

**Honesty about money.** Amounts in dollars. Testnet status stated plainly where money appears: "practice money only — nothing here is real money yet" on product surfaces, "testnet funds only" on the public proof page and in docs. Said once, unapologetically, never buried.

**Infrastructure is invisible.** The relay, the facilitator, the settlement chain — none of it is a headline. Users meet outcomes, not plumbing.

**Banned words and phrases (user-facing):** *scopes, TTL, signer, gasless, EIP-3009, x402, facilitator, zero-knowledge, ZK, biometric, custody, wallet connect, seed phrase, seamlessly, revolutionary, cutting-edge, trustless, decentralized finance, DeFi, Web3, crypto* (the product handles it; the user shouldn't have to name it). Also banned: exclamation marks in system copy, and the word "just" when it minimizes ("just approve" → "approve").

**Tone dials:** default is calm-certain. Under error or denial, warmer and more specific — never alarming, never blaming. In evidence contexts (hashes, receipts), tone disappears entirely: monospace, no adjectives.

## 3. Surface-by-surface copy, do and don't

### 3.1 Onboarding and enrollment

**Do**
> Meet your agent. It can hold money and spend it on your behalf — and every spend above your everyday limit waits for your approval, in your glasses, where only you can see it.

> The chip that holds the money made its own key, inside itself. It has never been anywhere else. You never have to see it, save it, or type it.

> Now, enroll your head-turn check. Move your head naturally for a few minutes. This is how your agent learns that it's really you wearing the glasses.

**Don't**
> Generate a seed phrase and store it securely. Your Dabao hardware signer will derive keys in secure slots.

> Please complete biometric enrollment for the zero-knowledge motion gate.

### 3.2 Spend tiers

The three tiers, in wearer-facing words (canonical names from the brand book):

**Everyday spends (below the floor)**
> **Do:** "Under a few cents, your agent pays on its own and shows you the receipt after. You can change this limit anytime."
> **Don't:** "Auto-approve floor engaged at $0.05."

**Your call (floor to cap)**
> **Do:** "This one is your call. $18.50 to the translation service. Look at the approval in your glasses to decide."
> **Don't:** "A signature request requires mid-tier authorization via EIP-3009."

**A bigger decision (above the cap)**
> **Do:** "For a bigger decision like this one, your agent asks you to prove it's you first."
> **Don't:** "World ID verification is required for above-cap spends."

### 3.3 The approval (in the glasses)

The approval is the product's most intimate moment. Copy is sparse, factual, and centered on the decision.

**Do**
> $18.50
> Translation service — 400 pages
> Turn your head to confirm it's you.

After a pass:
> Approved. $18.50 paid. The receipt is in your records.
>
> **On the glasses surface** (the canonical strings there, sparse for the waveguide):
>
> Approved — $0.10 for your agent's thinking
> You stay in control.
>
> The longer line above is for web, docs, and narration; the glasses get the short pair.

**Don't**
> Payment request detected! Please authorize this transaction.

> Motion gate PASSED — EIP-712 witness bound, Groth16 proof verified.

(That proof may exist. It belongs in the monospace evidence line on the web page, not in the wearer's field of view.)

### 3.4 The head-turn check

**Do**
> A small turn of your head tells your agent it's you.
>
> **On the glasses surface:**
>
> That didn't move like you
> No money moved.
>
> "That didn't move like you" is motion-specific and blame-free; it replaces "That didn't look like you" wherever the rejection came from the motion check.

> That didn't look like you. Try again, or prove it's you with an identity check.

**Don't**
> Biometric authentication failed. Liveness score below threshold.

Never say "biometric," "liveness," or "scanning." The wearer turns their head; the system notices the way they move. That is all the copy owes.

### 3.5 Denied paths (wrong wearer)

Warmth matters most here — the person holding the glasses may be a friend, not an attacker.

**Do**
> This doesn't look like the person this agent belongs to. Nothing was spent. If this is your agent, start with a fresh identity check.
>
> **On the glasses surface:**
>
> That didn't move like you
> No money moved.
> Try again · Verify it's you
>
> Same moment, fewer words. The long line is for docs and support.

**Don't**
> ACCESS DENIED. Motion proof mismatch. World ID re-verification required.

### 3.6 Paused (offline safe-stop)

**Do**
> Your agent is paused. Nothing moves — and nothing is spent — until the connection is back.
>
> **On the glasses surface:**
>
> Your agent is paused
> It can't spend or decide anything until it's back.
> ● paused
>
> The glasses line drops the dash clause; "can't spend or decide" carries it in plain words.

> Still offline. Your agent is waiting, not guessing.

**Don't**
> Safe-stop triggered. Agent loop halted pending storage availability.

> Reconnecting… your agent is working in the background. *(It is not. Never imply decisions it cannot make.)*

### 3.7 Receipts and evidence

**Do**
> Every spend leaves a receipt only you can read.

> Paid $0.02 for this answer. Receipt: `0x8f3a…c41d` — yours to check, anytime.

**Don't**
> Transaction settled on Whitechain Sepolia via the facilitator with request ID logged to 0G Storage.

On the public proof page, evidence appears in monospace with **no adjectives**: hash, block, amount. The engraving speaks for itself.

### 3.8 Testnet honesty

**Do**
> Practice money only — nothing here is real money yet.

**Don't**
> *Disclaimer: testnet environment. Tokens have no monetary value.*

### 3.9 Public page hero

**Do**
> # Zero external gaze.
> A private agent that holds and spends money. The key lives in a chip and never leaves it. Approvals appear only in your glasses. Every spend leaves a receipt.

**Don't**
> # The future of agentic payments
> Seamlessly combining zero-knowledge biometrics, hardware custody, and x402 micropayments on Whitechain Sepolia.

### 3.10 Error and recovery, general

**Do**
> That didn't go through. Nothing was spent. Try again when you're ready.

**Don't**
> Transaction failed: nonce too low. Error 0x6a80.

Errors state three things in this order: what happened, what it means for the wearer's money (almost always "nothing was spent"), what to do next. No codes unless the wearer can act on them; real codes live in monospace in the records.

## 4. Microcopy standards

- **Buttons:** verbs, two words max. *Approve*, *Decline*, *See receipt*, *Change limit*. Never *Submit*, *Confirm transaction*, *OK*.
- **Amounts:** dollars, `$18.50`. No token tickers in user copy.
- **Time:** human words. "asks again in 90 days," not "TTL 90d."
- **The agent** is "your agent," never "the AI," never a name with a personality. It is competent and quiet, like good staff.
- **The wearer** is "you." The chip is "the chip that holds the money" on first mention, "the chip" after.
- **Punctuation:** periods at the end of complete sentences, including the tagline. No exclamation marks in system copy. No ellipses that imply hidden work ("Thinking…" is fine; "Verifying zero-knowledge proof…" is not).

## 5. What premium sounds like

Premium is the confidence to be short. Compare:

> "We're excited to announce that 0Gaze leverages cutting-edge hardware security to keep your assets safe!"

> "The key is made inside the chip. It never leaves."

The second sentence is the brand. Say less, mean all of it, and let the receipts prove it.
