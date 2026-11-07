/**
 * Episode log: one record per decision, the "must show" for 0G Physical AI.
 *
 * Every run writes a JSON line to the local journal (data/episodes.ndjson) —
 * the safe-stop guarantee: when 0G Storage is unreachable the episode still
 * lands locally and the payment continues. When a funded storage key is
 * configured, the same record is also uploaded to 0G Storage (Galileo
 * testnet) and the root hash is recorded in the journal.
 */
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export interface Episode {
  ts: string;
  episodeId: string;
  prompt: string;
  artifactSha256: string;
  model?: string;
  requestId?: string;
  providerIdentity?: string;
  costUsdMicro?: string;
  tier?: string;
  approval: { how: string } | { reason: string };
  signerAddress?: string;
  txHash?: string;
  network?: string;
  merchant?: string;
  /** Motion evidence captured from the wearer's glasses (bench gate). */
  motion?: MotionEvidence;
  /** The guided head-motion challenge the wearer performed, if any. */
  gestureChallenge?: ChallengeEvidence;
  /** Set when the record reached 0G Storage. */
  storageRootHash?: string;
  storageTxHash?: string;
  /** ZKP witness binding (--zkp mode): sha256 of the phone's motion proof. */
  motionProofHash?: string;
  /** The Dabao's EIP-712 MotionProofWitness signature (hex). */
  witnessSignature?: string;
  /** The per-spend challenge embedded in the witness (bytes32 hex). */
  challenge?: string;
}

export interface StorageUploader {
  upload(payload: Uint8Array): Promise<{ rootHash: string; txHash: string }>;
}

/** Real glasses motion window attached to a decision. */
export interface MotionEvidence {
  source: "rayneo-air-imu";
  score: number;
  samples: number;
  liveHash: string;
  profileHash: string;
}

/** The guided head-motion challenge the wearer performed on the glasses. */
export interface ChallengeEvidence {
  source: "glasses-ui";
  sequence: string[];
  scores: number[];
  attempts: number;
}

/** Real 0G Storage uploader (Galileo testnet, turbo mode). */
export async function zgUploader(privateKey: string): Promise<StorageUploader> {
  const { Indexer, MemData } = await import("@0gfoundation/0g-storage-ts-sdk");
  const { ethers } = await import("ethers");
  const RPC_URL = process.env.ZERO_G_STORAGE_RPC ?? "https://evmrpc-testnet.0g.ai";
  const INDEXER = process.env.ZERO_G_STORAGE_INDEXER ?? "https://indexer-storage-testnet-turbo.0g.ai";
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(privateKey, provider);
  const indexer = new Indexer(INDEXER);
  return {
    async upload(payload: Uint8Array) {
      const mem = new MemData(payload);
      const [rootHash, err] = await indexer.upload(mem, RPC_URL, signer);
      if (err) throw err;
      // The SDK returns a plain {rootHash: string} for a single-segment upload.
      // It is not a MerkleTree with a rootHash() method.
      const value =
        typeof rootHash === "string"
          ? rootHash
          : (rootHash as { rootHash?: string } | null)?.rootHash ?? "";
      return { rootHash: value, txHash: "" };
    },
  };
}

export class EpisodeLog {
  private journalPath: string;
  private uploader: StorageUploader | null;

  constructor(journalPath = "data/episodes.ndjson", uploader: StorageUploader | null = null) {
    this.journalPath = journalPath;
    this.uploader = uploader;
    mkdirSync(dirname(journalPath), { recursive: true });
  }

  sha256(s: string): string {
    return createHash("sha256").update(s).digest("hex");
  }

  async record(ep: Omit<Episode, "ts" | "episodeId">): Promise<Episode> {
    const full: Episode = {
      ts: new Date().toISOString(),
      episodeId: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...ep,
    };
    const line = JSON.stringify(full);
    appendFileSync(this.journalPath, line + "\n");

    if (this.uploader) {
      try {
        const { rootHash, txHash } = await this.uploader.upload(new TextEncoder().encode(line));
        full.storageRootHash = rootHash;
        full.storageTxHash = txHash;
        // Visible in the demo console: the audit trail is anchored on 0G Storage.
        console.log(`[0g-storage] episode ${full.episodeId} pinned · root ${rootHash}`);
        // append the storage confirmation as a follow-up line so the journal stays append-only
        appendFileSync(this.journalPath, JSON.stringify({ ts: new Date().toISOString(), episodeId: full.episodeId, storageRootHash: rootHash, storageTxHash: txHash }) + "\n");
      } catch (e) {
        // safe-stop: never let a storage failure break the payment loop
        const why = (e as Error).message.slice(0, 200);
        console.log(`[0g-storage] upload failed (journal kept locally): ${why}`);
        appendFileSync(this.journalPath, JSON.stringify({ ts: new Date().toISOString(), episodeId: full.episodeId, storageError: why }) + "\n");
      }
    }
    return full;
  }

  readAll(): Episode[] {
    if (!existsSync(this.journalPath)) return [];
    // A crash mid-append leaves a partial last line; skip unparseable lines
    // instead of throwing — the episode review must not die on one bad row.
    const out: Episode[] = [];
    for (const l of readFileSync(this.journalPath, "utf8").split("\n")) {
      if (!l) continue;
      try {
        out.push(JSON.parse(l) as Episode);
      } catch { /* partial/corrupt line */ }
    }
    return out;
  }
}

/** Build the log from the environment: 0G Storage when a funded key exists, else local-only. */
export async function episodeLogFromEnv(journalPath?: string): Promise<EpisodeLog> {
  const key = process.env.ZERO_G_STORAGE_PRIVATE_KEY ?? process.env.ZERO_G_WALLET_PRIVATE_KEY;
  if (!key) return new EpisodeLog(journalPath);
  try {
    return new EpisodeLog(journalPath, await zgUploader(key));
  } catch (e) {
    console.warn("[episode-log] 0G Storage unavailable, logging locally:", (e as Error).message.slice(0, 120));
    return new EpisodeLog(journalPath);
  }
}
