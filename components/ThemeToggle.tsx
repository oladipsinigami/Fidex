"use client";

import { useEffect, useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("fidex:theme", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("fidex:theme", callback);
  };
}

function getSnapshot(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem("fidex_theme") as "light" | "dark") || "light";
}

function getServerSnapshot(): "light" | "dark" {
  return "light";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    localStorage.setItem("fidex_theme", next);
    document.documentElement.setAttribute("data-theme", next);
    window.dispatchEvent(new CustomEvent("fidex:theme", { detail: { theme: next } }));
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      onClick={toggleTheme}
      className={`group relative inline-flex h-6 w-11 items-center rounded-full border border-current/30 p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current ${
        isDark ? "bg-current/15" : "bg-current/5"
      } ${className}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-current shadow-sm transition-transform duration-200 ease-out ${
          isDark ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
