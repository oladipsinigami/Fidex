<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# ArcGrade — verified facts and design rules

## Verified chain facts (`lib/arcchain.ts`)

Do not change these from memory. Re-verify with the commands below.

| Fact | Value | How it was verified |
| --- | --- | --- |
| Testnet Chain ID (Active) | `5042002` (`eip155:5042002`) | docs.arc.io; `eth_chainId` → `0x4cef52` |
| Testnet RPC | `https://rpc.testnet.arc.io` | docs.arc.io; live JSON-RPC call |
| Testnet Explorer | `https://explorer.testnet.arc.io` | docs.arc.io |
| Mainnet Chain ID | `5042` (`eip155:5042`) | `eth_chainId` → `0x13b2` |
| Mainnet RPC | `https://rpc.mainnet.arc.io` | docs.arc.io; live JSON-RPC call |
| Mainnet Explorer | `https://explorer.arc.io` | docs.arc.io (there is no `arcscan.app`) |
| Native gas | USDC, 18 decimals | docs.arc.io |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000` | `symbol()` → `USDC` (Same on mainnet & testnet) |
| USDC decimals | `6` | `decimals()` → `0x06` |
| CCTP domain | `26` | Circle contract-address reference |
| TokenMessengerV2 | `0x28b5a0e9…cf5d` | `owner()` responded on Arc |

```powershell
# Chain ID and head
(Invoke-RestMethod https://rpc.mainnet.arc.io -Method Post -Body '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' -ContentType application/json).result

# USDC symbol / decimals
#   symbol()    = 0x95d89b41  -> 55534443 ("USDC")
#   decimals()  = 0x313ce567  -> 06
```

## Two-tier rating

- **Hand-analysed** (`data/*.ts`): all nine axes with citations. These earn letters.
- **Screened** (`lib/discover.ts`): discovered live from DeFiLlama. Only
  liquidity, audits, history and arc-fit have a public datum.

`lib/screen.ts` publishes a letter **only at or above `MIN_COVERAGE` (60%)** of
compounding weight. Do not lower it to make the table look fuller, and do not
fill an unmeasured axis with a default — renormalising a missing axis to
"average" is the exact error the multiplicative composite exists to prevent.

## Payment modes

`ARCGRADE_X402_MODE` selects the settlement path, and the challenge metadata
**must** match it. Advertising `GatewayWalletBatched` to a plain facilitator
leaves the buyer signing EIP-712 against a contract that facilitator does not
know, so the payment can never complete.

| | gateway | http |
| --- | --- | --- |
| `extra.name` | `GatewayWalletBatched` | `USDC` |
| `extra.verifyingContract` | Gateway wallet for the chain | absent |
| `maxTimeoutSeconds` | 345600 (batched) | 300 |

Gateway settlement wallet per chain (from the SDK's `CHAIN_CONFIGS`, which
disagrees with a single global constant — do not hardcode one value):

- testnet `0x0077777d7EBA4688BDeF3E311b846F25870A19B9`
- mainnet `0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE`

### Circle runs TWO Gateway hosts — pick by network

There is a separate Gateway facilitator per network, and each serves **only its
own** chains. This is the single most misleading thing in the setup, because
the wrong host answers `unsupported_network` for a chain it genuinely supports
somewhere else:

| `ARCGRADE_NETWORK` | Gateway host | Arc chain served |
| --- | --- | --- |
| `testnet` | `gateway-api-testnet.circle.com` | `eip155:5042002` |
| `mainnet` | `gateway-api.circle.com` | `eip155:5042` |

Verify with `GET <host>/v1/x402/supported`. The mainnet host returns 12
networks with **no testnets**; the testnet host returns 12 with **no mainnet**.

Two traps, both of which cost real time:

- **The SDK option is `url`, not `facilitatorUrl`.** Passing `facilitatorUrl`
  is silently ignored and the client falls back to the mainnet host, so testnet
  payments fail with `unsupported_network` even though support exists. No
  warning is emitted.
- **The SDK's own `GATEWAY_DOMAINS` map lists `arcTestnet: 26` while its default
  URL is the mainnet host.** The constants are not a reliable guide; the
  endpoint is the source of truth.
- Sepolia also returns `unsupported_network` from the mainnet host, so one
  chain failing is not proof that chain is unsupported anywhere. Always read
  the whole list, and check the *other* host before concluding anything.

Confirmed working: a real EIP-3009 authorisation signed against
`GatewayWalletBatched` + the testnet verifying contract verifies
`isValid: true` on `gateway-api-testnet.circle.com`.

## Payments

`lib/x402.ts` settles through **Circle Gateway nanopayments**
(`BatchFacilitatorClient` from `@circle-fin/x402-batching`), following the
official `circlefin/arc-nanopayments` reference app.

Hard rules — a receipt is minted only after verify **and** settle both succeed
and the amount matches. Do not add a path where a caller-supplied reference
mints a receipt; `ref` in the request body is never read. Simulation mode
refuses to run when `NODE_ENV=production`.

**There must be exactly one challenge builder.** It lives in `lib/x402.ts`.
A duplicate in the `/api/v1/grade/[slug]` route once drifted and emitted
x402 v1 + mainnet + no Gateway, which would have advertised an unusable
payment option to buyers. Both routes import `challenge()` from the module.

Buyer sends the payload in the **`payment-signature`** header (not `X-PAYMENT`).
`paymentHeader()` accepts both, and the server must also mirror the challenge
into a base64 `PAYMENT-REQUIRED` header and the settlement into
`PAYMENT-RESPONSE`.

Verified constants (from the reference app, not guessed):

| Fact | Value |
| --- | --- |
| Gateway settlement wallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |
| `extra.name` | `GatewayWalletBatched` |
| `extra.verifyingContract` | the Gateway wallet above |
| Settlement window | `maxTimeoutSeconds: 345600` (batched, not 60) |
| Price fields | `amount` + `asset`, **not** `maxAmountRequired` + top-level `asset` |

### `self_transfer` — the buyer and seller must differ

Circle's facilitator refuses a payment whose payer equals its `payTo`,
returning `isValid: false, invalidReason: "self_transfer"`:

```
payTo == payer (self)    -> {"isValid":false,"invalidReason":"self_transfer"}
payTo != payer (other)   -> {"isValid":true}
```

This is correct behaviour, not a bug to work around. If paying yourself were
allowed, anyone could unlock paid content with a wallet that never spends
anything, so the payment would prove nothing. **Never "fix" this by special-
casing the seller address** — the seller genuinely must be a different account.

The practical consequence for testing: a single funded wallet cannot be both
buyer and seller. The **seller needs no funds** (it only receives, and Gateway
settlement is gasless), so any second address works — a second Foundry account
or a throwaway one. Only the buyer needs the 499 testnet USDC.

`settle:live` now checks this before spending anything and exits `4` with an
explanation, instead of letting the buyer sign and then surfacing Circle's
opaque `self_transfer` as a 402.

### Verifying payment code

```powershell
npm run verify:challenge   # 13 checks: challenge shape on Arc testnet, no funds needed
npm run verify:payments    # 20 checks: fail-closed behaviour, no funds needed
$env:ARCGRADE_NETWORK='testnet'; npm run verify:payments   # testnet network id
node scripts/diagnose-gateway.mjs   # hits Circle's LIVE facilitator, no funds needed
npm run settle:live        # REAL settlement, needs a funded buyer key
```

`settle:live` requires `ARCGRADE_BUYER_PRIVATE_KEY` (funded from
https://faucet.circle.com) or a Foundry keystore, plus `ARCGRADE_PAY_TO` —
which must differ from the buyer address (see above). The keystore password is
read from the TTY, or from `FOUNDRY_PASSWORD` / `ARCGRADE_KEYSTORE_PASSWORD`
for non-interactive runs.

### Circle's facilitator requires these on paymentPayload

Verified by calling the facilitator directly, not inferred. Missing any one
produces an opaque error:

| Field | Source | Error if missing |
| --- | --- | --- |
| `payload.authorization` | SDK | `missing_payment_payload` / `unsupported_network` |
| `resource` | buyer echoes the challenge | 400 `resource: Required` |
| `accepted` | buyer echoes the challenge | 400 `accepted: Required` |
| `network` | **server** states it | `unsupported_network` |

`createPaymentPayload` returns only `{x402Version, payload}`. The buyer must add
`resource` + `accepted`; the server must add `network` because the buyer omits
it. Do not "fix" the server by trusting a buyer-supplied `network` — reject a
mismatch and otherwise state our own.

`diagnose-gateway.mjs` separates our code from wallet funding: it signs with a
throwaway key, and reports whether the rejection came from *our* validation or
from Circle. Run it before `settle:live` when a settlement fails.



