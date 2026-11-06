/**
 * Verify 0G Storage upload end to end after the SDK return-shape fix.
 *   npx tsx scripts/verify-storage.ts
 */
import { episodeLogFromEnv } from "../episode-log.js";

const log = await episodeLogFromEnv("/Users/lc/Projects/eyesonly/data/episodes.ndjson");
const ep = await log.record({
  prompt: "storage verification after SDK shape fix",
  artifactSha256: log.sha256("storage-fix"),
  tier: "auto",
  approval: { how: "auto" },
  merchant: "local-test",
});

console.log(
  JSON.stringify(
    { episodeId: ep.episodeId, storageRootHash: ep.storageRootHash, storageTxHash: ep.storageTxHash },
    null,
    2,
  ),
);
process.exit(ep.storageRootHash ? 0 : 1);
