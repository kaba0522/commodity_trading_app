import { useCallback, useEffect, useState } from "react";
import { getFriendlyApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { requirementsApi } from "@/features/buyer/requirements/api/requirementsApi";
import type { BuyerRequirement } from "@/types/domain";

export interface NegotiationSeed {
  id?: string;
  category?: string;
  item?: string;
  buyer?: string;
  bags?: string;
  targetPrice?: string;
  paymentTerms?: string;
  quality?: string;
  weightKg?: string;
  location?: string;
  notes?: string;
}

export interface NegotiationStatus {
  kind: "info";
  message: string;
}

/** Instant render from the browse row params (the list already has the data). */
function seedFromParams(seed: NegotiationSeed): BuyerRequirement | null {
  if (!seed.item || !seed.buyer) return null;
  const bags = Number(seed.bags ?? 0);
  const targetPrice = Number(seed.targetPrice ?? 0);
  return {
    // Route params carry the id as a string (backend UUID) — keep it
    // verbatim. `Number(uuid)` is NaN → 0, which breaks detail refresh.
    id: seed.id ?? "",
    category: (seed.category || "Rice") as BuyerRequirement["category"],
    item: seed.item,
    buyer: seed.buyer,
    paymentTerms: seed.paymentTerms || "",
    targetPrice: Number.isFinite(targetPrice) ? targetPrice : 0,
    bags: Number.isFinite(bags) ? bags : 0,
    quality: seed.quality || undefined,
    weightKg: Number(seed.weightKg ?? "") || undefined,
    location: seed.location || undefined,
    notes: seed.notes || undefined,
  };
}

/**
 * Seller negotiate state (Seller App.html `isNegotiate`): the buyer
 * requirement under discussion plus the seller's counter-offer draft.
 * The requirement refreshes live via `GET /listings/:id`; seeded from the
 * tapped row so the page renders instantly. Accept/send needs a backend
 * offers contract — until then the actions say so instead of faking a trade.
 */
export function useNegotiation(seed: NegotiationSeed) {
  const { runWithAuth } = useAuth();
  const { id, item, buyer } = seed;
  const [requirement, setRequirement] = useState<BuyerRequirement | null>(() =>
    seedFromParams(seed),
  );
  const [isLoading, setIsLoading] = useState(!item);
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState("");
  const [offerError, setOfferError] = useState<string | null>(null);
  const [status, setStatus] = useState<NegotiationStatus | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      if (!item) {
        setError("Requirement details unavailable.");
        setIsLoading(false);
      }
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setRequirement(
        await runWithAuth((token) => requirementsApi.getById(id, token)),
      );
    } catch (e) {
      // Keep the seeded row when refresh fails — the page still works.
      if (!item || !buyer) {
        setError(getFriendlyApiError(e, "Could not load this requirement"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, item, buyer, runWithAuth]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  function parseOffer(): number | null {
    const value = Number(offer.trim());
    return offer.trim() !== "" && Number.isFinite(value) && value > 0
      ? value
      : null;
  }

  function acceptTarget() {
    setOfferError(null);
    const target = requirement?.targetPrice ?? 0;
    setStatus({
      kind: "info",
      message:
        target > 0
          ? `You accepted the buyer's target. Offer submit arrives with the backend offers API.`
          : "This requirement is open to offers — send your price below. Offer submit arrives with the backend offers API.",
    });
  }

  function sendOffer() {
    const value = parseOffer();
    if (value === null) {
      setOfferError("Enter your offer price per bag");
      return;
    }
    setOfferError(null);
    setStatus({
      kind: "info",
      message: `Your offer is drafted. Offer submit arrives with the backend offers API.`,
    });
  }

  return {
    requirement,
    isLoading,
    error,
    retry: load,
    offer,
    setOffer: (value: string) => {
      setOffer(value.replace(/[^0-9.]/g, ""));
      if (offerError) setOfferError(null);
    },
    offerError,
    status,
    acceptTarget,
    sendOffer,
  };
}
