import { BackButton } from "@/components/common/BackButton";
import { Button } from "@/components/ui/Button";
import { FormStatus } from "@/components/ui/FormStatus";
import { getFriendlyApiError } from "@/core/api/client";
import { bagsLabel, priceLabel } from "@/core/utils/format";
import { CutoffSheet } from "@/features/negotiation/components/CutoffSheet";
import { OfferSheet, type OfferDraft } from "@/features/negotiation/components/OfferSheet";
import { QtyMismatchDialog } from "@/features/negotiation/components/QtyMismatchDialog";
import { FIRM_TERMS } from "@/features/negotiation/constants";
import { useStartNegotiation } from "@/features/negotiation/hooks/useStartNegotiation";
import {
  getPartialFillInfo,
  isOfferWindowOpen,
  numberParam,
  stringParam,
  type NegotiationRole,
  type PartialFillInfo,
} from "@/features/negotiation/utils";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

/** Resolved listing/requirement values, either from params or a live seed. */
export interface OfferEntrySeed {
  id?: string;
  item: string;
  counterparty: string;
  category?: string;
  listedPrice: number;
  availableBags: number;
  requestedBags: number;
  weight?: string;
  weightKg?: number;
  paymentTerms?: string;
  quality?: string;
  location?: string;
  notes?: string;
}

interface ListingOfferScreenProps {
  role: NegotiationRole;
  seed?: OfferEntrySeed;
}

type ListingParams = {
  id?: string | string[];
  category?: string | string[];
  item?: string | string[];
  seller?: string | string[];
  buyer?: string | string[];
  price?: string | string[];
  targetPrice?: string | string[];
  weight?: string | string[];
  weightKg?: string | string[];
  bags?: string | string[];
  availableBags?: string | string[];
  requestedBags?: string | string[];
  paymentTerms?: string | string[];
  quality?: string | string[];
  location?: string | string[];
  notes?: string | string[];
  simulateCutoff?: string | string[];
};

/**
 * Entry point for a negotiation. Buyer opens a listing and can offer or
 * buy now; seller opens a buyer requirement and starts with a price offer.
 */
