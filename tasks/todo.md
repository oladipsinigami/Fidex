# Todo List: Option B Implementation

## Phase 1: Storage & Payment Deduplication (Foundation)
- [x] Task 1: Create `lib/db.ts` with `node:sqlite`, schema definitions for `receipts` and `attestations`, and atomic duplicate rejection
- [x] Task 2: Write unit test `scripts/test-db.mjs` verifying ACID persistence and double-spend rejection
- [x] Task 3: Wire `lib/onchainVerify.ts` and `app/api/v1/unlock/route.ts` to `lib/db.ts` and harden `lib/unlock.ts` secret checks
- [x] Checkpoint 1: Run `node scripts/test-db.mjs` and `npm run verify:payments`

## Phase 2: Data Authenticity, Citations & Telemetry
- [x] Task 4: Upgrade audit citation links in `data/*.ts` to primary audit repositories and PDF reports
- [x] Task 5: Compute live homepage telemetry dynamically from DeFiLlama rather than summing static constants
- [x] Task 6: Add clear "SIMULATION / THREAT MODEL SANDBOX" banners to EmberYield dossier and cards
- [x] Checkpoint 2: Build verification and content check

## Phase 3: Real Studio Cryptographic Signing & Flow Parity
- [x] Task 7: Build `POST /api/v1/attest` endpoint with `viem` EIP-712 signature verification and database persistence
- [x] Task 8: Implement real Web3 wallet EIP-712 signing modal in `components/StudioTable.tsx`
- [x] Task 9: Resolve residual UI drift in `components/WalkthroughLab.tsx` (5042 -> 5042002)
- [x] Checkpoint 3: Full end-to-end test suite (`npm run test:grade`, `npm run test:attest`, `npm run verify:challenge`, `npm run verify:payments`, `npx tsc --noEmit`, `npm run lint`, `npx next build`)

## Phase 4: Onchain ArcGradeRegistry Smart Contract & Agent Standards (Circle Arc Testnet 5042002)
- [x] Task 10: Initialize Foundry workspace and install `@openzeppelin/contracts` and `forge-std`
- [x] Task 11: Implement `contracts/src/ArcGradeRegistry.sol` with EIP-712 signature verification, replay protection, and ERC-8004/ERC-8183 agent reputation
- [x] Task 12: Implement comprehensive Foundry test suite `contracts/test/ArcGradeRegistry.t.sol` (17/17 tests passing with 100% green coverage)
- [x] Task 13: Create deployment script `contracts/script/DeployRegistry.s.sol` and add `npm run test:contracts`
