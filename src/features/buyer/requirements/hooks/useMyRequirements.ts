import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getFriendlyApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { requirementsApi } from "@/features/buyer/requirements/api/requirementsApi";
import { catalogApi } from "@/features/shared/catalog/api/catalogApi";
import type { BuyerRequirement } from "@/types/domain";

/**
 * Buyer's own posted requirements. The backend defaults
 * `GET /listings?side=BUY` to the caller's own requirements when the caller
 * holds the buyer role — so this is the "My requirements" list, the mirror
 * of the seller's Today's-listings dashboard. `status=active,price_expired`
 * (backend default is `active`-only, which would hide price-expired rows).
 */
export function useMyRequirements() {
  const { runWithAuth } = useAuth();
  const [items, setItems] = useState<BuyerRequirement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const categoryById = new Map<string, string>();
      const commodityToCategory = new Map<string, string>();
      try {
        const [categories, commodities] = await runWithAuth((token) =>
          Promise.all([
            catalogApi.getCommodityCategories(token),
            catalogApi.getCommodities(token),
          ]),
        );
        for (const category of categories) {
          categoryById.set(category.id, category.name);
        }
        for (const commodity of commodities) {
          const categoryName =
            categoryById.get(commodity.categoryId) || commodity.categoryName;
          if (categoryName) {
            commodityToCategory.set(commodity.id, categoryName);
          }
        }
      } catch {
        // Listings can still supply category names directly when the catalog is unavailable.
      }

      // runWithAuth refreshes the 15m access token on 401 and retries once.
      setItems(
        await runWithAuth((token) =>
          requirementsApi.list(token, {
            status: "active,price_expired",
            categoryById,
            commodityToCategory,
          }),
        ),
      );
    } catch (e) {
      setError(getFriendlyApiError(e, "Could not load your requirements"));
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

  // Refetch when coming back from the post form / detail (e.g. after a
  // publish or withdraw) so the list is always current.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /** Withdraw one requirement, then reload. Returns true on success. */
  const withdraw = useCallback(
    async (id: string | number): Promise<boolean> => {
      setWithdrawingId(String(id));
      setError(null);
      try {
        await runWithAuth((token) => requirementsApi.withdraw(id, token));
        await load();
        return true;
      } catch (e) {
        setError(getFriendlyApiError(e, "Could not withdraw the requirement"));
        return false;
      } finally {
        setWithdrawingId(null);
      }
    },
    [load, runWithAuth],
  );

  return {
    items,
    count: items.length,
    isLoading,
    error,
    retry: load,
    withdraw,
    withdrawingId,
  };
}
