/**
 * End-to-end signing check without chain funds: take a signature produced by
 * the Dabao (real board or emulator) and run it through the facilitator's
 * verification, exactly as the merchant would.
 *
 *   node verify-burner-payment.mjs <signature-hex> <from-address>
 */
import { verifyPayment } from "./facilitator/whitechain.ts";
import fixture from "./fixtures/payment-emulator.json" with { type: "json" };

const sig = process.argv[2];
const from = process.argv[3];
if (!sig || !from) {
  console.error("usage: node verify-burner-payment.mjs <signature-hex> <from-address>");
  process.exit(2);
}

const m = fixture.message;
const payment = {
  x402Version: 2,
  scheme: "exact",
  network: "eip155:1874",
  payload: {
    signature: sig,
    authorization: {
      from,
      to: m.to,
      value: BigInt(m.value),
      validAfter: BigInt(m.validAfter),
      validBefore: BigInt(m.validBefore),
      nonce: m.nonce,
    },
  },
};

// Pin the clock to the fixture's validity window for this offline check.
const now = BigInt(m.validAfter) + 60n;
const result = await verifyPayment(payment, { payTo: m.to, minAmount: BigInt(m.value) }, undefined, now);
console.log(JSON.stringify(result));
process.exit(result.ok && result.signer.toLowerCase() === from.toLowerCase() ? 0 : 1);
