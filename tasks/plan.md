# Implementation Plan: Option B — Production Engineering on Circle Arc Testnet

## Overview
Transform ArcGrade from an in-memory testnet prototype into a durable, production-grade risk platform operating strictly on **Circle Arc Testnet** (`5042002`). This directly resolves all architectural vulnerabilities and integrity critiques:
1. **Durable Payment Persistence:** Replace the ephemeral Node.js in-memory `Set` with atomic, ACID-compliant SQLite (`node:sqlite`) storage. Enforce unique constraints on `tx_hash` to permanently prevent double-spending and race conditions across server instances.
2. **Fail-Closed Secret Hardening:** Eliminate insecure plaintext fallback keys; enforce fail-closed security for receipt signing.
3. **Data Authenticity & Primary Citations:** Replace generic root URLs with deep-link primary audit reports (Spearbit, OpenZeppelin, etc.), compute homepage telemetry from live DeFiLlama data rather than static fixture sums, and strictly segregate simulated benchmarks (EmberYield).
4. **Real Cryptographic Attestation in /studio:** Enable Web3 analysts to cryptographically sign rating evaluations using EIP-712 structured data with on-chain wallet verification, persisting signatures in the database.
5. **Unified Protocol Parity:** Fix residual network drift (`5042` -> `5042002` in walkthroughs) and bind all receipt minting to verified database records.

---

## Architecture Decisions

- **Storage Engine: Native `node:sqlite` (Node 24)**
  - *Rationale:* Node 24 includes `DatabaseSync` in the standard library. Zero external npm dependencies, zero C++ native compile failures on Windows, WAL journal mode for high concurrency, and native ACID guarantees for atomic payment deduplication.
  - *Database Location:* `data/arcgrade.db` (persisted on disk, gitignored).
- **Payment Settlement Rail: Circle Arc Testnet (`5042002`)**
  - *Rationale:* User specified to strictly use Arc Testnet USDC (`0.01` native USDC per dossier). All settlements verify on `https://rpc.testnet.arc.io` and persist transaction hash, payer, slug, and timestamp.
- **Analyst Attestations: EIP-712 Structured Data Signing**
  - *Rationale:* Analysts use their connected Web3 wallet to sign typed data containing `{ slug, score, letter, timestamp, analyst }`. Server verifies signature via `viem` and stores attestations in SQLite.

---

## Tasks Breakdown

### Phase 1: Storage & Payment Deduplication (Foundation)
- [ ] **Task 1: Database Layer with `node:sqlite`**
  - Create `lib/db.ts` implementing SQLite database connection, table schemas (`receipts`, `attestations`), and atomic helper functions (`saveReceipt`, `hasReceipt`, `saveAttestation`, `getAttestations`).
  - Add atomic transaction insertion that raises constraint error on duplicate `tx_hash`.
  - Add unit test `scripts/test-db.mjs` verifying ACID persistence and double-spend rejection.
- [ ] **Task 2: Harden `lib/unlock.ts` and `app/api/v1/unlock/route.ts`**
  - Connect `lib/onchainVerify.ts` and `route.ts` to `lib/db.ts`.
  - Fail closed if `ARCGRADE_SECRET` is missing in production.
  - Ensure every unlock (x402 Gateway or direct on-chain) writes an immutable record to SQLite tying `tx_hash` to `slug` and `payer`.

### Checkpoint: Foundation
- [ ] Run `node scripts/test-db.mjs`
- [ ] Run `npm run verify:payments` to assert double-spend attacks fail closed across restarts.

### Phase 2: Data Authenticity, Citations & Telemetry
- [ ] **Task 3: Deep-Link Primary Audit Citations & Real Live Telemetry**
  - Update `data/*.ts` files (Morpho, Aave, Uniswap, etc.) replacing homepage links with deep-linked audit repositories and primary PDF references.
  - Update homepage (`app/page.tsx`) to pull live TVL telemetry from DeFiLlama rather than summing static mock constants.
  - Add explicit "SIMULATION / THREAT MODEL SANDBOX" banners to `data/ember.ts` and UI views so synthetic benchmarks are never confused with real protocols.

### Phase 3: Real Studio Cryptographic Signing & Flow Parity
- [ ] **Task 4: Implement Real EIP-712 Attestation in `/studio`**
  - Build EIP-712 signing modal in `components/StudioTable.tsx` allowing analysts to connect their wallet, edit/review scores, and sign `RatingAttestation`.
  - Create API endpoint `POST /api/v1/attest` that verifies the EIP-712 signature using `viem` and persists the attestation to SQLite.
  - Display verified analyst signatures and timestamps on dossiers.
- [ ] **Task 5: Walkthrough & Network Drift Cleanup**
  - Update `components/WalkthroughLab.tsx` line 336 from `eip155:5042` to `eip155:5042002`.
  - Ensure all walkthrough steps demonstrate both human Arc Testnet checkout and agent x402 checkout consistently.

### Phase 4: On-Chain ArcGradeRegistry Smart Contract & Agent Standards (Circle Arc Testnet 5042002)
- [x] **Task 6: ArcGradeRegistry.sol Implementation**
  - Implement Solidity contract `contracts/src/ArcGradeRegistry.sol` using OpenZeppelin `EIP712` and `ECDSA`.
  - Provide direct attestation `attest(...)` and cryptographic `attestWithSig(...)` with signature replay protection and expiry verification.
  - Integrate agent standards (ERC-8004 / ERC-8183): `registerAgent(metadataUri)`, `isRegisteredAgent(agent)`, and `totalAttestationsByAnalyst(analyst)`.
  - Provide view queries: `getLatestAttestation`, `getAttestationCount`, `getAttestationByIndex`, and `getAllAttestations`.
- [x] **Task 7: Foundry Comprehensive Test Suite**
  - Implement `contracts/test/ArcGradeRegistry.t.sol` testing direct attestation, valid EIP-712 recovery via `vm.sign`, replay rejection, expiry rejection, tampered signatures, and agent reputation tracking.
  - Wire into `npm run test:contracts`.

### Checkpoint: Complete System Verification
- [x] `npm run test:grade`
- [x] `npm run verify:challenge`
- [x] `npm run verify:payments`
- [x] `npm run test:contracts` (17/17 Foundry tests passing)
- [x] `npm run build`

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Serverless read-only file systems (e.g. Vercel) | High | Fall back gracefully to in-memory store with clear telemetry warning if file system is read-only, but default to SQLite for persistent environments. |
| Malformed EIP-712 signatures | Med | Validate domain separator, chain ID `5042002`, and signature recovery via `viem.verifyTypedData`. |
| Double-spend race conditions | High | SQLite `UNIQUE(tx_hash)` constraint guarantees hardware-level serialization; second concurrent insert throws error. |
