# World ID Integration Debrief

Team 0Gaze — written honestly at the deadline, from the code and what we
actually exercised.

## What the integration is

The agent acts as the relying party and keeps the human in the spend decision:

1. **Request binding (`signApprovalForWorldId`)** — before asking the World
   App for a proof, the agent signs the request with the RP signing key
   (HMAC-SHA256 over `action:nonce:created:expires`, 5-minute expiry) so a
   returned proof is bound to this specific spend decision and cannot be
   reused for a different one. The nonce is per-spend.
2. **Proof verification (`WorldIdVerifier.verify`)** — the forwarded proof is
   sent as-is (no field remapping) to the Developer Portal
   `POST /api/v4/verify/{rp_id}`; the nullifier is extracted for replay
   protection so the same human cannot approve the same spend decision twice.
3. **Fail-closed** — with `WORLD_ID_RP_ID` / `WORLD_ID_RP_SIGNING_KEY` unset,
   verification returns a structured `denied (not_configured)`, and the agent
   declines the spend. A missing credential can never become an approval.

## Where it fits in 0Gaze

World ID is the *escalation* tier, not the primary gate. The primary approval
is the wearer's calibrated head-gesture challenge on the glasses, signed by
the Dabao chip. World ID answers a different question — "is a unique human
present and reachable with a phone?" — and the design escalates to it when
the gesture tier fails repeatedly (e.g. glasses not worn) or for
recovery-grade operations. Both layers share the same fail-closed rule.

## Honest status

- Implemented: request signing, v4 verification, nullifier handling, and the
  unconfigured → deny fallback, all in `agent/worldid.ts`.
- The gesture gate on the glasses was our demo path, so we did not run a
  live end-to-end World App proof during the event window; verification of a
  real proof against the Developer Portal is the one step we would exercise
  before enabling the escalation tier in production.
- The World App side (Mini App / phone bridge) was descoped with the phone
  bridge — the glasses display carries the approval UI instead.

## What we would say to the World team

The v4 verify endpoint's contract (send the proof untouched, get
`{success, code, detail, nullifier}`) is refreshingly boring — that is praise.
The one friction: the request-signature (`rp_context`) conventions are
SDK-side knowledge that a small reference for non-JS backends would remove.
