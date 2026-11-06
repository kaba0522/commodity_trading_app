import { getFriendlyApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
  isActiveListing,
  listingsApi,
} from "@/features/seller/listings/api/listingsApi";
import type { Listing } from "@/types/domain";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface HomeRow {
  id: string;
  category: string;
  item: string;
  quality: string;
  weight: string;
  /** Backend `quantityBags`; 0 when the payload omits it. */
  bags: number;
  /** Null = no price for today (backend `price_expired` / `na`, or price 0). */
  price: number | null;
  /** Backend `status` split — only `"active"` counts as live. */
  active: boolean;
  unlisted: boolean;
}

/** Listing filter for live, unpriced, and seller-unlisted listings. */
export type HomeFilter = "live" | "needs" | "unlisted" | null;

/** `0`/missing prices are "no price", never a real ₹0 quote. */
function toHomeRow(l: Listing): HomeRow {
  const active = isActiveListing(l);
  return {
    id: String(l.id),
    category: l.category,
    item: l.item,
    quality: l.quality,
    weight: l.weight,
    bags: l.bags ?? 0,
    price: active && l.price > 0 ? l.price : null,
    active,
    unlisted: l.status === "withdrawn",
  };
}

/**
 * Seller home data (Seller App.html `isHome` → "My Listings"): the logged-in
 * seller's own listings, including withdrawn rows for the Unlisted filter.
 * The backend defaults `userId` to the caller for the seller role — own rows
 * only. The screen filters/groups rows and edits live rates inline.
 */
export function useSellerHome() {
  const { runWithAuth } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [priceExpiryTime, setPriceExpiryTime] = useState<string | null>(null);
  const [priceExpiryError, setPriceExpiryError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // runWithAuth refreshes the 15m access token on 401 and retries once,
      // so reopening the app after a while never shows "unauthorized".
      // listMine = seller-associated rows only; status drives live vs needs-price.
      setListings(
        await runWithAuth((token) => listingsApi.listMine(token, true)),
      );
    } catch (e) {
      setError(getFriendlyApiError(e, "Could not load today's listings"));
    } finally {
      setIsLoading(false);
    }
  }, [runWithAuth]);

  const loadPriceExpiryTime = useCallback(async () => {
    setPriceExpiryError(null);
    try {
      setPriceExpiryTime(
        await runWithAuth((token) => listingsApi.getPriceExpiryTime(token)),
      );
    } catch (e) {
      setPriceExpiryError(
        getFriendlyApiError(e, "Could not load the price expiry time"),
      );
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

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  // Refetch every time the dashboard regains focus (e.g. back from the
  // add-listing form after a publish) so newly created listings appear.
  useFocusEffect(
    useCallback(() => {
      load();
      loadPriceExpiryTime();
    }, [load, loadPriceExpiryTime]),
  );

  const rows = useMemo(() => listings.map(toHomeRow), [listings]);
  const activeRows = useMemo(() => rows.filter((r) => !r.unlisted), [rows]);
  const unlistedCount = rows.length - activeRows.length;
  const liveCount = useMemo(
    () => activeRows.filter((r) => r.price !== null).length,
    [activeRows],
  );
  const needsCount = activeRows.length - liveCount;
  const allPriced = activeRows.length > 0 && needsCount === 0;
  // Every listing price-expired (e.g. after the 2 AM reset): rows kept,
  // all awaiting fresh prices.
  const expired = activeRows.length > 0 && liveCount === 0;
  const formattedExpiryTime = priceExpiryTime
    ? (() => {
        const [hour, minute] = priceExpiryTime.split(":").map(Number);
        const period = hour >= 12 ? "PM" : "AM";
        return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${period}`;
      })()
    : null;
  const expiryLabel = priceExpiryError
    ? "Expiry time unavailable"
    : !formattedExpiryTime
      ? "Loading expiry time…"
      : expired
        ? `Expired at ${formattedExpiryTime}`
        : `Rates expire every day at ${formattedExpiryTime}`;

  /** Save today's rate for one listing. Resolves true when the PATCH succeeded. */
  const savePrice = useCallback(
    async (id: string, price: number): Promise<boolean> => {
      setSavingId(id);
      setSaveError(null);
      try {
        await runWithAuth((token) => listingsApi.update(id, { price }, token));
        setListings((prev) =>
          prev.map((l) =>
            String(l.id) === id
              ? { ...l, price, status: "active" as const }
              : l,
          ),
        );
        setSavedId(id);
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSavedId(null), 2500);
        return true;
      } catch (e) {
        setSaveError(getFriendlyApiError(e, "Could not save the rate"));
        return false;
      } finally {
        setSavingId(null);
      }
    },
    [runWithAuth],
  );

  const clearSaveError = useCallback(() => setSaveError(null), []);

  return {
    rows,
    unlistedCount,
    liveCount,
    needsCount,
    allPriced,
    expired,
    expiryLabel,
    isLoading,
    error,
    retry: load,
    savingId,
    savedId,
    saveError,
    savePrice,
    clearSaveError,
  };
}
