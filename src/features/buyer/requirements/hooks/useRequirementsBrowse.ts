import { getFriendlyApiError } from "@/core/api/client";
import { bagsLabel, priceLabel } from "@/core/utils/format";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { requirementsApi } from "@/features/buyer/requirements/api/requirementsApi";
import { catalogApi } from "@/features/shared/catalog/api/catalogApi";
import type { BuyerRequirement } from "@/types/domain";
import { useCallback, useEffect, useMemo, useState } from "react";

export type ReqMode = "commodity" | "buyer";
export type ReqCategory = string;

export interface RequirementRow extends BuyerRequirement {
  priceText: string;
  wantsText: string;
  paysText: string;
}

export interface BuyerGroup {
  buyer: string;
  rows: RequirementRow[];
}

export function toRequirementRow(
  r: BuyerRequirement,
  hideBuyer: boolean,
): RequirementRow {
  return {
    ...r,
    priceText: priceLabel(r.targetPrice),
    wantsText: hideBuyer
      ? `wants ${bagsLabel(r.bags)}`
      : `${r.buyer} · wants ${bagsLabel(r.bags)}`,
    paysText: r.paymentTerms ? `Pays in ${r.paymentTerms}` : "Terms on request",
  };
}

/**
 * Seller buyer-requirements (Seller App.html `isRequirements`):
 * By Commodity rows grouped under every category, By Buyer sections with name search.
 * Live backend only — requirement-flagged entries of GET `/listings` plus
 * categories from GET `/commodity-categories` (derived fallback).
 */
export function useRequirementsBrowse() {
  const { runWithAuth } = useAuth();
  const [mode, setMode] = useState<ReqMode>("commodity");
  const [buyerSearch, setBuyerSearch] = useState("");
  const [collapsed, setCollapsed] = useState<readonly string[]>([]);
  const [source, setSource] = useState<BuyerRequirement[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const categoryById = new Map<string, string>();
      const commodityToCategory = new Map<string, string>();
      let catalogCategoryNames: string[] = [];
      try {
        const [catalogCategories, commodities] = await runWithAuth((token) =>
          Promise.all([
            catalogApi.getCommodityCategories(token),
            catalogApi.getCommodities(token),
          ]),
        );
        catalogCategoryNames = catalogCategories.map((category) => category.name);
        for (const catalogCategory of catalogCategories) {
          categoryById.set(catalogCategory.id, catalogCategory.name);
        }
        for (const commodity of commodities) {
          const categoryName =
            categoryById.get(commodity.categoryId) || commodity.categoryName;
          if (categoryName) commodityToCategory.set(commodity.id, categoryName);
        }
      } catch {
        // Category names embedded in buyer listings remain usable without catalogs.
      }

      const fetched = await runWithAuth((token) =>
        requirementsApi.list(token, { categoryById, commodityToCategory }),
      );
      setSource(fetched);
      setCategories([
        ...new Set([
          ...catalogCategoryNames,
          ...fetched.map((requirement) => requirement.category),
        ]),
      ]);
    } catch (e) {
      setError(getFriendlyApiError(e, "Could not load buyer requirements"));
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

  const rows = useMemo(
    () => source.map((r) => toRequirementRow(r, false)),
    [source],
  );

  const buyerGroups = useMemo(() => {
    const q = buyerSearch.trim().toLowerCase();
    return [...new Set(source.map((r) => r.buyer))]
      .sort()
      .filter((name) => !q || name.toLowerCase().includes(q))
      .map<BuyerGroup>((buyer) => ({
        buyer,
        rows: source
          .filter((r) => r.buyer === buyer)
          .map((r) => toRequirementRow(r, true)),
      }));
  }, [buyerSearch, source]);

  function toggleBuyer(buyer: string) {
    setCollapsed((prev) =>
      prev.includes(buyer) ? prev.filter((b) => b !== buyer) : [...prev, buyer],
    );
  }

  return {
    mode,
    setMode,
    buyerSearch,
    setBuyerSearch,
    rows,
    categories,
    totalCount: source.length,
    buyerGroups,
    collapsed,
    toggleBuyer,
    isLoading,
    error,
    retry: load,
  };
}
