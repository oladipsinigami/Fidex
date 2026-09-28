"use client";

import { useState } from "react";
import { siteUrl } from "@/lib/site";

export interface AgentSnippetData {
  slug: string;
  letter: string | null;
  score: number | null;
  contentHash: string;
  methodologyVersion: string;
}

/** Copy-paste agent block with a gold left rule. */
export function AgentSnippet({ snippet: p, paid }: { snippet: AgentSnippetData; paid: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);

  const curl = `curl -s ${siteUrl(`/api/v1/grade/${p.slug}/summary`)}`;
  const paidCurl = `curl -s ${siteUrl(`/api/v1/grade/${p.slug}`)}`;
  const preview = {
    slug: p.slug,
    letter: p.letter,
    score: p.score,
    stale: false,
    hash: `${p.contentHash.slice(0, 18)}…`,
    method: p.methodologyVersion,
  };

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="plate h-full p-7">
      <p className="label-xs">For agents</p>
      <h3 className="mt-4 font-display text-2xl text-paper">Query this grade</h3>
      <p className="mt-3 text-[13px] leading-relaxed text-quiet">
        The summary endpoint is free and cacheable. The full grade returns 402 until
        paid. Surface the letter to the user before allocating.
      </p>

      <div className="mt-6 space-y-4">
        <Block label="Free · summary" code={curl} copied={copied === "free"} onCopy={copy} />
        <Block
          label="Paid · full grade"
          code={paidCurl}
          copied={copied === "paid"}
          onCopy={copy}
          locked={!paid}
        />
      </div>

      <p className="label-xs mt-6">Response</p>
      <pre className="num mt-2 overflow-x-auto border-l border-gold/40 bg-sunk/60 px-4 py-3 font-mono text-[11px] leading-relaxed text-paper/75">
        {JSON.stringify(preview, null, 2)}
      </pre>
    </div>
  );
}

function Block({
  label,
  code,
  copied,
  onCopy,
  locked,
}: {
  label: string;
  code: string;
  copied: boolean;
  onCopy: (t: string, k: string) => void;
  locked?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="label-xs">{label}</p>
        <button
          onClick={() => onCopy(code, locked ? "paid" : "free")}
          className="label-xs transition-colors hover:text-gold"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mt-2 overflow-x-auto border-l border-gold/40 bg-sunk/60 px-4 py-2.5 font-mono text-[11px] text-paper/80">
        {code}
      </pre>
    </div>
  );
}