export function ListingOfferScreen({ role, seed: seedProp }: ListingOfferScreenProps) {
  const params = useLocalSearchParams<ListingParams>();
  const seed = seedProp ?? seedFromParams(params, role);
  const forceClosed = stringParam(params.simulateCutoff) === "1";
  const { start, buyNow } = useStartNegotiation();

  const [offerOpen, setOfferOpen] = useState(false);
  const [qtyOpen, setQtyOpen] = useState(false);
  const [cutoffOpen, setCutoffOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [partial, setPartial] = useState<PartialFillInfo | null>(null);

  const isBuyer = role === "buyer";
  const fallback = isBuyer ? "/browse" : "/requirements";

  function offersAllowed(): boolean {
    if (isOfferWindowOpen(new Date(), forceClosed)) return true;
    setCutoffOpen(true);
    return false;
  }

  function openOffer() {
    if (offersAllowed()) {
      setFormError(null);
      setOfferOpen(true);
    }
  }

  function listingId(): string {
    return seed.id ?? "";
  }

  function showError(e: unknown, fallbackMessage: string): boolean {
    const info = getPartialFillInfo(e);
    if (info && !partial) {
      setPartial(info);
      setQtyOpen(true);
      return true;
    }
    setFormError(getFriendlyApiError(e, fallbackMessage));
    return false;
  }

  async function sendOffer(draft: OfferDraft) {
    if (!listingId()) {
      setFormError("This listing is missing its id. Go back and reopen it.");
      return;
    }
    setOfferOpen(false);
    setBusy(true);
    setFormError(null);
    try {
      const thread = await start({
        listingId: listingId(),
        price: draft.price,
        bagsRequested: draft.bags,
        note: draft.note,
        voice: draft.voiceNote,
      });
      router.push({ pathname: "/negotiation/[id]", params: { id: thread.id } });
    } catch (e) {
      showError(e, "Could not send your offer");
    } finally {
      setBusy(false);
    }
  }

  async function directTrade(bags: number, acceptPartial = false) {
    if (!listingId()) {
      setFormError("This listing is missing its id. Go back and reopen it.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const result = await buyNow({
        listingId: listingId(),
        bagsRequested: bags,
        acceptPartial,
      });
      router.push({
        pathname: "/negotiation/confirm",
        params: {
          id: result.thread.id,
          ...(result.tradeId ? { tradeId: result.tradeId } : {}),
        },
      });
    } catch (e) {
      showError(e, "Could not confirm the trade");
    } finally {
      setBusy(false);
    }
  }

  function handleDirectTrade() {
    if (!isBuyer) {
      // Seller-side BUY requirements have no direct trade: start with a price.
      void sendOffer({
        price: seed.listedPrice,
        bags: seed.requestedBags,
        note: "Offer at your target price",
      });
      return;
    }
    if (seed.availableBags > 0 && seed.requestedBags > seed.availableBags) {
      setPartial({ available: seed.availableBags, price: seed.listedPrice });
      setQtyOpen(true);
      return;
    }
    void directTrade(seed.requestedBags);
  }

  const dialogAvailable = partial?.available ?? seed.availableBags;
  const dialogPrice = partial?.price ?? seed.listedPrice;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <BackButton
        accessibilityLabel={
          isBuyer ? "Back to listing details" : "Back to buyer requirements"
        }
        fallback={fallback}
      />
      <Text style={styles.title}>Negotiate</Text>

      {formError ? <FormStatus kind="error" message={formError} /> : null}

      <View style={styles.card}>
        <Text style={styles.kicker}>
          {isBuyer ? "Listing" : "Buyer requirement"}
        </Text>
        <Text style={styles.item}>{seed.item}</Text>
        <Text style={styles.muted}>
          {seed.counterparty} ·{" "}
          {isBuyer ? "asking" : "targeting"} {priceLabel(seed.listedPrice)} per bag ·{" "}
          {bagsLabel(seed.requestedBags)}
        </Text>

        {seed.quality ? <Text style={styles.muted}>Quality: {seed.quality}</Text> : null}
        {seed.weightKg ? (
          <Text style={styles.muted}>Weight per bag: {seed.weightKg} kg</Text>
        ) : seed.weight ? (
          <Text style={styles.muted}>Weight per bag: {seed.weight}</Text>
        ) : null}
        {seed.paymentTerms ? (
          <Text style={styles.muted}>Payment terms: {seed.paymentTerms}</Text>
        ) : null}
        {seed.location ? (
          <Text style={styles.muted}>Location: {seed.location}</Text>
        ) : null}
        {seed.notes ? <Text style={styles.muted}>Notes: {seed.notes}</Text> : null}

        {!isBuyer ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/requirements",
                params: { buyer: seed.counterparty },
              })
            }
            style={styles.buyerBox}
            accessibilityRole="button"
            accessibilityLabel={`View all requirements from ${seed.counterparty}`}
          >
            <Text style={styles.buyerBoxText}>
              View all requirements from {seed.counterparty}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.priceCard}>
        <Text style={styles.kicker}>
          {isBuyer ? "Seller's ask" : "Buyer's target"}
        </Text>
        <Text style={styles.bigPrice}>
          {priceLabel(seed.listedPrice)}
          <Text style={styles.perBag}> /bag</Text>
        </Text>
        <Button
          title={
            isBuyer
              ? `Buy at ${priceLabel(seed.listedPrice)}`
              : `Offer at ${priceLabel(seed.listedPrice)}`
          }
          onPress={handleDirectTrade}
          disabled={busy}
        />
      </View>

      <Button
        title="Make an offer"
        onPress={openOffer}
        variant="secondary"
        disabled={busy}
      />

      <View style={styles.termsCard}>
        <Text style={styles.kicker}>Terms of service</Text>
        <Text style={styles.muted}>{FIRM_TERMS}</Text>
      </View>

      {offerOpen ? (
        <OfferSheet
          visible
          role={role}
          listedPrice={seed.listedPrice}
          availableBags={seed.availableBags}
          requestedBags={seed.requestedBags}
          onClose={() => setOfferOpen(false)}
          onSubmit={(draft) => void sendOffer(draft)}
        />
      ) : null}

      <QtyMismatchDialog
        visible={qtyOpen}
        requestedBags={seed.requestedBags}
        availableBags={dialogAvailable}
        price={dialogPrice}
        onCancel={() => {
          setQtyOpen(false);
          setPartial(null);
        }}
        onConfirm={() => {
          const bags = dialogAvailable;
          setQtyOpen(false);
          if (isBuyer) void directTrade(bags, true);
          else {
            void sendOffer({
              price: dialogPrice,
              bags,
              note: "Offer at your target price",
            });
          }
        }}
      />

      <CutoffSheet visible={cutoffOpen} onClose={() => setCutoffOpen(false)} />
    </ScrollView>
  );
}

function seedFromParams(params: ListingParams, role: NegotiationRole): OfferEntrySeed {
  const item = stringParam(params.item);
  const category = stringParam(params.category);
  const listedPrice = numberParam(params.targetPrice ?? params.price);
  const availableBags = numberParam(params.availableBags ?? params.bags);
  const defaultRequested =
    availableBags > 0 ? Math.min(availableBags, 50) : 50;

  return {
    id: stringParam(params.id),
    item: item || (role === "buyer" ? "Listing" : "Buyer requirement"),
    counterparty:
      stringParam(role === "buyer" ? params.seller : params.buyer) ||
      (role === "buyer" ? "Seller" : "Buyer"),
    category,
    listedPrice,
    availableBags,
    requestedBags: numberParam(params.requestedBags, defaultRequested),
    weight: stringParam(params.weight),
    weightKg: numberParam(params.weightKg) || undefined,
    paymentTerms: stringParam(params.paymentTerms),
    quality: stringParam(params.quality),
    location: stringParam(params.location),
    notes: stringParam(params.notes),
  };
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.muted,
  },
  item: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  muted: {
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.muted,
  },
  buyerBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buyerBoxText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.primary,
  },
  priceCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.primaryTint,
  },
  bigPrice: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.primaryDark,
  },
  perBag: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
  },
  termsCard: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
});
