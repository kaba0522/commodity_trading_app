import { ChevronIcon } from "@/components/common/ChevronIcon";
import { ConfirmSheet } from "@/components/common/ConfirmSheet";
import { Button } from "@/components/ui/Button";
import { useMyRequirements } from "@/features/buyer/requirements/hooks/useMyRequirements";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { fonts } from "@/theme/typography";
import type { BuyerRequirement } from "@/types/domain";
import { router } from "expo-router";
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

/**
 * Buyer's active posted requirements with links to their details and withdraw.
 */
export function MyRequirementsScreen() {
  const insets = useSafeAreaInsets();
  const { items, count, isLoading, error, retry, withdraw, withdrawingId } =
    useMyRequirements();
  const [pending, setPending] = useState<BuyerRequirement | null>(null);
  const pendingBusy = pending ? withdrawingId === String(pending.id) : false;

  function openForm() {
    router.push("/post-req/new");
  }

  function openDetail(req: BuyerRequirement) {
    router.push({
      pathname: "/post-req/[id]",
      params: {
        id: String(req.id),
        category: req.category,
        item: req.item,
        bags: String(req.bags),
        targetPrice: String(req.targetPrice),
        paymentTerms: req.paymentTerms,
        quality: req.quality ?? "",
        weightKg: req.weightKg != null ? String(req.weightKg) : "",
        location: req.location ?? "",
        notes: req.notes ?? "",
        status: req.status ?? "",
        createdAt: req.createdAt ?? "",
      },
    });
  }

  function openEdit(req: BuyerRequirement) {
    router.push({
      pathname: "/post-req/edit/[id]",
      params: {
        id: String(req.id),
        categoryId: req.categoryId ?? "",
        commodityId: req.commodityId ?? "",
        quantity: String(req.bags),
      },
    });
  }

  async function handleSheetConfirm() {
    if (!pending || pendingBusy) return;
    const ok = await withdraw(pending.id);
    if (ok) setPending(null);
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            {/* <Text style={styles.eyebrow}>BUYER DASHBOARD</Text> */}
            <Text style={styles.title}>My requirements</Text>
            <Text style={styles.subtitle}>
              Manage what you need and hear from sellers.
            </Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.count}>{count}</Text>
            <Text style={styles.countLabel}>posted</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.centerText}>Loading your requirements…</Text>
          </View>
        ) : error && items.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Couldn’t load requirements</Text>
            <Text style={styles.centerText}>{error}</Text>
            <Button title="Try again" variant="secondary" onPress={retry} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>+</Text>
            </View>
            <Text style={styles.emptyTitle}>No requirements yet</Text>
            <Text style={styles.emptyText}>
              Post what you’re looking for and sellers can send offers directly
              to you. Tap + to get started.
            </Text>
          </View>
        ) : (
          <View style={styles.listSection}>
            <View style={styles.listHeading}>
              <Text style={styles.listTitle}>Your posted needs</Text>
              {/* <Text style={styles.listCount}>{count}</Text> */}
            </View>
            <View style={styles.list}>
              {items.map((req) => {
                const busy = withdrawingId === String(req.id);
                const details = [
                  req.quality,
                  req.paymentTerms ? `${req.paymentTerms} terms` : null,
                  req.location,
                ].filter((detail): detail is string => Boolean(detail));

                return (
                  <View key={String(req.id)} style={styles.card}>
                    <Pressable
                      style={styles.cardContent}
                      onPress={() => openDetail(req)}
                      accessibilityRole="button"
                      accessibilityLabel={`${req.item}, ${req.bags} bags. View requirement details.`}
                    >
                      <View style={styles.cardInfo}>
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryText} numberOfLines={1}>
                            {req.category}
                          </Text>
                        </View>
                        <Text style={styles.itemTitle} numberOfLines={1}>
                          {req.item}
                        </Text>
                        <Text style={styles.quantity} numberOfLines={1}>
                          {req.bags.toLocaleString("en-IN")} bags
                          {req.weightKg != null
                            ? ` · ${req.weightKg} kg / bag`
                            : ""}
                        </Text>
                        {details.length > 0 ? (
                          <Text style={styles.details} numberOfLines={1}>
                            {details.join(" · ")}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.priceSide}>
                        <View style={styles.priceBlock}>
                          <Text
                            style={[
                              styles.price,
                              req.targetPrice <= 0 && styles.openPrice,
                            ]}
                            numberOfLines={2}
                          >
                            {req.targetPrice > 0
                              ? `₹${req.targetPrice.toLocaleString("en-IN")}`
                              : "View details"}
                          </Text>
                          {req.targetPrice > 0 ? (
                            <Text style={styles.priceUnit}>per bag</Text>
                          ) : null}
                        </View>
                        <ChevronIcon />
                      </View>
                    </Pressable>

                    <View
                      style={[
                        styles.cardActions,
                        req.targetPrice <= 0 && styles.cardActionsEnd,
                      ]}
                    >
                      {req.targetPrice > 0 ? (
                        <Text style={styles.actionHint}>View requirement</Text>
                      ) : null}
                      <View style={styles.actionButtons}>
                        <Pressable
                          style={styles.editAction}
                          hitSlop={8}
                          onPress={() => openEdit(req)}
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${req.item}`}
                        >
                          <Text style={styles.editText}>Edit</Text>
                        </Pressable>
                        <Pressable
                          style={styles.withdrawAction}
                          hitSlop={8}
                          disabled={busy}
                          onPress={() => setPending(req)}
                          accessibilityRole="button"
                          accessibilityLabel={`Withdraw ${req.item}`}
                        >
                          <Text
                            style={[
                              styles.withdrawText,
                              busy && styles.withdrawBusy,
                            ]}
                          >
                            {busy ? "Withdrawing…" : "Withdraw"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        )}
      </ScrollView>

      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + spacing.md },
          pressed && styles.fabPressed,
        ]}
        onPress={openForm}
        accessibilityRole="button"
        accessibilityLabel="Post a requirement"
      >
        <Text style={styles.fabPlus}>+</Text>
      </Pressable>

      <ConfirmSheet
        visible={pending !== null}
        title="Withdraw requirement?"
        message={
          pending
            ? `${pending.item} — ${pending.bags} bags will be taken off the market.`
            : ""
        }
        confirmTitle="Withdraw"
        cancelTitle="Keep"
        error={error}
        isBusy={pendingBusy}
        onConfirm={() => void handleSheetConfirm()}
        onCancel={() => {
          if (!pendingBusy) setPending(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: 96,
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.primary,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 25,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  countBadge: {
    minWidth: 66,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryTint,
    borderRadius: 14,
  },
  count: {
    fontFamily: fonts.bodyBold,
    fontSize: 20,
    fontWeight: "800",
    color: colors.primaryDark,
  },
  countLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.primaryDark,
  },
  listSection: {
    gap: spacing.sm,
  },
  listHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  listTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  listCount: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.muted,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    overflow: "hidden",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.tagBuyerBg,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  categoryText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    fontWeight: "700",
    color: colors.tagBuyerText,
  },
  itemTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  quantity: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text,
  },
  details: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.muted,
  },
  priceSide: {
    maxWidth: 120,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  priceBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-end",
  },
  price: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    fontWeight: "700",
    color: colors.primaryDark,
    textAlign: "right",
  },
  openPrice: {
    fontSize: 11,
    color: colors.primaryDark,
  },
  priceUnit: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
  },
  actionHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
  },
  cardActions: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  cardActionsEnd: {
    justifyContent: "flex-end",
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  editAction: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  editText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    fontWeight: "600",
    color: colors.onPrimary,
  },
  withdrawAction: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.danger,
    borderRadius: 8,
  },
  withdrawText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    fontWeight: "600",
    color: colors.onPrimary,
  },
  withdrawBusy: {
    opacity: 0.6,
  },
  center: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  centerText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
  },
  stateCard: {
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  stateTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  emptyCard: {
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryTint,
    borderRadius: 24,
  },
  emptyIconText: {
    fontSize: 28,
    lineHeight: 32,
    color: colors.primary,
  },
  emptyTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: "center",
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.danger,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
  },
  fabPressed: {
    opacity: 0.8,
  },
  fabPlus: {
    fontSize: 32,
    fontWeight: "300",
    lineHeight: 34,
    marginTop: -2,
    color: colors.onPrimary,
  },
});
