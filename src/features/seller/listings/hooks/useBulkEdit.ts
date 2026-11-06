import { useCallback, useEffect, useMemo, useState } from "react";
import { getFriendlyApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { listingsApi, isActiveListing } from "@/features/seller/listings/api/listingsApi";

export interface BulkRow {
  id: string;
  item: string;
  category: string;
  quality: string;
  bags: number | null;
  /** Null = no price on the payload, shown as N/A. */
  price: number | null;
  /** Backend `status` split (`"active"` vs `"price_expired"`). */
  active: boolean;
}

/** Draft price text is valid when it parses to a finite number > 0. */
export function isValidPriceDraft(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0;
}

/**
 * Seller bulk price edit (`isBulk` in Seller App.html): select active rows and
 * apply −50/+50 or a custom delta via `PATCH /listings/bulk-price`
 * (delta mode); select expired rows and set absolute prices via
 * `PATCH /listings/bulk-price` (set-many mode) which reactivates them.
 */
export function useBulkEdit() {
  const { runWithAuth } = useAuth();
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [bulkAmount, setBulkAmount] = useState("");
  const [expiredPrices, setExpiredPricesState] = useState<
    Record<string, string>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Own listings incl. price_expired (backend defaults to active-only,
      // so listMine requests active,price_expired,na explicitly).
      const fetched = await runWithAuth((token) => listingsApi.listMine(token));
      setRows(
        fetched.map((l) => ({
          id: String(l.id),
          item: l.item,
          category: l.category,
          quality: l.quality,
          bags: l.bags ?? null,
          price: l.price > 0 ? l.price : null,
          active: isActiveListing(l),
        })),
      );
      setSelected([]);
      // Prefill expired drafts with the retained (yesterday's) price so the
      // −50/+50/custom controls have a base to adjust. `na` shell rows never
      // had a price — those inputs stay empty for a fresh price.
      const drafts: Record<string, string> = {};
      for (const l of fetched) {
        if (!isActiveListing(l) && l.price > 0) {
          drafts[String(l.id)] = String(l.price);
        }
      }
      setExpiredPricesState(drafts);
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

  const selectable = useMemo(() => rows, [rows]);

  const activeRows = useMemo(() => rows.filter((r) => r.active), [rows]);
  const expiredRows = useMemo(() => rows.filter((r) => !r.active), [rows]);

  const selectedActiveIds = useMemo(
    () =>
      rows
        .filter((r) => r.active && selected.includes(r.id))
        .map((r) => r.id),
    [rows, selected],
  );
  const selectedExpiredIds = useMemo(
    () =>
      rows
        .filter((r) => !r.active && selected.includes(r.id))
        .map((r) => r.id),
    [rows, selected],
  );

  function toggleSelect(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  function setExpiredPrice(id: string, value: string) {
    setExpiredPricesState((prev) => ({ ...prev, [id]: value }));
    if (saveError) setSaveError(null);
  }

  function selectAll(ids?: readonly string[]) {
    if (ids) {
      const allowed = new Set(selectable.map((r) => r.id));
      setSelected(ids.filter((id) => allowed.has(id)));
      return;
    }
    setSelected(selectable.map((r) => r.id));
  }

  function clear() {
    setSelected([]);
  }

  async function applyDelta(delta: number) {
    if (selected.length === 0) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      // Backend `delta` mode applies the +/- server-side atomically —
      // send ids + delta, not client-computed absolute prices.
      const ids = rows
        .filter((r) => selected.includes(r.id) && r.active)
        .map((r) => r.id);
      if (ids.length > 0) {
        await runWithAuth((token) =>
          listingsApi.bulkPriceDelta(ids, delta, token),
        );
        await load();
      }
    } catch (e) {
      setSaveError(getFriendlyApiError(e, "Could not update prices"));
    } finally {
      setIsSaving(false);
    }
  }

  async function applyTypedAmount() {
    const delta = Number(bulkAmount);
    if (!bulkAmount.trim() || !Number.isFinite(delta) || delta === 0) {
      setSaveError("Enter a non-zero amount, e.g. -25.");
      return;
    }
    setBulkAmount("");
    await applyDelta(Math.trunc(delta));
  }

  /**
   * Shift selected expired drafts by a delta (−50/+50/custom), mirroring the
   * Active tab — but client-side on the draft inputs, since expired rows have
   * no live price for a server-side delta. Drafts must exist first (prefilled
   * from yesterday's price, or typed manually for `na` rows).
   */
  function shiftExpiredDrafts(delta: number) {
    if (selectedExpiredIds.length === 0) return;
    for (const id of selectedExpiredIds) {
      if (!isValidPriceDraft(expiredPrices[id] ?? "")) {
        setSaveError("Enter a price for each selected listing first.");
        return;
      }
    }
    const next: Record<string, string> = { ...expiredPrices };
    for (const id of selectedExpiredIds) {
      const shifted = Number((next[id] ?? "").trim()) + delta;
      if (!Number.isFinite(shifted) || shifted <= 0) {
        setSaveError("Price must stay above 0 — enter prices manually.");
        return;
      }
      // Round to 2dp to avoid float artefacts (e.g. 100.1 − 50 = 50.0999…).
      next[id] = String(Math.round(shifted * 100) / 100);
    }
    setSaveError(null);
    setExpiredPricesState(next);
  }

  function applyExpiredTypedAmount() {
    const delta = Number(bulkAmount);
    if (!bulkAmount.trim() || !Number.isFinite(delta) || delta === 0) {
      setSaveError("Enter a non-zero amount, e.g. -25.");
      return;
    }
    setBulkAmount("");
    shiftExpiredDrafts(Math.trunc(delta));
  }

  /**
   * Set absolute prices for selected expired rows (backend `set-many` mode).
   * A successful price reactivates the listing — `load()` moves it to Active.
   */
  async function applySetMany() {
    if (selectedExpiredIds.length === 0) return;
    const updates: { listingId: string; price: number }[] = [];
    for (const id of selectedExpiredIds) {
      const draft = (expiredPrices[id] ?? "").trim();
      if (!isValidPriceDraft(draft)) {
        setSaveError("Enter a valid price above 0 for each selected listing.");
        return;
      }
      updates.push({ listingId: id, price: Number(draft) });
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      await runWithAuth((token) =>
        listingsApi.bulkPriceSetMany(updates, token),
      );
      await load();
    } catch (e) {
      setSaveError(getFriendlyApiError(e, "Could not update prices"));
    } finally {
      setIsSaving(false);
    }
  }

  const setManyReady =
    selectedExpiredIds.length > 0 &&
    selectedExpiredIds.every((id) =>
      isValidPriceDraft(expiredPrices[id] ?? ""),
    );

  return {
    rows,
    activeRows,
    expiredRows,
    activeCount: activeRows.length,
    expiredCount: expiredRows.length,
    selected,
    selectedCount: selected.length,
    selectedActiveCount: selectedActiveIds.length,
    selectedExpiredCount: selectedExpiredIds.length,
    bulkAmount,
    setBulkAmount,
    expiredPrices,
    setExpiredPrice,
    setManyReady,
    toggleSelect,
    selectAll,
    clear,
    applyDelta,
    applyTypedAmount,
    shiftExpiredDrafts,
    applyExpiredTypedAmount,
    applySetMany,
    isLoading,
    isSaving,
    error,
    saveError,
    retry: load,
  };
}
