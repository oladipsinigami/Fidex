"use client";

import { useEffect, useState } from "react";
import type { ToastKind, ToastPayload } from "@/lib/toast";

const TONE: Record<ToastKind, string> = {
  ok: "border-reserve/40 text-reserve",
  warn: "border-caution/40 text-caution",
  error: "border-stop/45 text-stop",
  info: "border-gold/35 text-gold",
};

type Item = ToastPayload & { id: number };

/** Stamped tickets, not Material snackbars. */
export function ToastHost() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let n = 0;
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastPayload>).detail;
      const id = ++n;
      setItems((xs) => [...xs, { ...detail, id }]);
      window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 6000);
    };
    window.addEventListener("arcgrade:toast", onToast);
    return () => window.removeEventListener("arcgrade:toast", onToast);
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className="no-print pointer-events-none fixed bottom-6 right-6 z-[80] flex w-[min(360px,calc(100vw-3rem))] flex-col gap-3"
      role="status"
      aria-live="polite"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto plate relative overflow-hidden border px-4 py-3 ${TONE[t.kind ?? "info"]}`}
        >
          <div className="flex items-start gap-3">
            {/* perforation edge */}
            <span
              aria-hidden
              className="mt-1 h-full w-[3px] shrink-0 rounded-full bg-current opacity-50"
            />
            <div className="min-w-0">
              <p className="label-xs text-current">{t.title}</p>
              {t.body && (
                <p className="mt-1.5 text-[12px] leading-relaxed text-paper/80">{t.body}</p>
              )}
              {t.ref && (
                <p className="num mt-1.5 truncate font-mono text-[10px] text-faint">{t.ref}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
