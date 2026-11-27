import { BackButton } from "@/components/common/BackButton";
import { ChevronIcon } from "@/components/common/ChevronIcon";
import { Button } from "@/components/ui/Button";
import { FormStatus } from "@/components/ui/FormStatus";
import { getFriendlyApiError } from "@/core/api/client";
import { bagsLabel, priceLabel } from "@/core/utils/format";
import type { BrowseBase } from "@/features/buyer/browse/hooks/useBrowse";
import { useListingDetail } from "@/features/buyer/browse/hooks/useListingDetail";
import { ListingMedia } from "@/features/shared/listings/components/ListingMedia";
import { CutoffSheet } from "@/features/negotiation/components/CutoffSheet";
import {
  OfferSheet,
  type OfferDraft,
} from "@/features/negotiation/components/OfferSheet";
import { QtyMismatchDialog } from "@/features/negotiation/components/QtyMismatchDialog";
import { FIRM_TERMS } from "@/features/negotiation/constants";
import { useStartNegotiation } from "@/features/negotiation/hooks/useStartNegotiation";
import {
  getPartialFillInfo,
  isOfferWindowOpen,
  numberParam,
  stringParam,
  type PartialFillInfo,
} from "@/features/negotiation/utils";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { Listing } from "@/types/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type DetailParams = {
  id?: string | string[];
  category?: string | string[];
  item?: string | string[];
  quality?: string | string[];
  weight?: string | string[];
  seller?: string | string[];
  price?: string | string[];
  bags?: string | string[];
  paymentTerms?: string | string[];
  priceValidUntil?: string | string[];
  sellerListingCount?: string | string[];
  requestedBags?: string | string[];
  simulateCutoff?: string | string[];
};

function priceExpiryLabel(value: string | null | undefined): string {
  if (!value) return "Expiry unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Expiry unavailable";
  return `Valid until ${date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  })}`;
}

function itemLabel(listing: Listing): string {
  return [listing.item, listing.quality].filter(Boolean).join(" · ");
}

interface ListingDetailScreenProps {
  /** Workspace prefix the detail was opened from. */
  browseBase?: BrowseBase;
  /** Brokers can inspect listings but cannot trade (backend read-only role). */
  readOnly?: boolean;
}

/**
 * Buyer/Broker listing detail (FE doc §2). Buy and make-offer now start the
 * shared negotiation state machine; sheets and the partial-availability dialog
 * overlay this screen instead of navigating to a separate entry screen.
 */
