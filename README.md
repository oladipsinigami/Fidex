# Fidex

> **Institutional-Grade Risk Ratings & Nanopayment Dossiers for Circle Arc (`5042002`).**  
> Built for capital allocators, risk desks, and autonomous AI agents allocating native USDC on Arc.

---

## 1. Overview

Fidex (formerly ArcGrade) provides structured, quantitative, and verifiable risk assessments for decentralized protocols and assets on **Circle Arc**. 

- **Human-Readable:** A composite letter grade (A through F), 0–100 score, weakest-link failure modes, and primary audit citations.
- **Machine-Readable:** Autonomous agent API featuring free summaries and `$0.01` on-chain / x402 v2 paywalled dossiers.
- **Zero Free Bypass:** Real payment verification via Circle Gateway or direct on-chain Arc Testnet transaction verification with strict replay protection.
- **No SSR Data Leaks:** Locked dossier content is guarded at the server boundary — protected intelligence is never delivered to unauthenticated clients.

---

## 2. Circle Arc Network Parameters

All network parameters are verified on-chain against Circle Arc:

| Parameter | Arc Testnet (Active) | Arc Mainnet |
|---|---|---|
| **Chain ID** | `5042002` (`0x4cef52`) | `5042` (`0x13b2`) |
| **CAIP-2 Identifier** | `eip155:5042002` | `eip155:5042` |
| **RPC Endpoint** | `https://rpc.testnet.arc.io` | `https://rpc.mainnet.arc.io` |
| **Explorer** | `https://explorer.testnet.arc.io` | `https://explorer.arc.io` |
| **Native Gas Currency** | `USDC` (18 decimals) | `USDC` (18 decimals) |
| **Canonical ERC-20 USDC** | `0x3600000000000000000000000000000000000000` (6 decimals) | `0x3600000000000000000000000000000000000000` (6 decimals) |
| **Gateway Wallet** | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` | `0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE` |
| **Circle Faucet** | [https://faucet.circle.com](https://faucet.circle.com) | N/A |

> **Critical Decimals Note:** Native gas transfers on Arc operate with **18 decimals** (`$0.01` = `10^16` wei / `10_000_000_000_000_000n`). The ERC-20 token interface uses **6 decimals** (`$0.01` = `10,000` atomic units). Fidex strictly respects this separation across all settlement paths.

---

## 3. Risk Methodology (`fidex/1.4.0`)

Fidex grades cannot be bought. Protocols earn letter grades via 9 weighted axes:

1. **Security (18%):** Smart contract audits, formal verification, bug bounties.
2. **Liquidity (14%):** Pool depth, slippage at scale, exit capacity.
3. **Decentralization (14%):** Admin keys, timelocks, multisig thresholds.
4. **Audits (14%):** Quality, recency, and tier of security auditing firms.
5. **Concentration (10%):** Whale holder distribution, LP concentration.
6. **Track Record (10%):** Incident history, battle-tested operational age.
7. **Governance (10%):** Voting structures, proposal timelocks, upgrade powers.
8. **Yield Sustainability (10%):** Fee-to-emission ratio, real yield vs token dilution.
9. **Arc Native Fit (Bonus / Non-Compounding):** Native USDC usage, sub-second settlement fit.

### Weakest-Link Compounding Math

Rather than allowing high liquidity or aggressive token incentives to mask a missing audit or centralized admin key, Fidex computes a non-linear composite score:

$$\text{Mean} = \frac{\sum (w_i \cdot s_i)}{\sum w_i}$$

$$\text{LinkFactor} = 0.50 + 0.50 \cdot \sqrt{\frac{\min(s_i)}{100}}$$

$$\text{Composite} = \text{round}(\text{Mean} \cdot \text{LinkFactor})$$

If any critical compounding axis scores `0`, the maximum possible composite score is cut in half ($0.50$), ensuring that unaudited or centralized contracts fail into Grade D or F regardless of TVL.

---

## 4. Payment & Verification Architecture

### Path 1: x402 v2 Facilitator & Gateway Settlement
- Client receives `HTTP 402 Payment Required` with `PAYMENT-REQUIRED` base64 header containing standard x402 challenge.
- Client signs an EIP-712 payment authorization and provides it in the `payment-signature` header.
- Server validates and settles with Circle Gateway (`gateway-api-testnet.circle.com`), returning the decrypted dossier with `PAYMENT-RESPONSE` header.
- The `resource` URL in every challenge is built from `FIDEX_PUBLIC_URL` (or `ARCGRADE_PUBLIC_URL`) by `resourceFor()` in `lib/x402.ts`. Circle's facilitator requires the buyer to echo `resource` and `accepted` back, so this **must resolve to the host actually serving the API** — a dead or wrong origin advertises an unpayable resource and settlement fails opaquely at the facilitator. Production refuses to boot without it.

### Path 2: Direct On-Chain Arc Testnet Settlement
- Client sends an on-chain transfer of `0.01` native USDC to `FIDEX_PAY_TO`.
- Client submits `{ slug, txHash }` to `POST /api/v1/unlock`.
- Server executes `lib/onchainVerify.ts` via Arc Testnet JSON-RPC (`eth_getTransactionReceipt` & `eth_getTransactionByHash`), confirming:
  - Valid transaction status `0x1` (success).
  - Sent to exact `FIDEX_PAY_TO` address.
  - Value $\ge 0.01$ USDC.
  - Replay protection (rejects reused transaction hashes).

### Durable Storage (SQLite)

`lib/db.ts` holds receipts and attestations in a file-backed SQLite database at `data/fidex.db` (auto-migrating from `data/arcgrade.db` if present). It
**has no in-memory fallback on purpose**: an ephemeral database would drop the
`UNIQUE(tx_hash)` constraint on restart, so a replayed payment would be accepted
a second time and mint a second free receipt. If the store cannot be opened,
unlocking fails closed with a 402.

- Set `FIDEX_DB_PATH` (or `ARCGRADE_DB_PATH`) to a path on a persistent volume, **or**
- replace `lib/db.ts` with a networked store keeping the same `UNIQUE(tx_hash)` constraint.

`verify:payments` covers this directly: it boots a server whose receipt store
cannot be opened and asserts that a genuinely valid, fully settled payment still
yields no receipt.

---

## 5. Development & Testing Commands

### Install Dependencies
```bash
npm install
```

### Run Local Development Server
```bash
npm run dev
```

### Run Grading Formula Unit Tests
```bash
npm run test:grade
```

### Verify Challenge Spec
```bash
npm run verify:challenge
```

### Run Fails-Closed Payment Security Test Suite
```bash
npm run verify:payments
```

### Run Smart Contract Tests (Foundry)
```bash
npm run test:contracts
```

### Run Attestation & Watchdog Verification
```bash
npm run test:attest
npm run verify:watchdog
npm run test:leak
```

### Run the Agent Buyer Suite
```bash
node scripts/arc-agent-buyer.test.mjs
```

### Build for Production
```bash
npm run build
```

---

## 6. Environment Variables

Copy `.env.example` to `.env.local` and fill it in. **Never commit a real
`.env.local`** — `.gitignore` already excludes `.env*`.

Both `FIDEX_*` and `ARCGRADE_*` variable names are fully supported for 100% backward compatibility.

```ini
# --- x402 / Circle Gateway ---
FIDEX_PAY_TO=0xYourSellerAddress          # seller address; setting this enables live mode
FIDEX_X402_MODE=gateway                   # gateway | http
FIDEX_NETWORK=testnet                     # testnet (5042002) | mainnet (5042)

# Public origin used to build the x402 `resource` URL.
FIDEX_PUBLIC_URL=https://your-domain.example

# HMAC key for signing unlock receipts. MUST be set in production.
FIDEX_SECRET=<generate-a-random-32-byte-hex-key>

# --- Client-side (optional) ---
NEXT_PUBLIC_FIDEX_NETWORK=testnet
```

---

## 7. Disclaimer

Fidex is not financial advice and not a traditional credit rating. Fidex publishes structured, objective risk assessments of technical failure modes. Protocols cannot purchase ratings.
