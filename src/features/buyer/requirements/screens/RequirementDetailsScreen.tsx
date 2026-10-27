import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { BackButton } from "@/components/common/BackButton";
import { ConfirmSheet } from "@/components/common/ConfirmSheet";
import { Button } from "@/components/ui/Button";
import { FormStatus } from "@/components/ui/FormStatus";
import { getFriendlyApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { requirementsApi } from "@/features/buyer/requirements/api/requirementsApi";
import { catalogApi } from "@/features/shared/catalog/api/catalogApi";
import type { BuyerRequirement } from "@/types/domain";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { fonts } from "@/theme/typography";

function statusLabel(status?: BuyerRequirement["status"]): string {
  switch (status) {
    case "active":
      return "Active";
    case "price_expired":
      return "Price expired";
    case "na":
      return "Price not set";
    case "withdrawn":
      return "Withdrawn";
    case "traded":
      return "Traded";
    case "sold_out":
      return "Sold out";
    default:
      return "Published";
  }
}

function parseStatus(value?: string): BuyerRequirement["status"] {
  switch (value) {
    case "active":
    case "price_expired":
    case "na":
    case "withdrawn":
    case "traded":
    case "sold_out":
      return value;
    default:
      return undefined;
  }
}

function postedDateLabel(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Buyer's own requirement detail (opened from My requirements): live data
 * via `GET /listings/:id`, seeded from the list row so it renders instantly,
 * plus Withdraw. Back returns to the My requirements list.
 */
export function RequirementDetailsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    category?: string;
    item?: string;
    bags?: string;
    targetPrice?: string;
    paymentTerms?: string;
    quality?: string;
    weightKg?: string;
    location?: string;
    notes?: string;
    status?: string;
    createdAt?: string;
  }>();
  const { runWithAuth } = useAuth();
  const id = typeof params.id === "string" ? params.id : undefined;

  const [requirement, setRequirement] = useState<BuyerRequirement | null>(() =>
    params.item
      ? {
          id: params.id ?? "",
          category: (params.category || "Rice") as BuyerRequirement["category"],
          item: params.item,
          buyer: "",
          paymentTerms: params.paymentTerms || "",
          targetPrice: Number(params.targetPrice ?? 0) || 0,
          bags: Number(params.bags ?? 0) || 0,
          quality: params.quality || undefined,
          weightKg: Number(params.weightKg ?? 0) || undefined,
          location: params.location || undefined,
          notes: params.notes || undefined,
          status: parseStatus(params.status),
          createdAt: params.createdAt || undefined,
        }
      : null,
  );
  const [isLoading, setIsLoading] = useState(!params.item);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      if (!params.item) setError("Requirement details unavailable.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await runWithAuth(async (token) => {
        const categoryById = new Map<string, string>();
        const commodityToCategory = new Map<string, string>();
        try {
          const [categories, commodities] = await Promise.all([
            catalogApi.getCommodityCategories(token),
            catalogApi.getCommodities(token),
          ]);
          for (const category of categories) {
            categoryById.set(category.id, category.name);
          }
          for (const commodity of commodities) {
            const categoryName =
              categoryById.get(commodity.categoryId) ||
              commodity.categoryName;
            if (categoryName) {
              commodityToCategory.set(commodity.id, categoryName);
            }
          }
        } catch {
          // The detail response may include the category name directly.
        }
        return requirementsApi.getById(id, token, {
          categoryById,
          commodityToCategory,
        });
      });
      setRequirement((current) =>
        loaded.category === "Uncategorized" &&
        current?.category &&
        current.category !== "Uncategorized"
          ? { ...loaded, category: current.category }
          : loaded,
      );
    } catch (e) {
      if (!params.item) {
        setError(getFriendlyApiError(e, "Could not load this requirement"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, params.item, runWithAuth]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function doWithdraw() {
    if (!requirement || isWithdrawing) return;
    setIsWithdrawing(true);
    setError(null);
    try {
      await runWithAuth((token) =>
        requirementsApi.withdraw(requirement.id, token),
      );
      // Success navigates back, unmounting the sheet with the screen.
      router.back();
    } catch (e) {
      // Stay on the sheet so the error shows inside it with a retry.
      setError(getFriendlyApiError(e, "Could not withdraw the requirement"));
    } finally {
      setIsWithdrawing(false);
    }
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
      >
        <View style={styles.topRow}>
          <BackButton
            accessibilityLabel="Back to my requirements"
            fallback="/post-req"
          />
        </View>

        {isLoading && !requirement ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.muted}>Loading requirement…</Text>
          </View>
        ) : error && !requirement ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <Button title="Retry" variant="secondary" onPress={load} />
          </View>
        ) : requirement ? (
          <>
            <View style={styles.productCard}>
              <View style={styles.productTop}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{requirement.category}</Text>
                </View>
                <View style={styles.statusBadge}>
                  <View
                    style={[
                      styles.statusDot,
                      requirement.status === "price_expired" &&
                        styles.statusDotWarning,
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      requirement.status === "price_expired" &&
                        styles.statusTextWarning,
                    ]}
                  >
                    {statusLabel(requirement.status)}
                  </Text>
                </View>
              </View>
              <Text style={styles.title}>{requirement.item}</Text>
              <Text style={styles.subtitle}>Buyer requirement</Text>
            </View>

            <View style={styles.priceCard}>
              <View style={styles.priceInfo}>
                <Text style={styles.sectionLabel}>TARGET PRICE</Text>
                <Text style={styles.price}>
                  {requirement.targetPrice > 0
                    ? `₹${requirement.targetPrice.toLocaleString("en-IN")}`
                    : "Open to offers"}
                </Text>
                {requirement.targetPrice > 0 ? (
                  <Text style={styles.priceUnit}>per bag</Text>
                ) : null}
              </View>
              <View style={styles.quantityBlock}>
                <Text style={styles.sectionLabel}>QUANTITY</Text>
                <Text style={styles.quantity}>
                  {requirement.bags.toLocaleString("en-IN")}
                </Text>
                <Text style={styles.quantityUnit}>bags</Text>
              </View>
            </View>
            {requirement.targetPrice > 0 ? (
              <View style={styles.estimateRow}>
                <Text style={styles.estimateLabel}>
                  Estimated total at target price
                </Text>
                <Text style={styles.estimateValue}>
                  ₹
                  {(requirement.targetPrice * requirement.bags).toLocaleString(
                    "en-IN",
                  )}
                </Text>
              </View>
            ) : null}

            <View style={styles.detailsCard}>
              <Text style={styles.sectionTitle}>Requirement details</Text>
              {/* <DetailRow
                label="Reference ID"
                value={String(requirement.id)}
              /> */}
              {postedDateLabel(requirement.createdAt) ? (
                <DetailRow
                  label="Posted on"
                  value={postedDateLabel(requirement.createdAt) ?? ""}
                />
              ) : null}
              <DetailRow
                label="Status"
                value={statusLabel(requirement.status)}
              />
              {requirement.weightKg != null ? (
                <DetailRow
                  label="Weight per bag"
                  value={`${requirement.weightKg} kg`}
                />
              ) : null}
              <DetailRow
                label="Payment terms"
                value={
                  /^\d+$/.test(requirement.paymentTerms)
                    ? `${requirement.paymentTerms} days`
                    : requirement.paymentTerms || "Terms on request"
                }
              />
              {requirement.quality ? (
                <DetailRow label="Quality grade" value={requirement.quality} />
              ) : null}
              {requirement.location ? (
                <DetailRow
                  label="Delivery location"
                  value={requirement.location}
                />
              ) : null}
              {requirement.notes ? (
                <View style={styles.notes}>
                  <Text style={styles.detailLabel}>Notes for sellers</Text>
                  <Text style={styles.notesText}>{requirement.notes}</Text>
                </View>
              ) : null}
            </View>

            {error ? <FormStatus kind="error" message={error} /> : null}

            <View style={styles.buttonWrapper}>
              <Button
                title="Withdraw requirement"
                variant="secondary"
                onPress={() => setShowConfirm(true)}
              />
            </View>
          </>
        ) : null}
      </ScrollView>

      <ConfirmSheet
        visible={showConfirm && requirement !== null}
        title="Withdraw requirement?"
        message={
          requirement
            ? `${requirement.item} will be taken off the market.`
            : ""
        }
        confirmTitle="Withdraw"
        cancelTitle="Keep"
        error={error}
        isBusy={isWithdrawing}
        onConfirm={() => void doWithdraw()}
        onCancel={() => {
          if (!isWithdrawing) {
            setShowConfirm(false);
            setError(null);
          }
        }}
      />
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
  },
  productCard: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  productTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.primaryTint,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  statusDotWarning: {
    backgroundColor: colors.warning,
  },
  statusText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: colors.primaryDark,
  },
  statusTextWarning: {
    color: colors.warning,
  },
  priceCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.primaryTint,
    borderRadius: 14,
  },
  priceInfo: {
    flex: 1,
    gap: 3,
  },
  sectionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: colors.muted,
  },
  price: {
    fontFamily: fonts.bodyBold,
    fontSize: 22,
    fontWeight: "800",
    color: colors.primaryDark,
  },
  priceUnit: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
  },
  quantityBlock: {
    minWidth: 95,
    alignItems: "flex-end",
    gap: 2,
    paddingLeft: spacing.md,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  quantity: {
    fontFamily: fonts.bodyBold,
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  quantityUnit: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
  },
  estimateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginTop: -spacing.sm,
  },
  estimateLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
  },
  estimateValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  detailsCard: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    paddingVertical: spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
  },
  detailValue: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    textAlign: "right",
  },
  notes: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  notesText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  buttonWrapper: {
    marginTop: spacing.xs,
  },
  center: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  muted: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: colors.danger,
    textAlign: "center",
  },
});
