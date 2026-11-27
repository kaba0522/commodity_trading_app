import { useAuth } from "@/features/auth/hooks/useAuth";
import { useCallback } from "react";
import type { TradeRecord } from "@/types/domain";
import { tradesApi, type ChooseBrokerInput } from "../api/tradesApi";

/** Mutating §22C trade calls used by the confirmation screen. */
export function useTradeActions() {
  const { runWithAuth } = useAuth();

  const chooseBroker = useCallback(
    async (tradeId: string, input: ChooseBrokerInput): Promise<TradeRecord> =>
      runWithAuth((token) => tradesApi.chooseBroker(tradeId, input, token)),
    [runWithAuth],
  );

  const cancel = useCallback(
    async (tradeId: string): Promise<TradeRecord> =>
      runWithAuth((token) => tradesApi.cancel(tradeId, token)),
    [runWithAuth],
  );

  return { chooseBroker, cancel };
}
