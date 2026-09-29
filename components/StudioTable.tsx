"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, useSignTypedData } from "wagmi";
import type { Letter } from "@/lib/types";
import { GradeLetter } from "./RatingPlate";
import { ageLabel, bandFor, compositeOf, toneFor } from "@/lib/grade";
import { ATTESTATION_DOMAIN, ATTESTATION_TYPES } from "@/lib/attestation";

type RowState = "published" | "review" | "draft";

const CHIP: Record<RowState, string> = {
  published: "border-reserve/40 text-reserve",
  review: "border-caution/40 text-caution",
  draft: "border-paper/20 text-faint",
};

interface Attestation {
  id: string;
  slug: string;
  letter: string;
  score: number;
  analystAddress: string;
  signature: string;
  timestamp: number;
}

export interface StudioRow {
  slug: string;
  name: string;
  category: string;
  letter: Letter;
  score: number;
  updatedAt: string;
  isStale: boolean;
  axes: Array<{
    id: string;
    label: string;
    score: number;
    weight: number;
  }>;
}

/**
 * Analyst Studio Table.
 * Allows certified researchers to adjust axis ratings, inspect real-time
 * weakest-link compounding scores, and cryptographically sign EIP-712
 * attestations with an on-chain Web3 wallet on Arc Testnet.
 */
export function StudioTable({ rows }: { rows: StudioRow[] }) {
  const [state, setState] = useState<Record<string, RowState>>({});
  const [open, setOpen] = useState<string | null>(null);

  const statusOf = (p: StudioRow): RowState => {
    if (state[p.slug]) return state[p.slug];
    return p.isStale ? "review" : "published";
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="ledger w-full min-w-[820px] text-left text-[13px]">
          <thead>
            <tr className="label-xs">
              <th className="sticky-col py-3 pr-6 font-normal">Name</th>
              <th className="py-3 pr-6 font-normal">Letter</th>
              <th className="py-3 pr-6 font-normal">Score</th>
              <th className="py-3 pr-6 font-normal">Weakest axis</th>
              <th className="py-3 pr-6 font-normal">Updated</th>
              <th className="py-3 pr-6 font-normal">Status</th>
              <th className="py-3 font-normal">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const st = statusOf(p);
              const weakest = p.axes
                .filter((a) => a.weight > 0)
                .reduce((lo, a) => (a.score < lo.score ? a : lo));
              return (
                <tr key={p.slug} className="border-t border-paper/[0.06]">
                  <td className="sticky-col py-4 pr-6">
                    <Link href={`/p/${p.slug}`} className="text-paper hover:text-gold">
                      {p.name}
                    </Link>
                    <span className="label-xs ml-2">{p.category}</span>
                  </td>
                  <td className="py-4 pr-6">
                    <GradeLetter letter={p.letter} className="text-3xl" />
                  </td>
                  <td className="num py-4 pr-6 font-mono text-[13px] text-paper/85">{p.score}</td>
                  <td className="py-4 pr-6">
                    <span className="text-[12.5px] text-paper/85">{weakest.label}</span>
                    <span
                      className="num ml-2 font-mono text-[11px]"
                      style={{ color: toneFor(p.letter).ink }}
                    >
                      {weakest.score}
                    </span>
                  </td>
                  <td className="num py-4 pr-6 font-mono text-[12px] text-quiet">
                    {ageLabel(p.updatedAt)}
                  </td>
                  <td className="py-4 pr-6">
                    <span className={`label-xs rounded-[2px] border px-2 py-1 ${CHIP[st]}`}>
                      {st}
                    </span>
                  </td>
                  <td className="py-4">
                    <button
                      onClick={() => setOpen(open === p.slug ? null : p.slug)}
                      className="label-xs border border-paper/15 px-2.5 py-1.5 text-quiet transition-colors hover:border-gold/40 hover:text-gold"
                    >
                      {open === p.slug ? "Close" : "Attest / Edit"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <Editor
          slug={open}
          rows={rows}
          onClose={() => setOpen(null)}
          onAttested={(slug) => {
            setState((prev) => ({ ...prev, [slug]: "published" }));
          }}
        />
      )}
    </div>
  );
}

