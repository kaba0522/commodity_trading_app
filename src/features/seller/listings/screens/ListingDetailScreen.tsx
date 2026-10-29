import { BackButton } from "@/components/common/BackButton";
import { ConfirmSheet } from "@/components/common/ConfirmSheet";
import { FormStatus } from "@/components/ui/FormStatus";
import { Button } from "@/components/ui/Button";
import { getFriendlyApiError } from "@/core/api/client";
import { priceLabel } from "@/core/utils/format";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { ListingMedia } from "@/features/shared/listings/components/ListingMedia";
import { RateEditSheet } from "@/features/seller/listings/components/RateEditSheet";
import {
  isActiveListing,
  listingsApi,
} from "@/features/seller/listings/api/listingsApi";
import { useListingDetail } from "@/features/seller/listings/hooks/useListingDetail";
import { useMyProfile } from "@/features/shared/profile/hooks/useMyProfile";
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function paymentTermsLabel(
  listingTerms: number | null | undefined,
  defaultTerms: number | null | undefined,
): string {
  const terms = listingTerms ?? defaultTerms;
  return terms !== null && terms !== undefined
    ? `${terms} days`
    : "Payment terms not set";
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
  const { runWithAuth, session } = useAuth();
  const {
    profile,
    isLoading: isProfileLoading,
    error: profileError,
  } = useMyProfile();
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [showRateEditor, setShowRateEditor] = useState(false);
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

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

  async function saveListingRate(price: number): Promise<boolean> {
    if (!listing || isSavingRate) return false;
    setIsSavingRate(true);
    setRateError(null);
    try {
      await runWithAuth((token) =>
        listingsApi.update(String(listing.id), { price }, token),
      );
      await retry();
      return true;
    } catch (cause) {
      setRateError(getFriendlyApiError(cause, "Could not save the rate"));
      return false;
    } finally {
      setIsSavingRate(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.md },
      ]}
    >
      <View style={styles.topRow}>
        <BackButton
          accessibilityLabel="Back to today's listings"
          fallback="/add-listing"
        />
        {listing ? (
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [
                styles.topAction,
                styles.editAction,
                pressed && styles.actionPressed,
              ]}
              onPress={() =>
                router.push({
                  pathname: "/edit-listing/[id]",
                  params: { id: String(listing.id) },
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Edit listing"
            >
              <Text style={styles.editActionText}>Edit Listing</Text>
            </Pressable>
            {listing.status !== "withdrawn" &&
            listing.status !== "traded" &&
            listing.status !== "sold_out" ? (
              <Pressable
                style={({ pressed }) => [
                  styles.topAction,
                  styles.withdrawAction,
                  pressed && !isWithdrawing && styles.actionPressed,
                  isWithdrawing && styles.busyAction,
                ]}
                onPress={() => {
                  setWithdrawError(null);
                  setShowWithdrawConfirm(true);
                }}
                disabled={isWithdrawing}
                accessibilityRole="button"
                accessibilityLabel="Withdraw listing"
              >
                {isWithdrawing ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={styles.withdrawActionText}>Withdraw</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

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
          <View style={styles.productHeader}>
            <Text style={styles.category}>{listing.category}</Text>
            <View style={styles.productTitleRow}>
              <Text style={styles.title}>
                {listing.quality
                  ? `${listing.item} · ${listing.quality}`
                  : listing.item}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  isActiveListing(listing)
                    ? styles.liveBadge
                    : styles.inactiveBadge,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    isActiveListing(listing)
                      ? styles.liveText
                      : styles.inactiveText,
                  ]}
                >
                  {listing.status === "withdrawn"
                    ? "Withdrawn"
                    : listing.status === "traded"
                      ? "Traded"
                      : listing.status === "sold_out"
                        ? "Sold out"
                        : isActiveListing(listing)
                          ? "Live"
                          : "Needs price"}
                </Text>
              </View>
            </View>
          </View>

          {withdrawError && !showWithdrawConfirm ? (
            <Text style={styles.errorText}>{withdrawError}</Text>
          ) : null}

          <View style={styles.priceCard}>
            <View style={styles.priceHeader}>
              <Text style={styles.kicker}>Price per bag</Text>
              <Pressable
                onPress={() => {
                  setRateError(null);
                  setShowRateEditor(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Edit listing price"
                hitSlop={8}
              >
                <Text style={styles.priceEdit}>Edit</Text>
              </Pressable>
            </View>
            <Text style={styles.price}>
              {listing.price > 0 ? priceLabel(listing.price) : "N/A"}
            </Text>
            {listing.priceValidUntil ? (
              <Text style={styles.expiryText}>
                {priceExpiryLabel(listing.priceValidUntil)}
              </Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.kicker}>Listing details</Text>
            <DetailRow
              label="Payment terms"
              value={paymentTermsLabel(
                listing.paymentTerms,
                session?.user.defaultPaymentTerms,
              )}
            />
            <DetailRow
              label="Quantity"
              value={
                listing.bags !== undefined
                  ? `${listing.bags} ${listing.bags === 1 ? "bag" : "bags"}`
                  : "Not provided"
              }
            />
            <DetailRow
              label="Weight per bag"
              value={listing.weight || "Not provided"}
            />
            <View style={styles.termsBlock}>
              <Text style={styles.detailLabel}>Terms of service</Text>
              {isProfileLoading && !profile ? (
                <Text style={styles.body}>Loading firm terms…</Text>
              ) : profileError && !profile ? (
                <FormStatus kind="error" message={profileError} />
              ) : (
                <Text style={styles.body}>
                  {profile?.firmNotes?.trim() ||
                    session?.user.firmNotes?.trim() ||
                    "No firm terms have been added."}
                </Text>
              )}
            </View>
          </View>

          <ListingMedia
            photoUrls={listing.photoUrls}
            videoUrls={listing.videoUrls}
            title="Photos & sample video"
            subtitle=""
          />
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
      {listing ? (
        <RateEditSheet
          key={`${listing.id}-${listing.price}-${showRateEditor}`}
          visible={showRateEditor}
          category={listing.category}
          weight={listing.weight}
          item={listing.item}
          price={listing.price > 0 ? listing.price : null}
          saving={isSavingRate}
          error={rateError}
          onClose={() => {
            setShowRateEditor(false);
            setRateError(null);
          }}
          onSave={saveListingRate}
        />
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
  center: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  topAction: {
    width: 88,
    height: 36,
    paddingHorizontal: spacing.xs,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  editAction: {
    backgroundColor: colors.primary,
  },
  withdrawAction: {
    backgroundColor: colors.danger,
  },
  editActionText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  withdrawActionText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  actionPressed: {
    opacity: 0.75,
  },
  busyAction: {
    opacity: 0.7,
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
  productHeader: {
    gap: spacing.xs,
  },
  category: {
    fontSize: 14,
    color: colors.muted,
  },
  productTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  liveBadge: {
    backgroundColor: colors.successBg,
  },
  inactiveBadge: {
    backgroundColor: colors.surface,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  liveText: {
    color: colors.success,
  },
  inactiveText: {
    color: colors.muted,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  priceCard: {
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.lg,
    minHeight: 105,
  },
  priceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceEdit: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  kicker: {
    fontSize: 11,
    color: colors.muted,
  },
  price: {
    fontSize: 27,
    fontWeight: "800",
    color: colors.text,
  },
  expiryText: {
    fontSize: 11,
    color: colors.muted,
  },
  card: {
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.lg,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  detailLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.muted,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
    textAlign: "right",
  },
  termsBlock: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  body: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.text,
    opacity: 0.85,
  },
});
