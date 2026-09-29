import type { Metadata } from "next";
import { METHODOLOGY_VERSION } from "@/lib/grade";
import { siteUrl } from "@/lib/site";
import { CopyBlock } from "@/components/CopyBlock";
import { PROTOCOLS } from "@/data/protocols";

export const metadata: Metadata = {
  title: "Agent API",
  description:
    "Query Fidex programmatically. A free summary endpoint and an x402-paywalled full grade, settled in USDC on Circle Arc.",
};

const SUMMARY = `curl -s ${siteUrl("/api/v1/grade/aave-v4-arc/summary")}`;

const SUMMARY_RES = `{
  "slug": "aave-v4-arc",
  "letter": "A",
  "score": 85,
  "oneLiner": "Deepest audited lending deployment on Arc. Admin surface is real but timelocked and slow.",
  "updatedAt": "2026-09-26T09:12:00.000Z"
}`;

const PAID = `curl -s ${siteUrl("/api/v1/grade/aave-v4-arc")}`;

const PAID_AUTH = `curl -s ${siteUrl("/api/v1/grade/aave-v4-arc")} \\
  -H "payment-signature: <base64-x402-v2-signature>"`;

const CHALLENGE = `HTTP/1.1 402 Payment Required
Content-Type: application/json
PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6MiwicmVzb3VyY2UiOi... (base64)
X-Fidex-Method: ${METHODOLOGY_VERSION}
X-ArcGrade-Method: ${METHODOLOGY_VERSION}

{
  "x402Version": 2,
  "resource": {
    "url": "${siteUrl("/api/v1/grade/aave-v4-arc")}",
    "description": "Full Fidex dossier: all nine axes, evidence, citations.",
    "mimeType": "application/json"
  },
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:5042002",
    "amount": "10000",
    "asset": "0x3600000000000000000000000000000000000000",
    "payTo": "0xdB99D8C6b401cF97eaE6c835345938edF5299d25",
    "maxTimeoutSeconds": 345600,
    "extra": {
      "name": "GatewayWalletBatched",
      "version": "1",
      "verifyingContract": "0x0077777777777777777777777777777777770001",
      "slug": "aave-v4-arc",
      "scope": "dossier",
      "axisId": null
    }
  }]
}`;

const AXIS_RES = `{
  "slug": "aave-v4-arc",
  "letter": "A",
  "score": 85,
  "stale": false,
  "method": "${METHODOLOGY_VERSION}",
  "hash": "0x8f2a41c9d7b3e650...",
  "updatedAt": "2026-09-26T09:12:00.000Z",
  "analystId": "analyst-017",
  "axes": [
    {
      "id": "security",
      "label": "Security",
      "weight": 0.18,
      "score": 92,
      "compounding": true,
      "summary": "Audited core, no open criticals, live bounty.",
      "evidence": "Two recognised firms reviewed the V4 core with the Arc deployment in scope...",
      "citations": [{ "label": "V4 audit directory", "href": "https://...", "kind": "audit" }]
    }
  ],
  "killShots": [ /* 3 items */ ],
  "unlocks": [ /* calendar */ ],
  "incidents": [ /* log */ ]
}`;

const POLICY = `// Before allocating, surface the letter to the user.
const g = await fetch(SUMMARY_URL).then(r => r.json());

if (g.letter === "D" || g.letter === "F") {
  return refuse("Grades " + g.letter + " — not a savings account.");
}
// D or F never proceeds without an explicit human override.`;


export default function AgentsPage() {
  return (
    <div className="mx-auto max-w-[1120px] px-5 py-16">
      <header className="max-w-3xl">
        <p className="label-xs text-gold">Agent API &middot; x402 v2 &middot; Circle Arc Testnet 5042002</p>
        <h1 className="mt-5 font-display text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.02] tracking-[-0.02em] text-paper">
          Query the book
        </h1>
        <p className="mt-6 font-display text-[19px] leading-relaxed text-paper/85">
          Surface the letter to the user before allocating.
        </p>
        <p className="mt-5 text-[14px] leading-relaxed text-quiet">
          One free endpoint for the letter. One paywalled endpoint for everything behind
          it, settled per request in USDC on Circle Arc Testnet. No keys, no account, no rate-limit
          negotiation &mdash; just HTTP, an x402 challenge, and verifiable settlement.
        </p>
      </header>

      <div className="rule-draw my-12" />

      <section className="mb-14">
        <h2 className="font-display text-2xl text-paper">Free &middot; summary</h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-quiet">
          Letter, score, one-liner, timestamp. Cacheable for five minutes. Call this
          first; it is enough to decide whether to proceed.
        </p>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <CopyBlock label="Request" code={SUMMARY} />
          <CopyBlock label="Response" code={SUMMARY_RES} />
        </div>
      </section>

      <section className="mb-14">
        <h2 className="font-display text-2xl text-paper">Paid &middot; full grade (x402 v2)</h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-quiet">
          <span className="num font-mono text-gold">$0.01 USDC (10,000 atomic units)</span> for the full
          dossier, <span className="num font-mono text-gold">$0.001</span> for a single
          axis via <span className="font-mono text-[12px]">?axis=&lt;id&gt;</span>. The
          server issues a 402 challenge with base64 <span className="font-mono text-[12px]">PAYMENT-REQUIRED</span> header until paid.
        </p>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <CopyBlock label="1. Challenge Request (Unpaid)" code={PAID} />
          <CopyBlock label="2. 402 Challenge (With Headers)" code={CHALLENGE} />
        </div>
        <div className="mt-6">
          <CopyBlock label="3. Settled Request with payment-signature Header" code={PAID_AUTH} />
        </div>
        <div className="mt-6">
          <CopyBlock label="4. Decrypted Dossier Response" code={AXIS_RES} />
        </div>
      </section>

      <section className="mb-14">
        <h2 className="font-display text-2xl text-paper">Policy</h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-quiet">
          An agent that allocates on Fidex data is expected to show the letter to the
          user first. A D or F is a refusal prompt, not a suggestion.
        </p>
        <div className="mt-6">
          <CopyBlock label="Reference policy" code={POLICY} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl text-paper">Rated names</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-quiet">
          Every slug below resolves on both endpoints. An unknown slug returns 404 with{" "}
          <span className="font-mono text-[12px]">not_rated</span>, which is
          deliberately distinct from a 402.
        </p>
        <div className="mt-6 border border-paper/[0.07]">
          {PROTOCOLS.map((p, i) => (
            <div
              key={p.slug}
              className={`flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5 ${
                i > 0 ? "border-t border-paper/[0.06]" : ""
              }`}
            >
              <span className="num w-24 shrink-0 font-mono text-[12px] text-gold">
                {p.letter} {p.score}
              </span>
              <span className="font-mono text-[12px] text-paper/85">{p.slug}</span>
              <span className="label-xs ml-auto">{p.category}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
