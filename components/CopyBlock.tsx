"use client";

import { useState } from "react";

/** Copy-paste block with a gold left rule. */
export function CopyBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="label-xs">{label}</p>
        <button onClick={copy} className="label-xs transition-colors hover:text-gold">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto border-l border-gold/40 bg-sunk/60 px-4 py-3.5 font-mono text-[11.5px] leading-relaxed text-paper/80">
        {code}
      </pre>
    </div>
  );
}