function Editor({
  slug,
  rows,
  onClose,
  onAttested,
}: {
  slug: string;
  rows: StudioRow[];
  onClose: () => void;
  onAttested: (slug: string) => void;
}) {
  const p = rows.find((r) => r.slug === slug);
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync, isPending } = useSignTypedData();

  // Axis score state
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    p?.axes.forEach((a) => {
      initial[a.id] = a.score;
    });
    return initial;
  });

  const [note, setNote] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [pastAttestations, setPastAttestations] = useState<Attestation[]>([]);

  // Fetch past attestations from SQLite
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/v1/attest?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.attestations) setPastAttestations(d.attestations);
      })
      .catch(() => {});
  }, [slug]);

  if (!p) return null;

  // Recompute composite dynamically
  const updatedAxes = p.axes.map((a) => ({
    ...a,
    score: scores[a.id] ?? a.score,
  }));
  const computedScore = compositeOf(updatedAxes);
  const computedLetter = bandFor(computedScore);

  async function handleSignAttestation() {
    if (!address || !isConnected) {
      setStatusMsg({ type: "error", text: "Please connect a Web3 wallet on Circle Arc Testnet first." });
      return;
    }

    try {
      setStatusMsg({ type: "info", text: "Awaiting wallet signature in MetaMask/Rabby…" });
      const now = Date.now();

      const signature = await signTypedDataAsync({
        domain: ATTESTATION_DOMAIN,
        types: ATTESTATION_TYPES,
        primaryType: "RatingAttestation",
        message: {
          slug: p!.slug,
          letter: computedLetter,
          score: BigInt(computedScore),
          analyst: address,
          timestamp: BigInt(now),
        },
      });

      setStatusMsg({ type: "info", text: "Verifying signature & persisting to Fidex ledger…" });

      const res = await fetch("/api/v1/attest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: p!.slug,
          letter: computedLetter,
          score: computedScore,
          analystAddress: address,
          signature,
          timestamp: now,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || json.error || "Attestation verification failed");
      }

      setStatusMsg({
        type: "success",
        text: `Attestation confirmed & saved to SQLite ledger (ID: ${json.attestationId}).`,
      });

      setPastAttestations((prev) => [
        {
          id: json.attestationId,
          slug: p!.slug,
          letter: computedLetter,
          score: computedScore,
          analystAddress: address,
          signature,
          timestamp: now,
        },
        ...prev,
      ]);

      onAttested(p!.slug);
    } catch (err: unknown) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <div className="plate mt-8 p-7 border border-gold/30">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-paper">{p.name} — Cryptographic Rating Studio</h2>
          <p className="label-xs text-gold/80 mt-1">
            Dynamic Score: <span className="font-mono text-paper">{computedScore}</span> &middot; Letter:{" "}
            <span className="font-display text-gold text-lg">{computedLetter}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="label-xs text-faint hover:text-paper border border-paper/10 px-3 py-1.5"
        >
          Close Editor ✕
        </button>
      </div>

      <div className="rule-draw my-5" />

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left: Dynamic Axis Score Sliders */}
        <div className="lg:col-span-6">
          <p className="label-xs mb-3">Axis scores (Editable)</p>
          <ul className="space-y-2.5">
            {p.axes.map((a) => (
              <li key={a.id} className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-[12px] text-quiet truncate">{a.label}</span>
                <input
                  type="number"
                  value={scores[a.id] ?? a.score}
                  min={0}
                  max={100}
                  onChange={(e) => {
                    const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                    setScores((prev) => ({ ...prev, [a.id]: val }));
                  }}
                  aria-label={`${a.label} score`}
                  className="num w-16 border border-gold/30 bg-panel px-2 py-1 text-center font-mono text-[12px] text-paper outline-none focus:border-gold"
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={scores[a.id] ?? a.score}
                  onChange={(e) => {
                    setScores((prev) => ({ ...prev, [a.id]: Number(e.target.value) }));
                  }}
                  className="w-24 accent-gold"
                />
                <span className="label-xs text-[10px] text-faint">
                  {a.weight > 0 ? `w ${(a.weight * 100).toFixed(0)}%` : "display"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-faint">
            Modifying axis scores recalculates the weakest-link composite formula in real time.
          </p>
        </div>

        {/* Right: EIP-712 Signing Panel & Attestation History */}
        <div className="lg:col-span-6 flex flex-col justify-between">
          <div>
            <p className="label-xs">Analyst Attestation &amp; Cryptographic Proof</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Analyst research citation or changelog notes…"
              className="mt-2.5 w-full resize-none border border-paper/12 bg-panel px-3 py-2 text-[12.5px] leading-relaxed text-paper outline-none focus:border-gold/40 placeholder:text-faint"
            />

            <div className="mt-4 p-4 border border-paper/10 bg-panel/60 rounded-[2px]">
              <div className="flex items-center justify-between text-[11.5px] text-faint mb-2">
                <span>EIP-712 Domain:</span>
                <span className="font-mono text-paper">Fidex Studio (5042002)</span>
              </div>
              <div className="flex items-center justify-between text-[11.5px] text-faint mb-2">
                <span>Connected Analyst:</span>
                <span className="font-mono text-gold">
                  {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Wallet Not Connected"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11.5px] text-faint">
                <span>Attested Target:</span>
                <span className="font-mono text-paper">{p.slug} &middot; {computedLetter} ({computedScore})</span>
              </div>
            </div>

            {statusMsg && (
              <div
                className={`mt-3 p-3 text-[12px] font-mono rounded-[2px] ${
                  statusMsg.type === "success"
                    ? "border border-reserve/40 bg-reserve/10 text-reserve"
                    : statusMsg.type === "error"
                    ? "border border-stop/40 bg-stop/10 text-stop"
                    : "border border-gold/40 bg-gold/10 text-gold"
                }`}
              >
                {statusMsg.text}
              </div>
            )}

            <button
              onClick={handleSignAttestation}
              disabled={isPending || !isConnected}
              className="mt-5 w-full rounded-[2px] border border-gold bg-gold/15 py-3 font-display text-[15px] font-semibold text-paper transition-all hover:bg-gold/25 disabled:opacity-50"
            >
              {isPending
                ? "Signing EIP-712 in Wallet…"
                : isConnected
                ? `Cryptographically Sign Attestation (${computedLetter})`
                : "Connect Wallet to Sign"}
            </button>
          </div>

          {/* Past Attestations Ledger */}
          {pastAttestations.length > 0 && (
            <div className="mt-6 border-t border-paper/10 pt-4">
              <p className="label-xs text-faint mb-2">Durable Attestations (SQLite)</p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {pastAttestations.map((att) => (
                  <div key={att.id} className="text-[11px] font-mono flex items-center justify-between text-quiet bg-sunk/40 px-2 py-1">
                    <span>
                      <strong className="text-gold">{att.letter}</strong> ({att.score}) by {att.analystAddress.slice(0, 6)}…
                    </span>
                    <span className="text-faint">{ageLabel(new Date(att.timestamp).toISOString())}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
