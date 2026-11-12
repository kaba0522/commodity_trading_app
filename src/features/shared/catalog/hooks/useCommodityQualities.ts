import { getFriendlyApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
  catalogApi,
  type CatalogQuality,
} from "@/features/shared/catalog/api/catalogApi";
import { useCallback, useEffect, useState } from "react";

interface QualitiesState {
  commodityId: string | null;
  retryCount: number;
  qualities: CatalogQuality[];
  error: string | null;
}

/**
 * Loads quality choices for the selected commodity from the backend.
 * Qualities belong to a commodity, so changing the commodity reloads them.
 * Passing null clears the choices until a commodity is selected.
 */
export function useCommodityQualities(commodityId: string | null) {
  const { runWithAuth } = useAuth();
  const [state, setState] = useState<QualitiesState>({
    commodityId: null,
    retryCount: 0,
    qualities: [],
    error: null,
  });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!commodityId) return;
    (async () => {
      try {
        const qualities = await runWithAuth((token) =>
          catalogApi.getQualities(token, commodityId),
        );
        if (!cancelled) {
          setState({
            commodityId,
            retryCount,
            qualities,
            error: null,
          });
        }
      } catch (cause) {
        if (!cancelled) {
          setState({
            commodityId,
            retryCount,
            qualities: [],
            error: getFriendlyApiError(cause, "Could not load qualities"),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [commodityId, retryCount, runWithAuth]);

  const retry = useCallback(() => {
    setRetryCount((count) => count + 1);
  }, []);

  const isCurrentRequest =
    state.commodityId === commodityId && state.retryCount === retryCount;
  return {
    qualities: isCurrentRequest ? state.qualities : [],
    isLoading: commodityId !== null && !isCurrentRequest,
    error: isCurrentRequest ? state.error : null,
    retry,
  };
}
