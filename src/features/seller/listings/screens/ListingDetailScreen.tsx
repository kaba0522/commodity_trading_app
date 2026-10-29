import { BackButton } from "@/components/common/BackButton";
import { ConfirmSheet } from "@/components/common/ConfirmSheet";
import { Button } from "@/components/ui/Button";
import { getFriendlyApiError } from "@/core/api/client";
import { priceLabel } from "@/core/utils/format";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { ListingMedia } from "@/features/shared/listings/components/ListingMedia";
import { listingsApi } from "@/features/seller/listings/api/listingsApi";
import { useListingDetail } from "@/features/seller/listings/hooks/useListingDetail";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FIRM_TERMS =
  "Goods must be outward within two days of order confirmation. Program received only before 5:00 PM. No tempo loading after 10 PM. Prices are subject to market conditions.";
const CONTACTS = [
  { name: "Ratan", phone: "98108 71966" },
  { name: "Sanjay", phone: "76658 99003" },
  { name: "Naveen", phone: "89502 78270" },
];

function priceExpiryLabel(value: string | null | undefined): string {
  if (!value) return "No active price expiry";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Expiry unavailable";
  const formatted = date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
  return `Valid until ${formatted}`;
}

/**
 * Seller listing detail (`isDetail` in Seller App.html): price + validity,
 * payment terms, and media from `GET /listings/:id`.
 */
export function ListingDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { listing, isLoading, error, retry } = useListingDetail(
    typeof id === "string" ? id : undefined,
  );
  const { runWithAuth } = useAuth();
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  async function withdrawListing() {
    if (!listing || isWithdrawing) return;
    setIsWithdrawing(true);
    setWithdrawError(null);
    try {
      await runWithAuth((token) =>
        listingsApi.withdraw(String(listing.id), token),
      );
      router.back();
    } catch (cause) {
      setWithdrawError(
        getFriendlyApiError(cause, "Could not withdraw this listing"),
      );
    } finally {
      setIsWithdrawing(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.md },
      ]}
    >
      <BackButton
        accessibilityLabel="Back to today's listings"
        fallback="/add-listing"
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.muted}>Loading listing…</Text>
        </View>
      ) : error || !listing ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>
            {error ?? "Listing details unavailable."}
          </Text>
          <Button title="Retry" variant="secondary" onPress={retry} />
        </View>
      ) : (
        <>
          <View>
            <View style={styles.tagRow}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{listing.category}</Text>
              </View>
            </View>
            <Text style={styles.title}>{listing.item}</Text>
            <Text style={styles.muted}>{listing.weight} per bag</Text>
          </View>

          <View style={styles.actionRow}>
            <View style={styles.actionButton}>
              <Button
                title="Edit listing"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/edit-listing/[id]",
                    params: { id: String(listing.id) },
                  })
                }
              />
            </View>
            {listing.status !== "withdrawn" &&
            listing.status !== "traded" &&
            listing.status !== "sold_out" ? (
              <View style={styles.actionButton}>
                <Button
                  title="Withdraw"
                  variant="secondary"
                  onPress={() => {
                    setWithdrawError(null);
                    setShowWithdrawConfirm(true);
                  }}
                  loading={isWithdrawing}
                  disabled={isWithdrawing}
                />
              </View>
            ) : null}
          </View>

          {withdrawError && !showWithdrawConfirm ? (
            <Text style={styles.errorText}>{withdrawError}</Text>
          ) : null}

          <View style={styles.priceCard}>
            <Text style={styles.kicker}>Price per bag</Text>
            <Text style={styles.price}>
              {listing.price > 0 ? priceLabel(listing.price) : "N/A"}
            </Text>
            <View style={styles.validTag}>
              <Text style={styles.validTagText}>
                {priceExpiryLabel(listing.priceValidUntil)}
              </Text>
            </View>
          </View>

          <ListingMedia
            photoUrls={listing.photoUrls}
            videoUrls={listing.videoUrls}
          />

          <View style={styles.card}>
            <Text style={styles.kicker}>Payment terms</Text>
            <Text style={styles.body}>
              {listing.paymentTerms !== null &&
              listing.paymentTerms !== undefined
                ? `${listing.paymentTerms} days`
                : "Not provided"}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.kicker}>Terms of Service</Text>
            <Text style={styles.body}>{FIRM_TERMS}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.kicker}>Contacts</Text>
            {CONTACTS.map((c) => (
              <View key={c.name} style={styles.contactRow}>
                <Text style={styles.contactName}>{c.name}</Text>
                <Text style={styles.muted}>{c.phone}</Text>
              </View>
            ))}
          </View>
        </>
      )}
      <ConfirmSheet
        visible={showWithdrawConfirm}
        title="Withdraw listing?"
        message={
          listing
            ? `${listing.item} will be taken off the market.`
            : "This listing will be taken off the market."
        }
        confirmTitle="Withdraw"
        cancelTitle="Keep listing"
        error={withdrawError}
        isBusy={isWithdrawing}
        onConfirm={() => void withdrawListing()}
        onCancel={() => {
          if (!isWithdrawing) {
            setShowWithdrawConfirm(false);
            setWithdrawError(null);
          }
        }}
      />
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
  center: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  errorText: {
    fontSize: 13.5,
    color: colors.danger,
    textAlign: "center",
  },
  muted: {
    fontSize: 14,
    color: colors.muted,
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
    color: colors.tagSolid,
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
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  contactName: {
    fontSize: 14,
    color: colors.text,
  },
});
