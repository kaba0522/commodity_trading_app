import { ChevronIcon } from "@/components/common/ChevronIcon";
import { Button } from "@/components/ui/Button";
import { FormStatus } from "@/components/ui/FormStatus";
import { bagsLabel, priceLabel } from "@/core/utils/format";
import { useNegotiations } from "@/features/negotiation/hooks/useNegotiations";
import {
  isCompletedTradeStatus,
  latestOfferPrice,
  statusLabel,
  type NegotiationRole,
} from "@/features/negotiation/utils";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { NegotiationStatus, NegotiationThread } from "@/types/domain";
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

type Tab = "active" | "completed";

interface NegotiationListScreenProps {
  role: NegotiationRole;
  /** Deep links from Trade Confirmed can open directly on Completed Trades. */
  initialTab?: Tab;
}

/** Buyer Trades / Seller Orders list — one state machine, role-aware labels. */
export function NegotiationListScreen({
  role,
  initialTab = "active",
}: NegotiationListScreenProps) {
  // Re-derive from the route param when it changes without a setState-in-effect.
  const [selection, setSelection] = useState({ initialTab, tab: initialTab });
  const tab = selection.initialTab === initialTab ? selection.tab : initialTab;
  const { threads: serverThreads, isLoading, error, retry } = useNegotiations(tab, role);
  const threads = serverThreads.filter(
    (thread) => thread.role === role && belongsToTab(thread, tab),
  );

  function selectTab(next: Tab) {
    setSelection({ initialTab, tab: next });
  }

  function openThread(thread: NegotiationThread) {
    router.push({ pathname: "/negotiation/[id]", params: { id: thread.id } });
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Trades</Text>

      <View style={styles.tabs}>
        <Pressable
          onPress={() => selectTab("active")}
          style={[styles.tab, tab === "active" && styles.tabActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === "active" }}
        >
          <Text style={[styles.tabText, tab === "active" && styles.tabTextActive]}>
            Active Negotiations
          </Text>
        </Pressable>
        <Pressable
          onPress={() => selectTab("completed")}
          style={[styles.tab, tab === "completed" && styles.tabActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === "completed" }}
        >
          <Text
            style={[styles.tabText, tab === "completed" && styles.tabTextActive]}
          >
            Completed Trades
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.emptyText}>Loading negotiations…</Text>
        </View>
      ) : error ? (
        <View style={styles.empty}>
          <FormStatus kind="error" message={error} />
          <Button title="Retry" variant="secondary" onPress={() => void retry()} />
        </View>
      ) : threads.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {tab === "active"
              ? "No active negotiations right now."
              : "No completed trades yet."}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {threads.map((thread) => (
            <Pressable
              key={thread.id}
              onPress={() => openThread(thread)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Open negotiation with ${thread.counterparty}`}
            >
              <View style={styles.cardMain}>
                <Text style={styles.counterparty}>{thread.counterparty}</Text>
                <Text style={styles.item} numberOfLines={2}>
                  {thread.item}
                </Text>
                <Text style={styles.meta}>
                  {priceLabel(thread.listedPrice)} /bag ·{" "}
                  {bagsLabel(thread.requestedBags)}
                </Text>
              </View>

              <View style={styles.cardSide}>
                <Text style={styles.priceTag}>
                  {priceLabel(latestOfferPrice(thread))}
                </Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, badgeStyle(thread.status)]}>
                    <Text style={[styles.badgeText, badgeTextStyle(thread.status)]}>
                      {badgeLabel(thread)}
                    </Text>
                  </View>
                  <ChevronIcon color={colors.muted} size={16} />
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

/** FE doc §4: Completed shows completed/confirmed trades and cancellations. */
function belongsToTab(thread: NegotiationThread, tab: Tab): boolean {
  const completed = isCompletedTradeStatus(thread);
  return tab === "completed" ? completed : !completed;
}

/** FE doc §4: the buyer's turn is a primary "Respond" badge, not a status tag. */
function badgeLabel(thread: NegotiationThread): string {
  return thread.status === "your_turn" ? "Respond" : statusLabel(thread);
}

function badgeStyle(status: NegotiationStatus) {
  switch (status) {
    case "your_turn":
      return styles.badgeRespond;
    case "confirmed":
      return styles.badgePrimary;
    case "completed":
      return styles.badgeSuccess;
    case "waiting":
    case "withdrawn":
    case "declined":
    case "cancelled":
      return styles.badgeOutline;
    default:
      return null;
  }
}

function badgeTextStyle(status: NegotiationStatus) {
  switch (status) {
    case "your_turn":
      return styles.badgeTextRespond;
    case "confirmed":
      return styles.badgeTextPrimary;
    case "completed":
      return styles.badgeTextSuccess;
    case "waiting":
    case "withdrawn":
    case "declined":
    case "cancelled":
      return styles.badgeTextOutline;
    default:
      return null;
  }
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
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.primary,
  },
  list: {
    gap: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pressed: {
    opacity: 0.7,
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  counterparty: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  item: {
    fontSize: 12.5,
    color: colors.muted,
  },
  meta: {
    fontSize: 11.5,
    color: colors.muted,
  },
  cardSide: {
    alignItems: "flex-end",
    gap: 6,
  },
  priceTag: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  badge: {
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeRespond: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  badgePrimary: {
    backgroundColor: colors.primaryTint,
  },
  badgeOutline: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  badgeSuccess: {
    backgroundColor: colors.successBg,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  badgeTextRespond: {
    color: colors.onPrimary,
  },
  badgeTextPrimary: {
    color: colors.primaryDark,
  },
  badgeTextOutline: {
    color: colors.muted,
  },
  badgeTextSuccess: {
    color: colors.success,
  },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
  },
});
