import { BackButton } from "@/components/common/BackButton";
import { Button } from "@/components/ui/Button";
import { bagsLabel, priceLabel } from "@/core/utils/format";
import { CutoffSheet } from "@/features/negotiation/components/CutoffSheet";
import { OfferSheet, type OfferDraft } from "@/features/negotiation/components/OfferSheet";
import { QtyMismatchDialog } from "@/features/negotiation/components/QtyMismatchDialog";
import { FIRM_TERMS } from "@/features/negotiation/constants";
import { startDirectTradeThread, startOfferThread } from "@/features/negotiation/store";
import {
  isOfferWindowOpen,
  numberParam,
  stringParam,
  type NegotiationRole,
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
 * Entry point for a negotiation. Buyer opens a listing; seller opens a buyer
 * requirement. Both use the same offer/buy-now state machine.
 */
export function ListingOfferScreen({ role, seed: seedProp }: ListingOfferScreenProps) {
  const params = useLocalSearchParams<ListingParams>();
  const seed = seedProp ?? seedFromParams(params, role);
  const forceClosed = stringParam(params.simulateCutoff) === "1";

  const [offerOpen, setOfferOpen] = useState(false);
  const [qtyOpen, setQtyOpen] = useState(false);
  const [cutoffOpen, setCutoffOpen] = useState(false);

  const isBuyer = role === "buyer";
  const fallback = isBuyer ? "/browse" : "/requirements";

  function offersAllowed(): boolean {
    if (isOfferWindowOpen(new Date(), forceClosed)) return true;
    setCutoffOpen(true);
    return false;
  }

  function openOffer() {
    if (offersAllowed()) setOfferOpen(true);
  }

  function sendOffer(draft: OfferDraft) {
    const id = startOfferThread({
      role,
      counterparty: seed.counterparty,
      item: seed.item,
      category: seed.category ?? "Uncategorized",
      listedPrice: seed.listedPrice,
      availableBags: seed.availableBags,
      requestedBags: draft.bags,
      price: draft.price,
      bags: draft.bags,
      note: draft.note,
      voice: draft.voiceNote,
      weightKg: seed.weightKg,
      paymentTerms: seed.paymentTerms,
    });
    setOfferOpen(false);
    router.push({ pathname: "/negotiation/[id]", params: { id } });
  }

  function directTrade(bags: number) {
    const id = startDirectTradeThread({
      role,
      counterparty: seed.counterparty,
      item: seed.item,
      category: seed.category ?? "Uncategorized",
      listedPrice: seed.listedPrice,
      availableBags: seed.availableBags,
      requestedBags: bags,
      price: seed.listedPrice,
      bags,
      weightKg: seed.weightKg,
      paymentTerms: seed.paymentTerms,
    });
    router.push({ pathname: "/negotiation/confirm", params: { id } });
  }

  function handleDirectTrade() {
    if (seed.availableBags > 0 && seed.requestedBags > seed.availableBags) {
      setQtyOpen(true);
      return;
    }
    directTrade(seed.requestedBags);
  }

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
              : "Accept target price"
          }
          onPress={handleDirectTrade}
        />
      </View>

      <Button title="Make an offer" onPress={openOffer} variant="secondary" />

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
          onSubmit={sendOffer}
        />
      ) : null}

      <QtyMismatchDialog
        visible={qtyOpen}
        requestedBags={seed.requestedBags}
        availableBags={seed.availableBags}
        price={seed.listedPrice}
        onCancel={() => setQtyOpen(false)}
        onConfirm={() => {
          setQtyOpen(false);
          directTrade(seed.availableBags);
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
