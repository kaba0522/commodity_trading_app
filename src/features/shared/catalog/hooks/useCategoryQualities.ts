import { getFriendlyApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
  catalogApi,
  type CatalogQuality,
} from "@/features/shared/catalog/api/catalogApi";
import { useCallback, useEffect, useState } from "react";

interface QualitiesState {
  categoryId: string | null;
  retryCount: number;
  qualities: CatalogQuality[];
  error: string | null;
}

/**
 * Loads quality choices for the selected category from the backend.
 * Passing null clears the choices until a category is selected.
 */
export function useCategoryQualities(categoryId: string | null) {
  const { runWithAuth } = useAuth();
  const [state, setState] = useState<QualitiesState>({
    categoryId: null,
    retryCount: 0,
    qualities: [],
    error: null,
  });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!categoryId) return;
    (async () => {
      try {
        const qualities = await runWithAuth((token) =>
          catalogApi.getQualities(token, categoryId),
        );
        if (!cancelled) {
          setState({
            categoryId,
            retryCount,
            qualities,
            error: null,
          });
        }
      } catch (cause) {
        if (!cancelled) {
          setState({
            categoryId,
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
  }, [categoryId, retryCount, runWithAuth]);

  const retry = useCallback(() => {
    setRetryCount((count) => count + 1);
  }, []);

  const isCurrentRequest =
    state.categoryId === categoryId && state.retryCount === retryCount;
  return {
    qualities: isCurrentRequest ? state.qualities : [],
    isLoading: categoryId !== null && !isCurrentRequest,
    error: isCurrentRequest ? state.error : null,
    retry,
  };
}
