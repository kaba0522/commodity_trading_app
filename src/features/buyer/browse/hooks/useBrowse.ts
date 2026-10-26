import { getFriendlyApiError } from "@/core/api/client";
import { priceLabel } from "@/core/utils/format";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { listingsApi } from "@/features/seller/listings/api/listingsApi";
import { catalogApi } from "@/features/shared/catalog/api/catalogApi";
import type { Listing } from "@/types/domain";
import { useCallback, useEffect, useMemo, useState } from "react";

export type BrowseMode = "commodity" | "seller";

export interface BrowseRow extends Listing {
  priceText: string;
  qualityText: string;
}

export interface BrowseGroup {
  key: string;
  category: string;
  item: string;
  weight: string;
  rows: BrowseRow[];
}

export interface SellerGroup {
  seller: string;
  itemGroups: BrowseGroup[];
}

/** Group listings by category/item (prototype `groupByItem`): groups sorted, rows cheapest first. */
function groupByItem(list: Listing[]): BrowseGroup[] {
  const map = new Map<string, BrowseGroup>();
  for (const l of list) {
    const key = `${l.category} / ${l.item}`;
    const existing = map.get(key);
    if (existing) {
      existing.rows.push(toRow(l));
    } else {
      map.set(key, {
        key,
        category: l.category,
        item: l.item,
        weight: l.weight,
        rows: [toRow(l)],
      });
    }
  }
  return [...map.values()]
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category) || a.item.localeCompare(b.item),
    )
    .map((g) => ({ ...g, rows: g.rows.sort((a, b) => a.price - b.price) }));
}

function toRow(l: Listing): BrowseRow {
  return {
    ...l,
    priceText: priceLabel(l.price),
    qualityText: l.quality || "Standard",
  };
}

/**
 * Buyer browse data (Buyer App.html `isBrowse`): By Commodity groups with
 * category chips, By Seller sections with name search.
 * Live backend only — GET `/listings` + GET `/commodity-categories`.
 */
export function useBrowse() {
  const { runWithAuth } = useAuth();
  const [mode, setMode] = useState<BrowseMode>("commodity");
  const [category, setCategory] = useState<string>("All");
  const [sellerSearch, setSellerSearch] = useState("");
  const [collapsed, setCollapsed] = useState<readonly string[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<readonly string[]>(["All"]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // runWithAuth refreshes the 15m access token on 401 and retries once,
      // so reopening the app after a while never shows "unauthorized".
      const [fetched, cats] = await runWithAuth((token) =>
        Promise.all([
          listingsApi.list(token),
          catalogApi
            .getCommodityCategories(token)
            .then((list) => list.map((c) => c.name))
            .catch((): string[] => []),
        ]),
      );
      setListings(fetched);
      const resolved =
        cats.length > 0
          ? cats
          : [
              ...new Set(fetched.map((l) => l.category).filter((c) => c)),
            ].sort();
      setCategories(["All", ...resolved]);
    } catch (e) {
      setError(getFriendlyApiError(e, "Could not load listings"));
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

  const groups = useMemo(
    () =>
      groupByItem(
        category === "All"
          ? listings
          : listings.filter((l) => l.category === category),
      ),
    [category, listings],
  );

  const sellerGroups = useMemo(() => {
    const q = sellerSearch.trim().toLowerCase();
    return [...new Set(listings.map((l) => l.seller))]
      .sort()
      .filter((name) => !q || name.toLowerCase().includes(q))
      .map<SellerGroup>((seller) => ({
        seller,
        itemGroups: groupByItem(listings.filter((l) => l.seller === seller)),
      }));
  }, [sellerSearch, listings]);

  const sellerListingCounts = useMemo(
    () =>
      listings.reduce<Record<string, number>>((counts, listing) => {
        counts[listing.seller] = (counts[listing.seller] ?? 0) + 1;
        return counts;
      }, {}),
    [listings],
  );

  function toggleSeller(seller: string) {
    setCollapsed((prev) =>
      prev.includes(seller)
        ? prev.filter((s) => s !== seller)
        : [...prev, seller],
    );
  }

  return {
    categories,
    mode,
    setMode,
    category,
    setCategory,
    sellerSearch,
    setSellerSearch,
    groups,
    sellerGroups,
    sellerListingCounts,
    collapsed,
    toggleSeller,
    isLoading,
    error,
    retry: load,
  };
}
