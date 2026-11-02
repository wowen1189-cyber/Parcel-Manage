"use client";

import { useEffect, useState } from "react";

const BUILD = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
const EVERY = 5 * 60_000;

// Public pages (listings, applications, signing): visitors there aren't using the app, and a "new
// version" bar would only puzzle them, or tempt them to reload halfway through a form.
const PUBLIC = ["/rentals", "/apply", "/home-care", "/sign"];
const isPublic = (path: string) => path === "/" || PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));

// When a newer Parcel Manage is live, an open page keeps running the old one until it reloads. This
// checks every few minutes and when the tab comes back to the front, and offers a one-tap update.
export function UpdateBanner() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (BUILD === "dev" || isPublic(window.location.pathname)) return;
    let last = 0;
    const check = async () => {
      if (Date.now() - last < 30_000) return;
      last = Date.now();
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const { build } = (await res.json()) as { build?: string };
        if (build && build !== "dev" && build !== BUILD) setStale(true);
      } catch {
        // Offline: try again later.
      }
    };
    const onVisible = () => document.visibilityState === "visible" && check();
    const timer = setInterval(check, EVERY);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    void check();
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, []);
  if (!stale) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-[60] flex flex-wrap items-center justify-center gap-3 bg-accent-deep px-4 py-3 text-sm text-white shadow-lg print:hidden">
      <span>A new version of Parcel Manage is ready.</span>
      <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-[var(--radius-control)] bg-white px-4 font-semibold text-accent-deep hover:bg-accent-softer">
        Update now
      </button>
    </div>
  );
}
