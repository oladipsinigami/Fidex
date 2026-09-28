export type ToastKind = "ok" | "warn" | "error" | "info";

export type ToastPayload = {
  title: string;
  body?: string;
  kind?: ToastKind;
  /** Optional receipt-style mono line, e.g. a tx hash or receipt id. */
  ref?: string;
};

/**
 * Toasts are dispatched as a window event so any server or client module can
 * raise one without threading a context through the tree.
 */
export function toast(payload: ToastPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastPayload>("arcgrade:toast", { detail: payload }));
}
