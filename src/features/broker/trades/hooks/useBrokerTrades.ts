import { getFriendlyApiError } from "@/core/api/client";
import { formatDateLabel } from "@/core/utils/format";
import { brokersApi } from "@/features/negotiation/api/brokersApi";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useCallback, useEffect, useState } from "react";
import type { Order } from "@/types/domain";

/**
 * Broker's own trades — `GET /brokers/me/trades`, mapped onto the shared
 * `Order` card shape used by the broker workspace.
 */
export function useBrokerTrades() {
  const { runWithAuth } = useAuth();
  const [trades, setTrades] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await runWithAuth((token) => brokersApi.myTrades(token));
      setTrades(
        rows.map((trade) => ({
          id: trade.id,
          item: trade.item,
          seller: trade.seller,
          bags: trade.bags,
          price: trade.price,
          date: trade.confirmedAt
            ? formatDateLabel(trade.confirmedAt)
            : trade.createdAt
              ? formatDateLabel(trade.createdAt)
              : "",
          status: trade.status,
        })),
      );
    } catch (e) {
      setError(getFriendlyApiError(e, "Could not load your trades"));
      setTrades([]);
    } finally {
      setIsLoading(false);
    }
  }, [runWithAuth]);

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
