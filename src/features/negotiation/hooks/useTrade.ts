import { getFriendlyApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useCallback, useEffect, useState } from "react";
import type { TradeRecord } from "@/types/domain";
import { tradesApi } from "../api/tradesApi";
import { useNegotiationThread } from "./useNegotiationThread";

/** Resolve a trade directly by id, or via a negotiation that created it. */
export function useTrade(tradeId?: string, negotiationId?: string) {
  const { runWithAuth } = useAuth();
  const { thread, isLoading: isThreadLoading, error: threadError } = useNegotiationThread(
    tradeId ? undefined : negotiationId,
  );
  const resolvedId = tradeId || thread?.tradeId;
  const [trade, setTrade] = useState<TradeRecord | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(resolvedId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!resolvedId) {
      setTrade(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setTrade(await runWithAuth((token) => tradesApi.byId(resolvedId, token)));
    } catch (e) {
      setError(getFriendlyApiError(e, "Could not load this trade"));
      setTrade(null);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedId, runWithAuth]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return {
    trade,
    tradeId: resolvedId,
    setTrade,
    isLoading: isLoading || isThreadLoading,
    error: error ?? threadError,
    retry: load,
  };
}
