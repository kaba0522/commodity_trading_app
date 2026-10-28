import { useCallback, useEffect, useState } from "react";
import { getFriendlyApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { listingsApi } from "@/features/seller/listings/api/listingsApi";
import type { Listing } from "@/types/domain";

export interface BrowseDetailSeed {
  id?: string;
  category?: string;
  item?: string;
  quality?: string;
  weight?: string;
  seller?: string;
  price?: string;
  bags?: string;
  paymentTerms?: string;
  priceValidUntil?: string;
}

/** Instant render from the tapped browse row (the list already has the data). */
function seedFromParams(seed: BrowseDetailSeed): Listing | null {
  if (!seed.item || !seed.seller) return null;
  const price = Number(seed.price ?? 0);
  const bags = Number(seed.bags ?? "");
  const paymentTerms = Number(seed.paymentTerms ?? "");
  return {
    id: Number(seed.id ?? 0) || (seed.id ?? 0),
    category: (seed.category || "Rice") as Listing["category"],
    item: seed.item,
    quality: seed.quality || "",
    weight: seed.weight || "",
    seller: seed.seller,
    price: Number.isFinite(price) ? price : 0,
    ...(Number.isInteger(bags) && bags > 0 ? { bags } : {}),
    ...(Number.isInteger(paymentTerms) && paymentTerms >= 0
      ? { paymentTerms }
      : {}),
    priceValidUntil: seed.priceValidUntil || null,
  } as Listing;
}

/**
 * Buyer listing detail (Buyer App.html detail screen): the tapped market
 * listing, refreshed live via `GET /listings/:id`; seeded from the browse
 * row so the page renders instantly.
 */
export function useListingDetail(seed: BrowseDetailSeed) {
  const { runWithAuth } = useAuth();
  const { id, item, seller } = seed;
  const [listing, setListing] = useState<Listing | null>(() =>
    seedFromParams(seed),
  );
  const [isLoading, setIsLoading] = useState(!item);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      if (!item) {
        setError("Listing details unavailable.");
        setIsLoading(false);
      }
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const fetched = await runWithAuth((token) =>
        listingsApi.getById(id, token),
      );
      setListing((current) => ({
        ...fetched,
        priceValidUntil:
          fetched.priceValidUntil ??
          (current?.id === fetched.id ? current.priceValidUntil : null) ??
          null,
      }));
    } catch (e) {
      // Keep the seeded row when refresh fails — the page still works.
      if (!item || !seller) {
        setError(getFriendlyApiError(e, "Could not load this listing"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, item, seller, runWithAuth]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return { listing, isLoading, error, retry: load };
}
