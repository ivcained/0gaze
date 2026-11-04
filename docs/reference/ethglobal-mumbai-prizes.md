# ETHGlobal Mumbai 2026 — Prize Tracker

Event: https://ethglobal.com/events/mumbai
Prizes page: https://ethglobal.com/events/mumbai/prizes
Total prize pool: **$144,500** across 12 sponsors (World expanded $7,500 → $12,500 with two new IDKit tracks; Chainlink expanded $1,500 → $5,000 on 10-23)
Snapshot taken: 2026-10-13 · Watcher: cron job polling the prizes page every 4h, auto-updates this note

## Status board

| Sponsor | Pool | Details live? | Note |
|---|---|---|---|
| World | $12,500 | ✅ full | [[#World]] |
| 1inch | $7,000 | ✅ full | [[#1inch]] |
| 0G | $15,000 | ✅ full | [[#0G]] |
| Uniswap Foundation | $15,000 | ✅ full | [[#Uniswap Foundation]] |
| Arc (Circle) | $15,000 | ✅ full | [[#Arc (Circle)]] |
| Hedera | $15,000 | ✅ full | [[#Hedera]] |
| Arkiv | $15,000 | ✅ full | [[#Arkiv]] |
| Whitechain | $15,000 | ✅ full | [[#Whitechain]] |
| Ethereum Foundation | $15,000 | ✅ full | [[#Ethereum Foundation]] |
| ENS | $10,000 | ✅ full | [[#ENS]] |
| Definitive | $5,000 | ✅ full | [[#Definitive]] |
| Chainlink | $5,000 | ✅ full | [[#Chainlink]] |

All 12 sponsors have published full details — the board is complete.

## Detailed prizes

### Arkiv — $15,000 (restructured 2026-10-28: was 2 tracks $8k+$7k, now 4 tracks + Swarm bonus, all 25/25/25/25 judged)

About: **Arkiv is the Web3 database** — an Ethereum-aligned DB-Chain. App data lives in Arkiv entities: payload + SQL-like filterable attributes, owned by a wallet, expires when you choose (Entity Expiration / Lifetime Extension). **Reads are public and need no API key.**

Common rules across ALL Arkiv tracks:
- Writes to Arkiv's current testnet via `@arkiv-network/sdk` (TypeScript, `npm install @arkiv-network/sdk viem`) or the JSON-RPC API; ≥1 user-facing feature/query reads from Arkiv
- README: writer wallet address(es) + one query judges can run
- `/arkiv/schema.md` (entities, fields, ownership, expiry) + `/arkiv/friction.md`
- **NEW: one file per judging criterion, at the path named next to it**, answering its questions with links, numbers, or a runnable query (e.g. `/arkiv/reach.md`, `/arkiv/why-arkiv.md`, `/arkiv/data-quality.md`, `/arkiv/how-you-use-arkiv.md`)
- Public repo, open-source license, AI usage disclosed; each team wins at most one Arkiv track prize
- **Arkiv + Swarm bonus ($1,000) can come on top**; Arkiv prizes count as ONE partner prize on ETHGlobal (doesn't burn one of your three picks)
- Eligibility (reworded on page 10-30): both Build on Arkiv (from scratch AND existing-projects tracks) and the Arkiv + Swarm bonus are open to existing projects that add Arkiv at the event

**Track 1 — 🪞 Mirror something Ethereum depends on ⸺ $4,000** (🥇 $3,000 / 🥈 $1,000)
- Pick public data Ethereum apps/devs rely on and mirror it into Arkiv entities anyone can query without asking you. Not Sourcify data (any chain) — their Sourcify mirror is the worked example (sourcify.arkiv.network).
- Ideas: token lists, chain/RPC registries, address labels, wallet ratings, function signatures.
- Data license must allow republishing (link it); import script in repo, re-runnable.
- Judging (each 25%, each needs its own md file): Arkiv feedback `/arkiv/friction.md` · Reach `/arkiv/reach.md` (who depends on the data today + who'd use your copy after) · Why Arkiv `/arkiv/why-arkiv.md` (what breaks if it sat in Postgres) · Data quality `/arkiv/data-quality.md` (freshness + filterability).

**Track 2 — 🧩 Build on Arkiv (from scratch) ⸺ $4,000** (🥇 $3,000 / 🥈 $1,000)
- New app whose data lives in Arkiv. Directions: agents (ephemeral coordination state — tasks/bids/claims that expire), markets (listings/offers expiring at deadline), publishing/media (posts, profiles, follows any app can read), names/identity (profiles keyed by ENS — pairs with the ENS bounty).
- Judging (each 25%): friction.md · reach.md · why-arkiv.md · how-you-use-arkiv.md (do filters/ownership/expiry fit the app; does each Arkiv feature change something users see).
- Not counted: SDK installed but never read; Arkiv as a log nothing reads.

**Track 3 — 🧩 Build on Arkiv (existing projects) ⸺ $4,000** (Continuity Track only, 🥇 $3,000 / 🥈 $1,000)
- Continuity-batch project: move part of its data into Arkiv at the event; only new work judged (README must state what existed vs what you added).
- Directions: data your users own (profiles/posts/settings tied to wallet, readable by other apps), shared state (listings/orders/tasks several parties query + expire), agent coordination state.
- Same judging criteria as Track 2 (friction/reach/why-arkiv/how-you-use-arkiv).

**Track 4 — 🛠️ Node tooling ⸺ $2,000**
- Tools for people running Arkiv nodes: operator dashboard (disk-full ETA + alert, per-method latency, peers, sync, CPU/mem) or slow-query finder (run only on your own node, never a public endpoint).
- Reference: nodes.arkiv.network shows community nodes from outside — show what only an on-node tool sees.
- Built from scratch in a NEW repo (a PR to an existing repo doesn't count); must work against a node in your demo (own machine OK).
- Judging (each 25%): friction.md · real-use `/arkiv/real-use.md` · what's new `/arkiv/whats-new.md` · easy-to-run `/arkiv/easy-to-run.md` (installable from README in minutes).
- ⚠️ Slow query shapes found go to Arkiv **privately** (how shared at the booth) — never in your public repo, friction.md, or demo.

**🐝 Arkiv + Swarm bonus ⸺ $1,000** (stacks on any track)
- Use Swarm (ethswarm.org) meaningfully: e.g. files users see stored on Swarm and referenced from Arkiv entities, or uploaded encrypted so only reference-holders can open. Best integration wins; the "To enter" instruction still names the from-scratch tracks (Mirror / Build on Arkiv / Node tooling) — but per the reworded intro, existing projects adding Arkiv at the event are also in the running.
- Requirements: project uses BOTH Arkiv and Swarm; README explains the Swarm use + one openable Swarm reference.
- ⚠️ Encrypted Swarm references contain their key and Arkiv entities are public — never store one raw in an entity; encrypt first or keep it off Arkiv.

Network: **Rabdi testnet, chain ID 7794095** (published inline on the prizes page 10-31 — replaces the earlier Tiramisu testnet, chain ID 7738577); test GLM from the faucet. Arkiv MCP + AI plugin for Claude Code / Codex.
- RPC: https://rpc.rabdi.db-chain.testnet.arkiv.network · Explorer: https://rabdi.explorer.arkiv.network · Indexer: https://indexer.rabdi.db-chain.testnet.arkiv.network · Faucet: https://hub.arkiv.network/faucet · Access keys: https://hub.arkiv.network/access-keys

Resources:
- Quickstart: https://docs.arkiv.network/start-here/installation/
- Docs: https://docs.arkiv.network · Discord: https://discord.gg/arkiv
- Faucet: https://hub.arkiv.network/faucet · Rabdi explorer: https://rabdi.explorer.arkiv.network · Tiramisu explorer (older testnet): https://tiramisu.explorer.arkiv.network
- AI tools (MCP + plugin): https://hub.arkiv.network/ai-tools
- Sourcify on Arkiv (example): https://sourcify.arkiv.network
- Community nodes reference: https://nodes.arkiv.network · node client: https://github.com/Arkiv-Network/arkiv
- Swarm: https://www.ethswarm.org · https://docs.ethswarm.org

### 1inch — $7,000

About: AI-optimized Web3 dev tools across 17 EVM chains + Solana. SDKs, contract protocols, APIs for DeFi swaps, self-custodial liquidity, onchain apps.

**Track 1 — 💧 Build an Aqua App ⸺ $5,000** (🥇 $2,500 / 🥈 $1,500 / 🥉 $1,000)
- Build a custom Aqua app implementing a sophisticated DeFi position
- SwapVM allowed: may modify SwapVM opcodes and define own instructions
- Final positions demonstrated via test scripts or a UI
- **SwapVM use scores higher in final judging**

Qualification requirements:
- Official Aqua/SwapVM contracts must be used (redeployments of a modified SwapVM contract allowed)
- Onchain execution of token transfers shown in final demo (local forks OK)
- Proper Git commit history — no single-commit entries on the final day

**Track 2 — 💦 Aqua App, Continuity Track ⸺ $2,000** (🥇 $1,500 / 🥈 $500)
- Same brief as Track 1, restricted to Continuity Track participants
- Same qualification requirements

Resources:
- SwapVM contracts: https://github.com/1inch/swap-vm/tree/main
- Aqua contracts: https://github.com/1inch/aqua
- Aqua SDK (TS): https://github.com/1inch/sdks/tree/master/typescript/aqua
- SwapVM whitepaper: https://github.com/1inch/swap-vm/blob/release/1.1/docs/whitepaper-swap-vm-1.0.pdf
- Aqua whitepaper: https://github.com/1inch/aqua/blob/main/docs/whitepaper-aqua-1.0.pdf

### Ethereum Foundation — $15,000

About: the **Access Layer team** — builds pieces that keep apps and wallets censorship resistant, open source, private, secure (**CROPS**) all the way to the user. At Mumbai they bring two: **Anon-RPC** (anonymizes a wallet's/app's RPC reads) and the **alternative mempool for EIP-8141 frame transactions** (transaction types the public mempool won't accept). Build with either, or any app where one CROPS property is the reason it exists.

**Track 1 — 🕶️ Best Use of Anon-RPC ⸺ $5,000** (🥇 $2,500 / 🥈 $1,500 / 🥉 $1,000)
- Use Anon-RPC as an app that consumes it, a new Anon-RPC worker producing anonymity, or both. Forking the anon-rpc harness to bring it to a new platform (or improve an existing one) also counts.
- Judging: end-to-end demo, UX quality, how much of the app's traffic goes through Anon-RPC (excluding some traffic OK if justified), shippability, technical depth.
- Requirement: app routes RPC reads through Anon-RPC **by default**; demo shows which calls go through it. For a worker/harness build, a simple demo app suffices.

**Track 2 — 🧩 Best Use of the Frame Transaction Alternative Mempool ⸺ $5,000** (🥇 $2,500 / 🥈 $1,500 / 🥉 $1,000)
- EIP-8141 frame transactions = native account abstraction (account's own code decides validity). Public mempool only takes the simple ones; the alt mempool (ERC-8421) takes the rest, with ERC-7562-style staking/reputation.
- Three build areas:
  1. Things only an alt mempool enables: sender privacy (EIP-8250 keyed nonces, EIP-8272 recent roots), paymasters, new transaction shapes
  2. Dev tooling: viem/ethers SDK, admission simulator, mempool monitoring
  3. Break the rules: DoS vectors, vulnerabilities, new rules, fuzzers
- Judging: creativity, usefulness, practicality, how well it works, relation to the alt mempool. (Starter links now published — see Resources.)
- Requirement: show real alt mempool usage — link to your admitted tx on the devnet explorer, or code that submits one; team must explain design/code/trade-offs.

**Track 3 — 🌾 Best CROPS App ⸺ $3,500** (🥇 $2,000 / 🥈 $1,000 / 🥉 $500)
- App, wallet feature, or dev tool where **one CROPS property is the reason it exists**, without giving up the other three. EF tooling optional.
- Ideas: fully self-recoverable wallet (no server/API/relayer), frontend that survives losing its domain/backend/RPC, server that learns nothing about who talks to whom, leak-detection tool, build-verification tool.
- Judging: end-to-end demo, **depth of the lead property (structural beats cosmetic)**, other three hold or trade-offs stated, UX, shippability. (Final review pending.)
- Requirements: FOSS repo (MIT/Apache/GPL/MPL) with runnable README; README must have a **"CROPS" section**, 1-2 lines per letter (C: what you control and what happens if it goes away; O: license + buildable from repo alone; P: what each third party learns; S: keys/data protection + trust assumptions); 3-min demo video showing the lead property's "moment it matters"; **no third-party trackers/analytics in the client**; keys/personal data stay on-device.
- **One EF prize per project** — you can submit to all EF tracks but placed in at most one; EF judges decide.

**Track 4 — 🌾 Best CROPS Upgrade to an Existing Project ⸺ $1,500** (Continuity Track only)
- Add one CROPS property to an existing project during the hackathon; show before/after. Same CROPS README section, 3-min before/after video, FOSS license, no trackers. Only new work judged. Same one-prize rule.

Resources:
- Anon-RPC: https://ethereum.github.io/anon-rpc/ · wallet guide: https://ethereum.github.io/anon-rpc/wallets/ · network guide: https://ethereum.github.io/anon-rpc/networks/ · GitHub: https://github.com/ethereum/anon-rpc
- Browser harness (npm): https://www.npmjs.com/package/@anon-rpc/browser-harness · extension harness: https://www.npmjs.com/package/@anon-rpc/browser-extension-harness
- Alt mempool devnet explorer: https://altmempoolexplorer.forshtat.com · gateway RPC: https://altmempoolgateway.forshtat.com · RPC: https://altmempool.forshtat.com
- Alt mempool docs: https://docs.altmempool.wtf/ · new devnet explorer: https://explorer.altmempool.wtf/ · starter page: https://www.altmempool.wtf/ · EIP-8141: https://eips.ethereum.org/EIPS/eip-8141 · ERC-7562 (staking/reputation): https://eips.ethereum.org/EIPS/eip-7562
- CROPS mandate: https://blog.ethereum.org/2026/03/13/ef-mandate · Privacy SDK Kohaku: https://github.com/ethereum/kohaku · Walletbeat: https://walletbeat.eth.limo · Scaffold-ETH 2: https://github.com/scaffold-eth/scaffold-eth-2

### Uniswap Foundation — $15,000

About: the Uniswap Protocol as a full-stack onchain finance platform — contracts v2/v3/v4, developer tools, APIs, Unichain. Build on shared, permissionless liquidity. (About text rewritten from the earlier foundation/grants blurb.)

**Track 1 — 🦄 Build with Uniswap ⸺ $10,000** (🥇 $4,000 / 🥈 $3,000 / 🥉 $2,000 / 🏅 $1,000)
- Build on or integrate any part of the Uniswap stack: Uniswap API, AMM (v2/v3/v4), CCA, or any other protocol component
- Includes new v4 hooks, extensions/improvements to official Uniswap repos, and ecosystem tooling

**Track 2 — 🦄 Build with Uniswap ⸺ $5,000** (Continuity Track only, 4 × $1,250)
- Same brief as Track 1, restricted to Continuity Track participants

Qualification requirements (both tracks):
- Public GitHub repo with open-source code
- **FEEDBACK.md file** in the repo
- Completed submission to the Uniswap Developer Feedback Form (https://developers.uniswap.org/hackathon-feedback) that links to your FEEDBACK.md
- Submissions without it are reviewed and audited before winners are finalized
- README must clearly point to relevant contracts and lines of code for integration verification

Resources:
- Docs: https://developers.uniswap.org/docs
- Developer Platform: https://developers.uniswap.org/dashboard/welcome
- Uniswap AI Skills: https://www.skills.sh/uniswap/uniswap-ai

### Arc (Circle) — $15,000

About: Circle's purpose-built, EVM-compatible L1, the "Economic OS for the internet". **Arc Studio** is the required starting point for every Arc prize: describe the app, Studio writes/tests the smart contracts and builds the app around it, with access to USDC, EURC, Gateway, CCTP, Wallets and other skills. State which bounty you're submitting for.

**Track 1 — 🏆 Best DeFi / Onchain Finance App Built End to End in Arc Studio ⸺ $3,000**
- DeFi/onchain finance app on Arc, settling in USDC or EURC. Looking for: trading (incl. tokenized RWAs), lending/borrowing/credit/collateral, payments & liquidity infrastructure (e.g. a credit co-op), neobanks.

**Track 2 — 🏆 Best Mobile Web Consumer Agent Using the Marketplace Discovery API ⸺ $3,000**
- Mobile web consumer agent: agent discovers services via the marketplace discovery API and pays in USDC on Arc, no crypto knowledge needed. Looking for: per-use Nanopayments, consumer controls (spend limits, approvals, history), mobile-first non-crypto UX. (API docs link still a placeholder "[Add API docs link.]".)

**Track 3 — 🏆 Best Smart Contracts with Advanced Stablecoin Logic, In Arc Studio ⸺ $3,000**
- Advanced programmable logic with USDC/EURC: conditional flows, onchain automation, multi-step settlement. Ideas: conditional escrow w/ dispute + auto-release, programmable payroll/vesting, treasury & payment splitting, software-to-software (agent) payments, crosschain conditional transfer (escrow on source, release on destination via Circle Forwarder — reachability from Studio "confirm"). Bonus for reusable contract designs.

**Track 4 — 🏆 Best Use of Bridge Kit for Non-USDC Assets, Built in Arc Studio ⸺ $3,000**
- App/protocol/dev tool using CCTP via Bridge Kit to make non-USDC assets meaningfully crosschain. Looking for: single simple crosschain user flow, new asset made crosschain, flows settling/pairing with USDC or EURC on Arc.

**Track 5 — 🏆 Arc Studio Continuity Track: Bring Your Project to Arc ⸺ $3,000** (Continuity Track only)
- Take an existing project (open-source repo or live product) and add a working Arc integration via Arc Studio. Looking for: USDC/EURC payment flows in commerce/fintech/wallet products, crosschain/unified balance in production, nanopayment infra in an AI agent or API monetization tool, stablecoin settlement/escrow in a DeFi protocol, Arc-powered treasury/FX in a live multichain product.

Qualification requirements (all tracks):
- **Built in Arc Studio** — include the Arc Studio project URL and show Studio in the demo
- Functional MVP + architecture diagram (working frontend and backend)
- Video demonstration + presentation: core functions + effective use of Arc Studio and Circle dev tools, with detailed documentation
- Link to GitHub/Replit repo

Resources:
- Arc Studio: https://studio.arc.com · Arc: https://arc.io

### Hedera — $15,000

About: EVM chain with a distinctive dev experience — Solidity or the JS SDK, plus Java, Python, Rust, Go, Swift SDKs.

**Track 1 — 🤖 AI Agents That Pay: x402 on Hedera ⸺ $6,500** (🥇 $3,000 / 🥈 $2,000 / 🥉 $1,500)
- x402 = HTTP 402 "Payment Required" revived: server quotes a price, client pays inside the request. No checkout, signup, or API key. On Hedera, x402 settles in HBAR or HTS tokens (incl. USDC) with low fixed fees, fast finality; the facilitator pays network fee so the paying agent doesn't need HBAR for gas.
- Build the agent economy: services that charge per request, agents that discover/compare/pay autonomously.
- Ideas: pay-per-call AI inference/data API; agent marketplace where agents hire agents via x402; metered MCP server charging per tool call; budget-aware research agent comparing paid sources; micropaywalls for creators; open-source Hedera x402 facilitator with safety checks + replay protection.
- Requirements: ≥1 x402-protected endpoint settling on Hedera testnet/mainnet via a documented facilitator (Official x402, Ax402, or Blocky402) or self-run; an agent/client that finds the endpoint and completes ≥1 paid request end-to-end with no human approving; public GitHub repo w/ README covering setup, architecture, payment flow, incl. the Hedera tx ID of a settled payment; demo video ≤5 min showing the payment settling, linked on HashScan.
- Extra points: agent spending controls (budgets, per-merchant limits, allowlists, human-in-the-loop above a threshold); agent identity/reputation via HCS-14 or ERC-8004; HCS topic as tamper-evident spending audit log; multi-agent negotiation (A2A/ACP) before payment; settling in HTS token (USDC) or HTS custom fees for revenue split; recurring/subscription payments via Scheduled Transactions; Hedera Agent Kit or Hedera Network MCP.
- Resources: x402 docs https://docs.hedera.com/solutions/ai/x402 (how-it-works, pay-with-x402, merchant-integration, facilitators, exact-scheme subpages) · x402 protocol repo https://github.com/x402-foundation/x402 · blog https://hedera.com/blog/hedera-and-the-x402-payment-standard/ · Agent Kit https://docs.hedera.com/solutions/ai/agent-kit · Network MCP https://docs.hedera.com/solutions/ai/hosted-mcp-server · Scaffold HBAR https://docs.hedera.com/solutions/tools/scaffold-hbar · Discord https://hedera.com/discord

**Track 2 — 🪙 Tokenize Anything with Hedera Studios ⸺ $5,000** (🥇 $2,500 / 🥈 $1,500 / 🥉 $1,000)
- Use Asset Tokenization Studio (ATS — security tokens/bonds/equities, ERC-3643 + ERC-1400) or Stablecoin Studio (fiat-backed stablecoins w/ admin + reserve controls) to put a real-world asset or payment flow onchain.
- Ideas: fractional invoice/receivable ownership, tokenized bonds w/ onchain coupons, fractional gold/real estate/warehouse receipts, compliant cross-border remittance stablecoin, secondary market/order book for ATS assets, an x402 service selling data about tokenized assets (NAV/price feeds — links to Track 1).
- Requirements: use ATS or Stablecoin Studio (SDK/contracts/web app or combo); deploy + demo on Hedera testnet; public GitHub repo with contracts verified on HashScan where applicable; demo video ≤5 min covering issuance, configuration, ≥1 lifecycle operation (coupon, redemption, freeze, reserve update).
- Extra points: compliance controls (KYC, freezes, transfer restrictions, pauses); custom fees/distributions; oracle pricing or NAV feeds; Scheduled Transactions; contributions back to the Studios.

**Track 3 — 🚫 "No Solidity Allowed": Build with Hedera SDKs ⸺ $2,000** (up to 2 teams × $1,000)
- Complete app on Hedera with zero smart contracts — native services only: HTS tokens, HCS messaging/data, scheduled/multisig transactions, accounts, all via SDKs.
- Requirements: JS/TS or Python SDK, no Solidity; ≥2 native Hedera services (e.g. HTS + HCS); public repo w/ README; demo video ≤5 min.
- Extra points: coherent end-to-end UX, Mirror Node REST API integration, creative HCS use (integrity/logging/messaging), Hedera Agent Kit, thoughtful security (key management, access controls).

**Track 4 — ♻️ Built on Hedera (Continuity Track) ⸺ $1,500** (up to 2 teams × $750)
- Move an existing Hedera project forward significantly — polish/bugfixes alone don't qualify. Requirements: project existed before; substantive new work (features, new Hedera services, or major architectural change); README separating old from new, ideally commit history/diff; demo video ≤5 min on the new work.

### 0G — $15,000

About: "the trust layer for AI" — 0G Private Computer (one OpenAI-compatible API for 100+ models, verified runs, privacy on demand, proof of which model produced each result), 0G Storage (AI datasets, model weights, live state), 0G Chain (AI-native EVM L1 settling every model run, payment, ownership record onchain).

**Track 1 — ♾️ Build with 0G PC ⸺ $5,000** (🥇 $2,500 / 🥈 $1,500 / 🥉 $1,000) — *rewritten 10-30, was "Build with iAI"*
- New brief: **build a consumer app where AI on 0G _is_ the product** — something people open, use, and come back to tomorrow. Creative image, video, and voice apps welcome. 0G Private Computer = one OpenAI-compatible API for 100+ models ("if you've used the OpenAI SDK, you already know how to build on it").
- Models to play with: seedream, hy-image, z-image (image) · seedance, minimax-h3 (video) · whisper-large-v3 (speech) · qwen omni, qwen vision (multimodal) · 0gm-1.0 (0G native).
- Every team gets 0G compute credits to build/test.
- **⭐ iAI is now a BONUS, not the core requirement:** 1.271 credits/day per staked iAI, refreshed 00:00 UTC, unused expires. Apps that let users sign in with their 0G account and spend their own daily credits score higher; standouts may be invited to discuss a revenue share with 0G. No need to buy/mint iAI — test with team credits. (The old Privy app ID / localhost:3000-3001-5173 restriction no longer appears in the brief.)
- Not wanted: generic chat wrappers; apps where the AI call could be removed without anyone noticing.
- Must show: inference on 0G Private Computer in the **main user flow, with request IDs**; a working app a judge can try + a clear reason someone comes back tomorrow; one sentence on what breaks if 0G is removed; for the iAI bonus — user signs in with their 0G account and their credit balance goes down as they use the app.
- Resources: iAI intro https://0g.ai/blog/introducing-infinite-ai · iAI app/docs https://iai.finance · https://iai.finance/docs · Private Computer https://pc.0g.ai · Compute docs https://docs.0g.ai/developer-hub/building-on-0g/compute-network/overview · legal https://iai.finance/docs#p-legal

**Track 2 — 🤖 Physical AI: Agents with a Body ⸺ $5,000** (🥇 $2,500 / 🥈 $1,500 / 🥉 best real-hardware build $1,000)
- Robot, drone, wearable or pocket device whose decisions run on 0G. Simulated builds eligible for every prize; one prize reserved for best real-hardware build.
- 0G is the brain, not the spinal cord: motion stays on the device; 0G decides at key checkpoints and keeps the record.
- Lanes: robots/machines (arms, rovers, drones — sim or hardware); personal devices (open, verifiable alternative to Meta's Muse on glasses/pocket device/desktop companion, user memory on 0G Storage + sealed inference).
- No hardware needed: **zerobot** SDK (mock robot included, targets Unitree Go2 on 0G Galileo testnet) or your own sim — MuJoCo, PyBullet, Gazebo + ROS 2, LeRobot.
- Not wanted: chatbot with a robot avatar, pre-recorded motion, 0G used only for logs.
- Must show: a 0G call inside the decision loop (vision/voice/decision model); episode log on 0G Storage with a request id per decision; replayable simulation or live hardware demo at the 0G booth; **safe-stop fallback if 0G is unreachable — a fallback that fakes the decision disqualifies**.
- Resources: zerobot https://github.com/0gfoundation/zerobot · models https://pc.0g.ai/models · Storage SDK https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk · MuJoCo/PyBullet/Gazebo links on the page.

**Track 3 — 🚀 Keep Building on 0G ⸺ $3,000** (Continuity Track only, up to 2 teams × $1,500)
- Iterate an existing 0G project (previous ETHGlobal, Open Agents, Zero Cup, AKINDO wave, or independent prior work). Judging meaningful progress during the Mumbai window — new features, production hardening, user readiness — not polish on old demos.
- Must show: link to prior state (dated commit hash or previous submission page); dated changelog of Mumbai-window work; 0G in the new work (a 0G Compute request id, Storage root hash, or Chain contract address from this hackathon); a short "What's next" statement.
- Resources: Builder Hub https://build.0g.ai · showcase https://build.0g.ai/showcase · docs https://docs.0g.ai

**Track 4 — 🃏 Agents That Pay for Themselves ⸺ $2,000** (up to 2 teams × $1,000) — *replaced "Wildcard: the Weirdest Thing on 0G" on 10-30*
- Build an agent that earns its keep: makes money, and that money pays for its own inference on 0G Compute **without a human topping it up**.
- Recommended path: **comfy** (token launchpad on 0G): register the agent with the comfy CLI (mints onchain identity on 0G) → launch its token with the compute share on (part of creator fees lands as credit in the agent's 0G compute account) → mint a capped compute key the agent pays its own model calls with (comfy never holds the key). Other earning paths count too (charging for a service, getting paid by other agents) — money just has to reach 0G Compute without a human in the loop.
- Want: agents that do a job worth paying for/trading on (not a mascot with a token); **budget-aware agents** that read their own balance and adapt (cheaper model, slow down, pause when funds run low); agents that hire/pay other agents.
- Not wanted: a token launch with a chatbot attached; "revenue" that only exists because the team trades its own token; an agent whose wallet a human refills.
- Must show: **the full loop** — money in, credit landing in the agent's 0G compute account, inference paid from that balance, with **tx hashes and request IDs**; the agent running on its own during the demo with **no manual top-up**; a **spend cap** + what the agent does when funds run low (degrade gracefully, not crash); if using comfy — agent ID, token address, and the token's fees tab showing compute delivered.
- Resources: models https://pc.0g.ai/models · Compute docs https://docs.0g.ai/developer-hub/building-on-0g/compute-network/overview · Comfy docs https://www.comfy.fun/docs · comfy-cli https://www.npmjs.com/package/comfy-cli · comfy Claude Code plugin https://github.com/0g-axion/comfy-plugin

**Workshop (published 10-28):** "One API, All of AI: Building on 0G Private Computer" — speaker Gathin T (@gathint), in-person 03:30 PM IST Thu Nov 5, 2026, Workshop Room 1, 20 min. Abstract: one API for 100+ verified AI models; build apps, agents and robots on 0G Private Computer, and how to win the Mumbai tracks. Directly useful for the iAI / Physical AI / Wildcard tracks — worth attending before locking the 0G build.

**Submission requirements (all tracks):** project name + short description; public GitHub repo (README + setup); demo video under 3 mins + live demo link; contract deployment addresses; team names + contacts (Telegram and X). **Prizes paid at 0G's discretion — only projects meeting their quality threshold are paid; no place is guaranteed.**

### Chainlink — $5,000 (updated 10-23)

About: industry-standard oracle network, trust-minimized apps across Web2/Web3. Pool expanded from $1,500 to $5,000 with a new CCIP 2.0 track.

**Track 1 — 🔗 Best Workflow with CRE ⸺ $1,500** (up to 2 teams × $750)
- Chainlink Runtime Environment (CRE): orchestration layer for institutional-grade contracts — data-connected, compliance-ready, privacy-preserving, cross-chain + traditional systems. Connect blockchains to external APIs, enterprise systems, data sources, LLMs, or AI agents.
- Requirements:
  - Build, **simulate**, or deploy a CRE Workflow used as orchestration in your project — deployment NOT mandatory, **CLI simulation is enough**
  - Workflow integrates ≥1 blockchain with an external API/system/data source/LLM/AI agent
  - Demonstrated successful simulation (CRE CLI) or live deployment on the CRE network
  - Meaningfully used in your project

Resources:
- CRE docs: https://docs.chain.link/cre
- Intro playlist: https://www.youtube.com/playlist?list=PLVP9aGDn-X0S-JmwQKGTao6o_CMitvv2_
- CRE templates: https://github.com/smartcontractkit/cre-templates/

**Track 2 — 🏆 Best Use of Chainlink CCIP 2.0 ⸺ $3,500** (up to 2 teams × $1,750) — NEW 10-23
- Build with Chainlink Cross-Chain Interoperability Protocol: one interface for all cross-chain needs — token transfers and arbitrary messaging. CCIP 2.0 pitched as rails for institutional capital flowing onchain.
- Possible use cases: cross-chain DeFi app with multi-chain liquidity; cross-chain DeFi yield aggregator; token bridge powered by CCIP; **Multihop CCIP Router** (send A→B without worrying whether the lane exists).
- Tooling: CCIP Local Simulator on local Hardhat/Foundry/Remix, then Faucet for testnet funds.
- Hard requirement: **the project must use CCIP to make a state change on a blockchain** — a frontend merely reading Data Feeds doesn't count. CCIP inside your smart contracts is required; CRE, Data Feeds, Data Streams and VRF encouraged.
- Resources: CCIP docs https://docs.chain.link/ccip

### Definitive — $5,000

About: onchain trading platform, pro-grade execution for any ERC-20 or SPL asset. $3B+ notional settled onchain. New **Flash API**: same execution engine, order types (DCA, Limit, Stop Loss, Take Profit, Cross-Chain, Bracket, Market, TWAP), routing, managed execution via one REST API + MCP server, built for humans and AI agents. 900+ liquidity sources, 12 EVM chains + Solana.

**Track 1 — 🏆 Best Use of Flash Advanced Orders in a Social App ⸺ $2,500**
- Social trading agent/app on Flash advanced order types. Ideas they call out:
  - Copy trading with Flash execution
  - Trade signals / leaderboards shared to X, TikTok, social channels
  - Agent-run products (e.g. a Grok bot) others can follow
  - Any product making trading a shared experience
- Judged on originality, technical creativity, demo quality

**Track 2 — 💡 Most Creative Use of Flash Advanced Orders ⸺ $2,500** (Continuity Track only)
- Flash somewhere unexpected: bigger agent workflow, paired with another protocol, novel strategy
- Examples: multi-agent systems with Flash as one tool, voice/chat trading interfaces, Flash + other MCP servers / onchain data

Qualification requirements (both tracks):
- Working trading flow via Flash API or Flash MCP advanced orders (DCA, Limit, Stop, Stop Loss, Take Profit, TWAP)
- Onchain execution shown in final demo
- Short demo video posted on Discord AND X, tagging @DefinitiveFi

Tips from sponsor:
- Non-custodial; works with any EOA or embedded wallet (Privy, Dynamic, Coinbase Embedded)
- All order types hit one orders endpoint; Flash lands the trade onchain end-to-end
- Attach a fee to every routed trade — monetizable from day 1
- AI-native: MCP server + LLM-optimized docs

Resources:
- Docs: https://flash.definitive.fi/docs
- API key: https://flash.definitive.fi/docs/getting-started
- Agent quickstart: https://flash.definitive.fi/docs/for-agents
- MCP setup: https://flash.definitive.fi/docs/flash-mcp
- Order types: https://flash.definitive.fi/docs/placing-orders
- Monetization: https://flash.definitive.fi/docs/monetizing-your-integration

### ENS — $10,000

About: ENS is the universal pointer for anything on the internet — wallet addresses as human-readable names (yourname.eth), a portable onchain profile working across every app, chain, wallet. Developers use it to replace raw addresses with real identities, build decentralized websites, create scalable subname ecosystems. Explicit pitch: as AI agents become first-class onchain actors, ENS is how you give them a name, a reputation, and a place to be found.

**Track 1 — 🧬 Best Use of ENSv2 ⸺ $7,000** (🥇 $3,000 / 🥈 $2,000 / 🥉 $1,000 / 🥉 3rd place $1,000 — two 3rd-place slots, i.e. 3/2/1/1k)
- ENSv2 is now live on Ethereum mainnet — be among the first to build on it.
- Explore the new hierarchical registry structure: resolve subnames straight off a parent's resolver with wildcard resolution, or deploy your own subname registry to tokenize/manage subnames under your own rules.
- Use Enhanced Access Control (shared role-based permission system behind both registries and resolvers) to delegate specific rights — e.g. an account that can edit only certain text records on a name.
- Give subnames their own Permissioned Resolver so they fully own their data; mix in record aliasing at resolver level or namespace aliasing via a shared registry.
- Combine into subname setups: expiring, revocable, non-transferable vs transferable, even forever names with no parent control.
- **Bonus points for AI agents in the mix** — agents as namespaces, each with their own identity and permissions.

Qualification requirements:
- Built on ENSv2 on Ethereum mainnet or Sepolia
- ENSv2 features **central to the product, not a cosmetic add-on**
- Functional demo — no hard-coded values
- Showcase submission with a live-demo link; open-source code on GitHub or similar

Resources:
- Permissioned Registry docs: https://docs.ens.domains/ensv2/permissioned-registry
- Permissioned Resolver docs: https://docs.ens.domains/ensv2/permissioned-resolver/
- Enhanced Access Control docs: https://docs.ens.domains/ensv2/enhanced-access-control/
- Guide for Contract Developers: https://docs.ens.domains/ensv2/tutorial-contract-developers/
- ENSv2 docs overview: https://docs.ens.domains/ensv2/overview/
- Agent-native CLI: https://github.com/ensdomains/ens-cli
- Agent Text Records (ENSIP-26): https://docs.ens.domains/ensip/26/
- Building with AI: https://docs.ens.domains/building-with-ai/
- AI Agent Registry ENS Name Verification (ENSIP-25): https://docs.ens.domains/ensip/25/

**Track 2 — 🔗 Best Integration of ENSv2 into an Existing Project ⸺ $3,000** (Continuity Track only, 🥇 $2,000 / 🥈 $1,000)
- Take an existing project (yours or an open one) and integrate ENSv2's feature set — registry hierarchy, Enhanced Access Control, Permissioned Resolvers, record/namespace aliasing — to improve UX or unlock new use cases.
- Qualification: integration on **Ethereum mainnet** (not Sepolia for this track), into an existing project; clear how ENSv2 improves it, not cosmetic; functional demo, no hard-coded values; live-demo link + open-source code.
- Resources: Guide for App Developers https://docs.ens.domains/ensv2/tutorial-app-developers/ (plus the general ENSv2/AI resources above)

### World — $12,500 (updated 10-24)

About: World's developer stack for verified humans and AI-assisted interactions. World ID lets apps confirm someone is a unique human without revealing their identity. (About text rewritten from the "every human benefits from the age of AI" blurb.)

**Track 1 — 💿 World ID Agent Pass ⸺ $2,500** (Continuity Track only, 🥇 $1,500 / 🥈 $1,000)
- Integrate World ID Agent Pass into your project. Agentic products especially wanted, but any compelling use case eligible.
- Show what becomes possible when an app can ask a person to authenticate or complete a fresh verification at the moment.
- Strong submissions: a meaningful action that needs a human identity/approval layer, **not simply a login screen bolted onto an existing product**.

**Track 2 — 🚀 World ID Agent Pass ⸺ $5,000** (🥇 $2,500 / 🥈 $1,500 / 🥉 $1,000)
- Same brief as Track 1, open track. Sponsor note: "We are mocking proofs now, so you don't need sandbox app anymore!"

Qualification requirements (both tracks):
- Integrate with the official World ID Agent Pass
- Demonstrate the complete journey: identity/verification request → user completion → validated result → protected application or agent action
- **Demonstrate a denied, expired, cancelled, or otherwise unsuccessful path** where the protected action does NOT occur
- Validate identity results in a secure backend; do not expose client secrets or treat an unvalidated client response as authorization
- Include a short integration debrief/feedback: time to first success, friction encountered, missing capability or documentation, the one improvement with greatest impact

Resources:
- World ID Agent Pass: https://auth.world.org/
- Docs: https://auth.world.org/docs
- Portal: https://auth.world.org/portal
- World ID Simulator: https://simulator.worldcoin.org/id/0x18310f83
- iOS Sandbox App (TestFlight): https://testflight.apple.com/join/Tub7zuyD

⚠️ Note: proofs use fake identities during the hackathon — do NOT rely on them for production.

**Track 3 — 🪪 Best Use of IDKit ⸺ $2,500** (NEW 10-24, up to 2 teams × $1,250)
- Build a product that uses IDKit to solve a real trust moment: an event where a product needs to know something meaningful about a person before it grants access, completes an action, or changes a user's experience.
- Use the **credential proportionate to your use case** — Proof of Human, Passport/NFC, or Selfie Check (now live with Sybil score). They are NOT rewarding the most credentials used; they reward the best decision about which credential is needed, why, and how it improves the real product experience.
- Strong examples: fair access to a scarce benefit, privacy-preserving eligibility check, recovery/protection of an important account action, or a workflow that becomes safer/simpler because it can verify the right level of human trust.

Qualification requirements:
- Integrate IDKit in a functioning application, mini app, or onchain flow
- Use ≥1 supported World ID credential and verify the result on the server or onchain as appropriate
- Clearly explain the specific product event requiring trust and why the chosen credential is the **minimum sufficient assurance**
- Demonstrate a successful verification **and one meaningful alternative path** (cancellation, unavailable credential, rejection, or an ineligible user)
- Include a short integration debrief/feedback: time to first success, friction encountered, missing capability or documentation, the one improvement with greatest impact

Resources:
- IDKit JS example: https://idkit-js-example.vercel.app/
- IDKit integration guide: https://docs.world.org/world-id/idkit/integrate
- Configure credentials: https://docs.world.org/world-id/idkit/credentials
- Proof of Human credential: https://docs.world.org/world-id/credentials/1
- Passport/NFC credential: https://docs.world.org/world-id/credentials/9303
- Selfie Check Beta (Sybil score): https://docs.world.org/world-id/credentials/11
- Verification flows: https://docs.world.org/world-id/idkit/verification-flows
- Developer Portal: https://developer.worldcoin.org
- IDKit Docs: https://docs.world.org/world-id/overview

**Track 4 — 🎉 [Cont] Best IDKit Use Case ⸺ $2,500** (NEW 10-24, Continuity Track only, **up to 2 teams × $1,250**)
- Same brief as Track 3 (real trust moment, proportionate credential, minimum-sufficient-assurance argument), restricted to Continuity Track participants.
- Same qualification requirements and resource links (IDKit docs overview).

### Whitechain — $15,000

About: "The Onchain Economy Layer" — the core for onchain business to launch, operate and scale on. EVM Layer 2 on the OP Stack, dev tooling + partner ecosystem, mainnet arriving in November.

**Common requirements (ALL four tracks):**
- Contracts deployed on **Whitechain Sepolia (chain ID 1874)** and verified on the Whitechain explorer
- ≥1 payment in **USDT (0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7)** settled on Whitechain in your main flow, explorer link in README — **payments in a self-minted test token won't count**
- A README line on why this flow needs onchain stablecoin settlement and what a regular payment rail couldn't do
- Public GitHub repo with steady progress through the hackathon (no one big final upload), README covering setup, architecture, current limitations
- Demo video of 2–4 minutes showing each party involved
- A **WHITECHAIN_FEEDBACK.md** — a few honest lines on what worked, where you got stuck, what the docs were missing

Good to know: all tracks/tokens (WBT, USDT) run strictly on Whitechain Sepolia testnet, no monetary value; prizes paid by ETHGlobal in USDC.

**Track 1 — 💳 Operate · Stablecoin Payments for Business ⸺ $5,000** (🥇 $2,500 / 🥈 $1,500 / 🥉 $1,000)
- Give a business everything it needs to get paid in USDT on Whitechain — from first checkout to what happens after. Payment flow a real merchant could plug in, shown end to end with test stablecoins. Plain EVM, any tooling.
- Ideas: drop-in checkout for online stores (order webhooks + onchain receipt); payment links/invoices for remote studios & cross-border teams (due dates, reminders); subscriptions/recurring billing with permit-based pulls, cancel anytime; one-click refunds/partial refunds with a customer-checkable record.
- What they want: a drop-in piece/widget/SDK/payment-link API/plugin that a separate demo app adds in **~20 lines**; both views in the demo (merchant + paying customer); extra credit for going past the first payment (refund, renewal, accountant export).
- Won't place: a pay button doing a plain transfer; tipping jars; bill splitters; custodial bridges into a local currency token; payroll/escrow/revenue splits on their own.

**Track 2 — 🏦 Tokenize · Real World Finance on Whitechain ⸺ $4,000** (🥇 $2,500 / 🥈 $1,500)
- Model real-world asset (RWA) lifecycles and compliance logic onchain — issuance, settlement or lifecycle flow for a real-world asset where every payment happens in USDT, end to end.
- Ideas: tokenized bonds/notes with investor allowlist + USDT coupons + repayment at maturity; invoice financing (tokenize invoice, buyer funds at discount, auto-settlement at due date); repo/short-term lending with delivery-versus-payment in one transaction; trade finance where importer/exporter/bank each confirm before release.
- What they want: real transfer rules enforced in the contract (allowlists, restrictions, maturity/settlement conditions) — not just a token with a UI; a clear issuer/investor/business user + at least one full lifecycle step (issuance → payment/settlement).
- Won't place: a token with a mint button and no rules; ownership NFTs where nothing is enforced onchain. Split guidance: paying an invoice → Operate; financing/selling an invoice → Tokenize.

**Track 3 — ⚡ Scale · Payments Nobody Notices ⸺ $3,000** (🥇 $2,000 / 🥈 $1,000)
- Build a payment flow where the payer (person or AI agent) pays in stablecoins **without holding WBT for gas, writing down a seed phrase, or knowing what chain they're on**.
- Ideas: gasless checkout with merchant-covered gas via **permit / transferWithAuthorization (EIP-3009)** + your own relayer; embedded wallets/smart accounts from any provider supporting Whitechain Sepolia; **pay-per-request APIs where an AI agent pays a business in USDT over x402**, settled on Whitechain through a facilitator you run.
- What they want: zero visible crypto steps for the payer; how the business pays for gas, how the relayer gets WBT, and what stops someone draining it.
- Won't place: flows where the payer still signs a gas-costing transaction; AI chats that never actually pay anyone.

**Track 4 — 🔁 Continuity · Bring Your Product to Whitechain ⸺ $3,000** (Continuity Track only, 🥇 $1,500 / 🥈 $1,500)
- Already have a product with users? Add Whitechain during the hackathon: accept USDT payments, move a feature onchain, or deploy contracts. Live product or open-source repo both qualify.
- What they want: real progress this weekend (new feature or payment flow — a nicer UI isn't enough); real users/real business count in your favour.
- Won't place: repackaging pre-hackathon work. Extra continuity requirements: proof of starting point (dated pre-hackathon commit or previous submission page); a "before and during" README section so judges can separate old code from Mumbai work.

Resources:
- Docs: https://docs.whitechain.io
- Faucet: https://faucet.testnet.whitechain.io
- Explorer: https://explorer.testnet.whitechain.io
- Builders Program: https://whitechain.io/builders
- YetiTrade testnet: https://testnet.yetitrade.fi
- Free Ankr RPC for hackers (1,500 req/s for 7 days, activate when you start building): https://www.ankr.com/rpc/?utm_referral=Whitechain2026

## Change log

- 2026-11-01 — **Whitechain added a free Ankr RPC resource** (no track, split, or requirement changes — still $15,000 / 4 tracks; total pool $144,500). Hackers get 1,500 requests/sec for 7 days: https://www.ankr.com/rpc/?utm_referral=Whitechain2026 — activate when you start building. Their \"Good to know\" boilerplate was also shortened to one line (test tokens have no monetary value; prizes paid by ETHGlobal in USDC). Worth using over the default public RPC if you hit rate limits during the build.
- 2026-10-31 — **Arkiv published its current testnet endpoints inline on the prizes page** (no track, split, or requirement changes — still $15,000 / 4 tracks + $1,000 Swarm bonus, total pool $144,500). New network is **Rabdi testnet, chain ID 7794095**: RPC https://rpc.rabdi.db-chain.testnet.arkiv.network · explorer https://rabdi.explorer.arkiv.network · indexer https://indexer.rabdi.db-chain.testnet.arkiv.network · faucet https://hub.arkiv.network/faucet · access keys https://hub.arkiv.network/access-keys. The earlier Tiramisu testnet (chain ID 7738577) is presumably superseded — point the SDK at Rabdi and regenerate writer addresses there before the hackathon. Arkiv About section also gained a \"Network, SDK and setup details are in the Arkiv docs\" pointer.

- 2026-10-30 (later) — **Arkiv clarified eligibility: existing projects can also win the Arkiv + Swarm bonus.** Intro sentence reworded from "Build on Arkiv also has a prize for existing projects" to "Build on Arkiv **and the Arkiv + Swarm bonus** also have a prize for existing projects that add Arkiv at the event", and every track's one-prize-per-team line now appends "the Arkiv + Swarm bonus can come on top of it". No pool, track, or split changes — still $15,000 / 4 tracks + $1,000 bonus; total unchanged at $144,500. Note: the bonus's own "To enter" text still names the from-scratch tracks, so existing-project teams should confirm with Arkiv at the booth if entering the bonus.
- 2026-10-30 — **0G restructured two of its four tracks** (pool still $15,000, no board/total changes). Track 1 renamed **"Build with iAI" → "Build with 0G PC"** ($5,000, 2.5k/1.5k/1k splits unchanged): the brief is now a consumer app where AI on 0G *is* the product ("if you've used the OpenAI SDK, you already know how to build on it"), with a published model table (seedream/hy-image/z-image, seedance/minimax-h3, whisper-large-v3, qwen omni/vision, 0gm-1.0); iAI demoted to a scoring bonus (sign in with 0G account, spend daily credits, revenue-share invite); requirements now demand inference in the main user flow with request IDs + a "what breaks if 0G is removed" sentence; the old localhost-port restriction and jurisdiction disclaimer disappeared from the brief. Track 4 **replaced "Wildcard: the Weirdest Thing on 0G" with "🃏 Agents That Pay for Themselves"** ($2,000, 2 × $1,000): self-funding agents whose earnings pay their own 0G Compute inference, recommended path via comfy launchpad CLI (onchain identity + token compute share + capped compute key), must demo the full money-in→credit→inference loop with tx hashes + request IDs, a spend cap, and graceful low-funds degradation. Main prizes page again served a cached iAI-variant — details confirmed on the 0G sub-page (same CDN caching pattern). Creative image/video/voice apps that would have gone to Wildcard now fit Track 1.
- 2026-10-28 (later) — **0G published its workshop description** (was "Description coming soon"): "One API, All of AI: Building on 0G Private Computer", Gathin T (@gathint), 03:30 PM IST Thu Nov 5, Workshop Room 1, 20 min — covers building apps/agents/robots on 0G Private Computer and how to win the Mumbai tracks. No prize, track, split, or requirement changes; pool still $144,500. World's workshop description still "coming soon". (Same CDN caching pattern: watcher fetch saw it first, cached variant lagged.)
- 2026-10-28 — **Arkiv completely restructured its tracks** (pool still $15,000, board/total pool unchanged). Old lineup (Bring It Onto Arkiv $8,000 Continuity + Best App $7,000 from scratch, 30/30/25/15 judging) is GONE. New lineup: 🪞 Mirror something Ethereum depends on $4,000 (3k/1k, open) · 🧩 Build on Arkiv from scratch $4,000 (3k/1k, open) · 🧩 Build on Arkiv existing projects $4,000 (3k/1k, Continuity only) · 🛠️ Node tooling $2,000 (operator dashboard / slow-query finder) · 🐝 Arkiv + Swarm bonus $1,000 stackable on any track. Judging is now flat 25/25/25/25 per track with **a required one-file-per-criterion submission format** (friction.md, reach.md, why-arkiv.md, data-quality.md / how-you-use-arkiv.md / real-use.md, whats-new.md, easy-to-run.md — each answering its questions with links, numbers, or a runnable query). Other notable rule changes vs the old version: no more Saturday booth-demo requirement; Mirror track bars Sourcify data; Node tooling must be a new repo (PRs don't count) and slow-query findings go to Arkiv privately; Swarm bonus counts as the same single partner prize (doesn't consume a second of your three ETHGlobal picks); Swarm encrypted references must never be stored raw in public Arkiv entities.
- 2026-10-26 — **EF published the alt mempool starter links** it had left "tbc": official docs (https://docs.altmempool.wtf/), a new devnet explorer (https://explorer.altmempool.wtf/ — likely replacing altmempoolexplorer.forshtat.com as the place to link admitted txs for the Track 2 requirement), a starter page (https://www.altmempool.wtf/), plus spec links EIP-8141 (frame transactions) and ERC-7562 (staking/reputation). No new sponsors, tracks, splits, or requirement changes — pool still $144,500, all 12 sponsors unchanged.
- 2026-10-24 (later) — **World filled in the reward split for its Continuity IDKit track**: 🎉 [Cont] Best IDKit Use Case $2,500 is **up to 2 teams × $1,250** (mirrors the open-track split). No other changes on the page — pool still $144,500, all 12 sponsors unchanged.

- 2026-10-24 — **World expanded its pool $7,500 → $12,500 with two NEW IDKit tracks.** Total event pool now $144,500. New tracks (both on the classic IDKit stack, distinct from the Agent Pass tracks): 🪪 Best Use of IDKit $2,500 (up to 2 teams × $1,250, open track) and 🎉 [Cont] Best IDKit Use Case $2,500 (Continuity Track only). Brief: use IDKit to solve a real "trust moment"; pick the credential proportionate to the use case (Proof of Human, Passport/NFC, or Selfie Check — now live with Sybil score). Judging explicitly rewards the **best credential decision, not the most credentials** — must argue the chosen credential is the minimum sufficient assurance. Requirements: working app/mini app/onchain flow, server- or onchain-side verification of the credential, a demo of both a successful verification and a failure path, plus an integration debrief. Existing Agent Pass tracks ($2,500 Continuity + $5,000 open) unchanged. Resources added: IDKit JS example, integration guide, credentials docs, Selfie Check Beta link.

- 2026-10-23 (later) — **World added resource links** to its $5,000 Agent Pass track: World ID Simulator (https://simulator.worldcoin.org/id/0x18310f83) and an iOS Sandbox App via TestFlight (https://testflight.apple.com/join/Tub7zuyD). No track, split, or requirement changes — but with proofs now mocked, the simulator is the fastest way to generate test verifications without TestFlight. 1inch's SwapVM/Aqua whitepaper links also surfaced on the main prizes page (already in this note). All 12 sponsors remain fully published; pool unchanged at $139,500.

- 2026-10-23 — **Arkiv published full details (all 12 of 12 live now) + Chainlink quietly expanded its pool $1,500 → $5,000.** Total event pool now $139,500. Arkiv ($15,000, 2 tracks): Bring It Onto Arkiv $8,000 (Continuity only, 5/2/1k) — migrate an existing project's data (or one real feature) into Arkiv entities, judged on Feedback 30% / Reach 30% / Why Arkiv 25% / Build quality 15%, with a **booth demo on Saturday**; Best App with Arkiv as Its Database $7,000 (2.5/2/1.5/1k, from scratch). Notable for the build: entities = payload + SQL-like filterable attributes + owner wallet + expiration date; reads are public and keyless; Tiramisu testnet chain ID 7738577, GLM faucet, SDK is `@arkiv-network/sdk` 0.8.x (or JSON-RPC), plus an Arkiv MCP / Claude Code plugin. Heavy submission paperwork: `/arkiv/schema.md` + `/arkiv/friction.md` (judged at 30% — feedback is a scored deliverable), writer wallet + runnable query in README, before/after demo video, real commit history; they explicitly may leave places empty. "Why Arkiv" scoring: if a normal DB does the same job, it scores low. Chainlink: new Track 2, Best Use of CCIP 2.0 $3,500 (2 × $1,750) — CCIP must make an onchain state change (reading Data Feeds from a frontend doesn't count); use cases include a Multihop CCIP Router; CCIP Local Simulator + Faucet available. Main prizes page again served a cached "coming soon" variant for Arkiv — details confirmed on the sponsor sub-page (same caching pattern as every prior rollout).
- 2026-10-23 — **Whitechain published full details** (11 of 12 live; only Arkiv still pending). 4 tracks: Operate (stablecoin payments for business) $5,000 (2.5/1.5/1k), Tokenize (RWA finance) $4,000 (2.5/1.5k), Scale (payments nobody notices — gasless/abstracted payer UX) $3,000 (2/1k), Continuity $3,000 (2 × $1,500) — totals $15,000. Hard requirements across all tracks: contracts on Whitechain Sepolia (chain ID 1874), ≥1 settled payment in the official USDT token (0xcedfB561…f55a7, self-minted tokens don't count), steady commit history, 2–4 min demo, and a WHITECHAIN_FEEDBACK.md. Notable: Operate explicitly wants a ~20-line drop-in integration; Scale calls out **permit/EIP-3009 gasless flows and x402 agent payments settled on Whitechain**; both tracks publish explicit "won't place" lists (plain transfers, tipping jars, custodial bridges, unrewarded-gas payer flows). Main prizes page again served a cached "coming soon" variant — details confirmed from the watcher's live fetch (same caching pattern as EF/0G/ENS/World).
- 2026-10-21 (later) — **World published full details** (10 of 12 live; Arkiv, Whitechain still pending). Pool cut from **$12,500 → $7,500**, so total event pool is now $136,000. Two tracks, both World ID Agent Pass: $2,500 Continuity (1.5k/1k) + $5,000 open (2.5/1.5/1k). Agentic products explicitly wanted; the differentiator is a **meaningful human-identity/approval action, not a login screen bolted on**. Hard quirks: must demo the **failure path** (denied/expired/cancelled → protected action does NOT occur), must validate proofs in a secure backend (client response ≠ authorization), and must include an integration debrief (time to first success, friction, docs gaps). Proof mocking live — no sandbox app needed; proofs use fake identities, not for production. Docs: auth.world.org/docs. Main page + sub-page both still serving a cached "coming soon" — details confirmed from the watcher's live fetch (same caching pattern as EF/0G/ENS).
- 2026-10-21 — **Whitechain added About text only** (no prize details yet — 9 of 12 live; World, Arkiv, Whitechain still pending). Whitechain: "The Onchain Economy Layer" — EVM L2 on the OP Stack, dev tooling + partner ecosystem, mainnet in November; X handle whitechain_io. Everything else on the page re-verified against the note — no changes to any published sponsor (tracks, splits, requirements all unchanged).
- 2026-10-20 — **ENS published full details** (9 of 12 now live; World, Arkiv, Whitechain still pending). 2 tracks: Best Use of ENSv2 $7,000 (🥇 $3,000 / 🥈 $2,000 / two 🥉 $1,000 slots — note the odd split with two 3rd places) + Best Integration of ENSv2 into an Existing Project $3,000 (Continuity only, $2,000/$1,000) — totals $10,000. About text rewritten: universal pointer → now explicitly pitches ENS for **AI agents** (name, reputation, discoverability); **bonus points for AI agents in the mix** on the main track. ENSv2 is live on mainnet; build on ENSv2 on mainnet or Sepolia (Continuity track: mainnet only). Quirks worth knowing: ENSv2 features must be central, not cosmetic; demo must be functional with no hard-coded values; live-demo link + open-source repo required. Main prizes page again served a cached "coming soon" for ENS — details confirmed on the sponsor sub-page (same caching pattern as EF 10-18 and 0G 10-20 morning).

- 2026-10-20 — **0G published full details** (6 of 12 now live; World, Arkiv, Whitechain, ENS still pending). 4 tracks: Build with iAI $5,000 (2.5/1.5/1k), Physical AI $5,000 (2.5/1.5/1k + best-real-hardware $1,000), Keep Building on 0G $3,000 (Continuity, 2 × $1,500), Wildcard $2,000 (2 × $1,000) — totals $15,000. About text rewritten (largest-L1 blurb → "trust layer for AI": Private Computer + Storage + Chain). Key quirks: 0G Privy app ID only works on localhost:3000/3001/5173; prizes paid at 0G's discretion (quality threshold, no guaranteed places); iAI unavailable in US/UK/CA/CN/EU; teams get free compute credits. Main prizes page again served a cached "coming soon" for 0G — details confirmed on the sponsor sub-page (same as EF on 10-18).

- 2026-10-13 — baseline snapshot. 12 prizes listed; only 1inch and Definitive have full details.
- 2026-10-15 — watcher fired on a diff in the Definitive section. Re-verified full page against this note: no net change. Definitive's social-track amount was captured as $2,500 in the watcher's fetch but reads **$3,500** on the live page minutes later ($3,500 + $1,500 continuity = $5,000 headline, consistent). 1inch tracks unchanged. The other 10 sponsors still say "Prize details coming soon". Note content confirmed accurate; no section updates needed.
- 2026-10-15 23:02 UTC — Definitive **rebalanced its split to an even $2,500 / $2,500** (social track down from $3,500, continuity track up from $1,500; headline still $5,000). Track briefs, requirements, and resource links unchanged. Chainlink's headline amount showed **$1,500** in the watcher diff but reads **$5,000** on the live page at re-check — likely a transient edit; details still "coming soon", board unchanged. All other sponsors unchanged; still 10 of 12 without details.
- 2026-10-18 — **Ethereum Foundation and Chainlink published full details.** EF (Access Layer team): 4 tracks — Anon-RPC $5,000, EIP-8141 frame-tx alternative mempool $5,000, Best CROPS App $3,500, CROPS Upgrade (Continuity) $1,500; one-EF-prize-per-project rule; FOSS + CROPS README section required for the CROPS tracks. Chainlink: single track, Best CRE Workflow, $1,500 (2 × $750) — **headline confirmed $1,500, not $5,000**, so total pool corrected to $141,000. EF main-listing About text also rewritten (steward → Access Layer team); main prizes page served a cached "coming soon" variant for EF, details confirmed on the sponsor sub-page. Still 8 of 12 without details (World, 0G, Uniswap Foundation, Arc, Hedera, Arkiv, Whitechain, ENS).
- 2026-10-19 — **Uniswap Foundation, Arc, and Hedera published full details** (5 of 12 now live; World, 0G, Arkiv, Whitechain, ENS still pending).
  - **Uniswap Foundation ($15,000)**: Build with Uniswap $10,000 (4/3/2/1k) + Continuity $5,000 (4 × $1,250). Any part of the stack (API, v2/v3/v4, CCA), v4 hooks, repo extensions, tooling. Hard requirements: public repo, FEEDBACK.md, Uniswap Developer Feedback Form submission linking to it, README pointing to contracts + lines of code. About text rewritten (protocol platform, not foundation/grants).
  - **Arc ($15,000)**: 5 bounties × $3,000 — DeFi/onchain finance, mobile consumer agent on the Marketplace Discovery API (API docs link still placeholder), advanced stablecoin contracts, Bridge Kit non-USDC crosschain, Continuity bring-your-project. All require building in Arc Studio (project URL + Studio in demo), functional MVP + architecture diagram, video + docs, repo link.
  - **Hedera ($15,000)**: 4 tracks — x402 on Hedera $6,500 (3/2/1.5k), Tokenize Anything with ATS/Stablecoin Studio $5,000 (2.5/1.5/1k), "No Solidity Allowed" SDK-only $2,000 (2 × $1,000), Continuity $1,500 (2 × $750). x402 track: settle via Official x402/Ax402/Blocky402 or self-run facilitator, agent completes ≥1 paid request with no human, tx ID in README, ≤5-min video linked on HashScan; extra points for spending controls, HCS-14/ERC-8004 identity, HCS audit log, HTS/USDC settlement, scheduled recurring payments.

## Ideas / scratchpad

- (empty — once more sponsors drop details, shortlist 2–3 tracks that match our stack and list build ideas here)
