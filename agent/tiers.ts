/**
 * The three-tier spend rule.
 *
 *   amount < floor        -> "auto"    the agent pays without asking; logged
 *   floor <= amount <= cap -> "motion"  the phone's motion gate must pass
 *   amount > cap          -> "worldid"  motion gate AND a fresh World ID check
 *
 * Amounts are USDT with 6 decimals, as bigint base units. The defaults match
 * the design document: floor $0.05, cap $25.
 */
export type SpendTier = "auto" | "motion" | "worldid";

export interface TierConfig {
  floor: bigint;
  cap: bigint;
}

export const DEFAULT_TIERS: TierConfig = {
  floor: 50_000n, // 0.05 USDT
  cap: 25_000_000n, // 25 USDT
};

export function classifySpend(amount: bigint, tiers: TierConfig = DEFAULT_TIERS): SpendTier {
  if (amount < 0n) throw new RangeError("amount cannot be negative");
  if (amount < tiers.floor) return "auto";
  if (amount <= tiers.cap) return "motion";
  return "worldid";
}

export function describeTier(tier: SpendTier): string {
  switch (tier) {
    case "auto":
      return "auto-pay (below floor, logged)";
    case "motion":
      return "motion gate required";
    case "worldid":
      return "motion gate + World ID required";
  }
}
