import { useCallback, useEffect, useState } from "react";
import { getFriendlyApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { Order } from "@/types/domain";

/**
 * Broker's own trades. Calls the existing trades endpoint with a
 * broker-scoped query. The backend contract for broker-scoped trades is
 * not finalized yet — this hook degrades gracefully when the endpoint
 * returns empty or 404, so the UI can render an empty state instead of
 * crashing. When the backend contract lands, swap the fetch call.
 */
export function useBrokerTrades() {
  const { runWithAuth, session } = useAuth();
  const [trades, setTrades] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = session?.user.id;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // TODO: replace with a real broker-trades endpoint when available.
      // For now, reuse the generic trades endpoint with the caller's user id
      // so the backend can scope the response to trades where this broker
      // was the intermediary. The endpoint is not yet implemented, so we
      // catch 404s and render an empty state instead of crashing.
      const result: Order[] = await runWithAuth(async (token) => {
        const url = `/trades${userId ? `?brokerId=${encodeURIComponent(userId)}` : ""}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 404) return [];
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return Array.isArray(json) ? json : (json?.items ?? []);
      });
      setTrades(result);
    } catch (e) {
      // 404 / network error → empty state, not a crash.
      setError(getFriendlyApiError(e, "Could not load your trades"));
    } finally {
      setIsLoading(false);
    }
  }, [runWithAuth, userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return { trades, isLoading, error, retry: load };
}