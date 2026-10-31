"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-fetches the current admin page on a timer (and when the tab is shown again), so new comments and the
 * pending count update without a reload. It only runs while the tab is visible, and keeps scroll position.
 */
export function AutoRefresh({ intervalMs = 20_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs]);
  return null;
}
