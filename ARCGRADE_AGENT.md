# ArcGrade Agent Buyer

Autonomous agent script that purchases risk dossiers from ArcGrade's x402 nanopayment paywall on Circle Arc Testnet (chain ID `5042002`).

## How it works

```
Agent                         ArcGrade Server              Arc Testnet RPC
  │                                  │                              │
  │── POST /api/v1/unlock ──────────▶│                              │
  │       { slug, scope }            │                              │
  │                                  │                              │
  │◀── 402 + x402 challenge ─────────│                              │
  │    { amount, recipient,          │                              │
  │      network, currency }         │                              │
  │                                  │                              │
  │── USDC.transfer(recipient, amt) ─────────────────────────────▶ │
  │                                  │           (confirmed)        │
  │── POST /api/v1/unlock ──────────▶│                              │
  │       { slug, scope, txHash }    │                              │
  │                                  │── verifyArcTestnetTx ──────▶ │
  │                                  │◀─ receipt + dossier ─────────│
  │◀── 200 { unlocked, dossier } ────│                              │
```

**Payment path used:** Direct on-chain USDC ERC-20 `transfer()` verified by the ArcGrade server via Arc Testnet RPC (`verifyArcTestnetTx`). No Circle Gateway or x402 facilitator required — the simplest, most auditable path.

## Quick start

### 1. Fund your wallet

You need an Arc Testnet wallet with at least $0.01 USDC (plus a tiny amount for gas).

Get testnet USDC from: https://faucet.circle.com

Or use the **"Get test USDC"** button in Arc Studio's sidebar.

### 2. Set environment variables

```bash
export AGENT_PRIVATE_KEY=0x<your-private-key>
export ARCGRADE_URL=http://localhost:3001   # or your ArcGrade server
```

### 3. Run

```bash
node scripts/arc-agent-buyer.mjs
# or with explicit slug/scope:
node scripts/arc-agent-buyer.mjs morpho dossier
node scripts/arc-agent-buyer.mjs aave axis
```

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AGENT_PRIVATE_KEY` | Yes (non-dry-run) | — | 0x-prefixed private key for Arc Testnet wallet |
| `ARCGRADE_URL` | No | `http://localhost:3001` | ArcGrade server base URL |
| `ARCGRADE_SLUG` | No | `morpho` (or argv[2]) | Protocol slug to purchase |
| `ARCGRADE_SCOPE` | No | `dossier` | `dossier` or `axis` |
| `ARCGRADE_AXIS_ID` | If scope=axis | — | Axis identifier (e.g. `oracle`) |
| `DRY_RUN` | No | — | Set to `1` to probe paywall without paying |
| `NO_COLOR` | No | — | Set to any value to disable ANSI colour output |
| `DEBUG` | No | — | Set to `1` to print full stack traces on errors |

## Security

- Private key is read from `AGENT_PRIVATE_KEY` env var only — never from argv, never logged.
- The challenge is validated before payment:
  - Network must be `eip155:5042002` (Arc Testnet)
  - Amount must match the expected price for the requested scope
  - Currency must be USDC at `0x3600000000000000000000000000000000000000`
- On-chain USDC balance is checked before the transaction is submitted.
- Payment and unlock are two separate steps — if the unlock HTTP call fails, the `txHash` is printed so you can retry manually.

## Arc Testnet facts

| Field | Value |
|---|---|
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.io` |
| Explorer | `https://explorer.testnet.arc.io` |
| USDC address | `0x3600000000000000000000000000000000000000` |
| USDC decimals | `6` (ERC-20 view) |
| Native gas decimals | `18` (same USDC pool, different view — never sum the two) |

> On Arc, USDC is the native gas token. One pool, two views. The ERC-20 view (6 decimals, used here for all transfers and balances) and the native view (18 decimals, used only for raw gas math) are the **same funds** — never add them together or treat them as separate balances.

## x402 payment challenge fields

ArcGrade returns this structure on HTTP 402:

```jsonc
{
  "x402": true,
  "slug": "morpho",
  "scope": "dossier",
  "amount": "10000",           // atomic USDC units (6 decimals) = $0.01
  "currency": "0x3600000000000000000000000000000000000000",
  "recipient": "0xdB99D…",    // ArcGrade's receiving address
  "network": "eip155:5042002",
  "resource": "https://<your-host>/api/v1/grade/morpho" // built from ARCGRADE_PUBLIC_URL
}
```

The same structure is mirrored as base64 in the `PAYMENT-REQUIRED` response header.

## Pricing

| Scope | Atomic units | USD |
|---|---|---|
| Full dossier (all 9 axes) | 10,000 | $0.01 |
| Single axis | 1,000 | $0.001 |

## Unlock response shape

```jsonc
{
  "ok": true,
  "slug": "morpho",
  "scope": "dossier",
  "mode": "onchain",
  "network": "eip155:5042002",
  "settleTx": "0x...",
  "payer": "0x...",
  "paid": "10000",
  "expiresIn": 3600,
  "receipt": {
    "token": "...",     // JWT receipt (also set as httpOnly cookie)
    "expiresAt": 1759000000,
    "scope": "dossier",
    "slug": "morpho"
  },
  "dossier": {
    "compositeGrade": 74,
    "weakestLink": "Oracle Risk",
    "riskLevel": "Medium",
    "summary": "...",
    "axes": [{ "id": "oracle", "name": "Oracle Risk", "score": 61, "weight": 0.18 }, ...],
    "citations": [{ "title": "...", "url": "..." }, ...]
  }
}
```

## Tests

```bash
# Unit + mock server + integration tests
node scripts/arc-agent-buyer.test.mjs

# Add --e2e to run the live Arc Testnet test (requires AGENT_PRIVATE_KEY + running server)
AGENT_PRIVATE_KEY=0x... ARCGRADE_URL=http://localhost:3001 \
  node scripts/arc-agent-buyer.test.mjs --e2e
```

Test coverage:
- Validation helpers (network, amount, currency, address format)
- Base64 challenge encode/decode roundtrip
- Mock HTTP server: 402 on probe, 400 on missing slug, 422 on bad txHash, 200 on valid txHash
- Full receipt + dossier structure validation
- Integration: DRY_RUN=1 runs without a wallet
- Integration: missing key exits non-zero with a helpful message
- Integration: unreachable server exits non-zero
- E2E: full end-to-end flow (opt-in, requires wallet + live server)

## Extending to x402 Gateway mode

The script uses the **direct on-chain** unlock path (Path 2 in `route.ts`). To use Circle Gateway nanopayments (Path 1), you would:

1. Build an x402 `payment-signature` header using `@circle-fin/x402-batching/client` or the Circle CLI (`circle services pay`).
2. Send it as the `payment-signature` body field (or `payment-signature` / `x-payment` header) in the initial POST.
3. Remove the `txHash` field — the server will call `verifyAndSettle` via its `BatchFacilitatorClient`.

This is what `@circle-fin/x402-batching` automates — see the Circle developer docs for the full client-side flow.
