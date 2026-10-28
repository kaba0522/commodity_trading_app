import { BackButton } from "@/components/common/BackButton";
import { Button } from "@/components/ui/Button";
import { FormStatus } from "@/components/ui/FormStatus";
import { useListingDetail } from "@/features/buyer/browse/hooks/useListingDetail";
import { priceLabel } from "@/core/utils/format";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FIRM_TERMS =
  "Goods must be outward within two days of order confirmation. Program received only before 5:00 PM. No tempo loading after 10 PM. Prices are subject to market conditions.";

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

/**
 * Buyer listing detail (Buyer App.html detail screen): tapped from Browse —
 * price card, payment terms, Make an offer / Buy, firm terms, and
 * view-all-from-seller. Offer/buy submit needs a backend trade contract.
 */
export function ListingDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
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
    sellerListingCount?: string;
  }>();
  const { listing, isLoading, error, retry } = useListingDetail({
    id: typeof params.id === "string" ? params.id : undefined,
    category: params.category,
    item: params.item,
    quality: params.quality,
    weight: params.weight,
    seller: params.seller,
    price: params.price,
    bags: params.bags,
    paymentTerms: params.paymentTerms,
    priceValidUntil: params.priceValidUntil,
  });
  const [notice, setNotice] = useState<string | null>(null);

  function viewAllFromSeller() {
    if (!listing) return;
    router.push({
      pathname: "/browse",
      params: { seller: listing.seller },
    });
  }

  function pendingTrade() {
    setNotice(
      "Buying is not available yet because the trade service is not connected.",
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.md },
      ]}
    >
      <BackButton accessibilityLabel="Back to browse" fallback="/browse" />

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
            <View style={styles.titleRow}>
              <Text style={styles.title}>{listing.item}</Text>
              {listing.quality ? (
                <View style={styles.qualityChip}>
                  <Text style={styles.qualityChipText}>{listing.quality}</Text>
                </View>
              ) : null}
            </View>
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

          <Pressable
            style={styles.sellerCard}
            onPress={viewAllFromSeller}
            accessibilityRole="button"
            accessibilityLabel={`View listings from ${listing.seller}`}
          >
            <View>
              <Text style={styles.sellerName}>{listing.seller}</Text>
              <Text style={styles.muted}>
                {params.sellerListingCount
                  ? `${params.sellerListingCount} listing${
                      params.sellerListingCount === "1" ? "" : "s"
                    }`
                  : "View seller listings"}
              </Text>
            </View>
            <Text style={styles.sellerChevron}>›</Text>
          </Pressable>

          <View style={styles.specRow}>
            <View style={[styles.card, styles.specCard]}>
              <Text style={styles.kicker}>Quantity</Text>
              <Text style={styles.body}>
                {listing.bags ? `${listing.bags} bags` : "— bags"}
              </Text>
            </View>
            <View style={[styles.card, styles.specCard]}>
              <Text style={styles.kicker}>Weight / bag</Text>
              <Text style={styles.body}>{listing.weight || "Not provided"}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.kicker}>Payment terms</Text>
            <Text style={styles.body}>
              {listing.paymentTerms !== null &&
              listing.paymentTerms !== undefined
                ? `${listing.paymentTerms} days`
                : "Terms on request"}
            </Text>
          </View>

          <View style={styles.actions}>
            <View style={styles.actionFlex}>
              <Button
                title="Make an offer"
                onPress={() =>
                  router.push({
                    pathname: "/browse/negotiate",
                    params: {
                      id: String(listing.id),
                      category: listing.category,
                      item: listing.item,
                      seller: listing.seller,
                      price: String(listing.price),
                      weight: listing.weight,
                      bags: String(listing.bags ?? ""),
                    },
                  })
                }
              />
            </View>
            <View style={styles.actionFlex}>
              <Button title="Buy" onPress={pendingTrade} />
            </View>
          </View>
          {notice ? <FormStatus kind="info" message={notice} /> : null}

          <View style={styles.card}>
            <Text style={styles.kicker}>Terms of Service</Text>
            <Text style={styles.body}>{FIRM_TERMS}</Text>
          </View>

        </>
      ) : null}
    </ScrollView>
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
  sellerChevron: {
    fontSize: 24,
    color: colors.muted,
  },
  specRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  specCard: {
    flex: 1,
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  qualityChip: {
    backgroundColor: colors.primaryTint,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  qualityChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryDark,
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
  card: {
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  body: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.text,
    opacity: 0.85,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionFlex: {
    flex: 1,
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