export function ListingDetailScreen({
  browseBase = "/browse",
  readOnly = false,
}: ListingDetailScreenProps) {
  const params = useLocalSearchParams<DetailParams>();
  const { listing, isLoading, error, retry } = useListingDetail({
    id: stringParam(params.id),
    category: stringParam(params.category),
    item: stringParam(params.item),
    quality: stringParam(params.quality),
    weight: stringParam(params.weight),
    seller: stringParam(params.seller),
    price: stringParam(params.price),
    bags: stringParam(params.bags),
    paymentTerms: stringParam(params.paymentTerms),
    priceValidUntil: stringParam(params.priceValidUntil),
  });

  const { start, buyNow } = useStartNegotiation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [qtyOpen, setQtyOpen] = useState(false);
  const [cutoffOpen, setCutoffOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [partial, setPartial] = useState<PartialFillInfo | null>(null);

  const requestedBags = numberParam(params.requestedBags, 0);
  const forceClosed = stringParam(params.simulateCutoff) === "1";
  const availableBags = listing?.bags ?? 0;

  function viewAllFromSeller() {
    if (!listing) return;
    router.push({
      pathname: browseBase,
      params: { seller: listing.seller },
    });
  }

  function openOffer() {
    setFormError(null);
    if (isOfferWindowOpen(new Date(), forceClosed)) setOfferOpen(true);
    else setCutoffOpen(true);
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
    if (!listing) return;
    setOfferOpen(false);
    setBusy(true);
    setFormError(null);
    try {
      const thread = await start({
        listingId: String(listing.id),
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
    if (!listing) return;
    setBusy(true);
    setFormError(null);
    try {
      const result = await buyNow({
        listingId: String(listing.id),
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

  function handleBuy() {
    if (!listing) return;
    const wanted = requestedBags > 0 ? requestedBags : availableBags;
    if (availableBags > 0 && wanted > availableBags) {
      setPartial({ available: availableBags, price: listing.price });
      setQtyOpen(true);
      return;
    }
    void directTrade(wanted > 0 ? wanted : 1);
  }

  const hasMedia = Boolean(
    listing?.photoUrls?.length || listing?.videoUrls?.length,
  );
  const offerBags = requestedBags > 0 ? requestedBags : availableBags || undefined;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: spacing.md }]}
    >
      <BackButton accessibilityLabel="Back to browse" fallback={browseBase} />

      {isLoading && !listing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.muted}>Loading listing…</Text>
        </View>
      ) : error && !listing ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" variant="secondary" onPress={retry} />
        </View>
      ) : listing ? (
        <>
          <View>
            <View style={styles.tagRow}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{listing.category}</Text>
              </View>
            </View>
            <Text style={styles.title}>{itemLabel(listing)}</Text>
            <Text style={styles.muted}>
              {listing.weight} per bag · sold by {listing.seller}
            </Text>
          </View>

          <View style={styles.priceCard}>
            <Text style={styles.kicker}>Price per bag</Text>
            <Text style={styles.price}>{priceLabel(listing.price)}</Text>
            <View style={styles.validTag}>
              <Text style={styles.validTagText}>
                {priceExpiryLabel(listing.priceValidUntil)}
              </Text>
            </View>
          </View>

          {formError ? <FormStatus kind="error" message={formError} /> : null}

          {readOnly ? (
            <FormStatus
              kind="info"
              message="Broker accounts have read-only access to listings."
            />
          ) : (
            <View style={styles.actions}>
              <View style={styles.actionFlex}>
                <Button
                  title={`Buy at ${priceLabel(listing.price)}`}
                  onPress={handleBuy}
                  disabled={busy}
                />
              </View>
              <View style={styles.actionFlex}>
                <Button
                  title="Make an offer"
                  variant="secondary"
                  onPress={openOffer}
                  disabled={busy}
                />
              </View>
            </View>
          )}

          <Pressable
            style={styles.sellerCard}
            onPress={viewAllFromSeller}
            accessibilityRole="button"
            accessibilityLabel={`View listings from ${listing.seller}`}
          >
            <View>
              <Text style={styles.sellerName}>{listing.seller}</Text>
              <Text style={styles.muted}>
                {stringParam(params.sellerListingCount)
                  ? `${stringParam(params.sellerListingCount)} listing${
                      stringParam(params.sellerListingCount) === "1" ? "" : "s"
                    }`
                  : "View seller listings"}
              </Text>
            </View>
            <ChevronIcon color={colors.muted} size={18} />
          </Pressable>

          <View style={styles.card}>
            <DetailRow
              label="Quantity"
              value={
                listing.bags ? bagsLabel(listing.bags) : "Availability on request"
              }
            />
            <DetailRow
              label="Weight per bag"
              value={listing.weight || "Not provided"}
            />
            <DetailRow
              label="Payment terms"
              value={
                listing.paymentTerms != null
                  ? `${listing.paymentTerms} days`
                  : "Terms on request"
              }
            />

            <Pressable
              style={styles.moreButton}
              onPress={() => setDetailsOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel={
                detailsOpen ? "Hide more details" : "Show more details"
              }
            >
              <Text style={styles.moreText}>
                {detailsOpen ? "Less details" : "More details"}
              </Text>
              <ChevronIcon
                direction={detailsOpen ? "up" : "down"}
                color={colors.primary}
                size={16}
              />
            </Pressable>

            {detailsOpen ? (
              <View style={styles.moreDetails}>
                <DetailRow
                  label="Moisture"
                  value={listing.moisture || "Not provided"}
                />
                <DetailRow
                  label="Color"
                  value={listing.color || "Not provided"}
                />
                <DetailRow
                  label="Brand / size"
                  value={listing.size || "Not provided"}
                />
                <DetailRow
                  label="Origin / notes"
                  value={listing.notes || "Not provided"}
                />
              </View>
            ) : null}
          </View>

          {hasMedia ? (
            <ListingMedia
              photoUrls={listing.photoUrls}
              videoUrls={listing.videoUrls}
            />
          ) : null}

          <View style={styles.card}>
            <Text style={styles.kicker}>Terms of Service</Text>
            <Text style={styles.body}>{FIRM_TERMS}</Text>
          </View>

          {!readOnly && offerOpen ? (
            <OfferSheet
              visible
              role="buyer"
              listedPrice={listing.price}
              availableBags={availableBags}
              requestedBags={offerBags}
              onClose={() => setOfferOpen(false)}
              onSubmit={(draft) => void sendOffer(draft)}
            />
          ) : null}

          <QtyMismatchDialog
            visible={qtyOpen}
            requestedBags={requestedBags || availableBags}
            availableBags={partial?.available ?? availableBags}
            price={partial?.price ?? listing.price}
            onCancel={() => {
              setQtyOpen(false);
              setPartial(null);
            }}
            onConfirm={() => {
              const bags = partial?.available ?? availableBags;
              setQtyOpen(false);
              void directTrade(bags, true);
            }}
          />

          <CutoffSheet visible={cutoffOpen} onClose={() => setCutoffOpen(false)} />
        </>
      ) : null}
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  sellerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  sellerName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  tagRow: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  tag: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 2,
  },
  muted: {
    fontSize: 14,
    color: colors.muted,
  },
  priceCard: {
    alignItems: "flex-start",
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.muted,
  },
  price: {
    fontSize: 34,
    fontWeight: "800",
    color: colors.text,
  },
  validTag: {
    backgroundColor: colors.accent2Tint,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  validTagText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent2Dark,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionFlex: {
    flex: 1,
  },
  card: {
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  rowLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  rowValue: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.text,
    textAlign: "right",
  },
  moreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  moreText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  moreDetails: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  body: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.text,
    opacity: 0.85,
  },
  center: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  errorText: {
    fontSize: 13.5,
    color: colors.danger,
    textAlign: "center",
  },
});
