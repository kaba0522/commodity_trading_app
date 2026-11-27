import { AppTabBar, BUYER_BAR, SELLER_BAR } from "@/components/common/AppTabBar";
import { BackButton } from "@/components/common/BackButton";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { resolveBackendRole } from "@/core/auth/roleStore";
import { bagsLabel, priceLabel } from "@/core/utils/format";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { Sheet } from "@/features/negotiation/components/Sheet";
import { confirmTrade, useNegotiationThread } from "@/features/negotiation/store";
import { latestOfferPrice, type NegotiationRole } from "@/features/negotiation/utils";
import { brokersForRole, NO_BROKER } from "@/mocks/brokers";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

interface TradeConfirmationScreenProps {
  id?: string;
}

/** Trade Confirmed (FE doc §6) — shared by buyer buy-now and seller accept. */
export function TradeConfirmationScreen({ id }: TradeConfirmationScreenProps) {
  const threadOrNull = useNegotiationThread(id);
  const { session } = useAuth();
  const [broker, setBroker] = useState("");
  const [doneOpen, setDoneOpen] = useState(false);

  const role: NegotiationRole = threadOrNull?.role ?? "buyer";
  const backendRole = resolveBackendRole(session?.user);
  if (threadOrNull && backendRole !== threadOrNull.role) {
    return <Redirect href={role === "seller" ? "/requirements" : "/browse"} />;
  }

  const tabItems = role === "seller" ? SELLER_BAR : BUYER_BAR;
  const activeTab = role === "seller" ? "orders" : "trades";

  function navigateTab(target: string) {
    if (role === "seller") {
      if (target === "requirements") router.replace("/requirements");
      else if (target === "orders") router.replace("/orders");
      else if (target === "add-listing") router.replace("/add-listing");
      else if (target === "transport") router.replace("/transport");
      else if (target === "seller-profile") router.replace("/seller-profile");
      return;
    }
    if (target === "browse") router.replace("/browse");
    else if (target === "trades") router.replace("/trades");
    else if (target === "post-req") router.replace("/post-req");
    else if (target === "freight") router.replace("/freight");
    else if (target === "profile") router.replace("/profile");
  }

  if (!threadOrNull) {
    return (
      <View style={styles.screen}>
        <View style={styles.emptyScreen}>
          <BackButton fallback={role === "seller" ? "/orders" : "/trades"} />
          <Text style={styles.emptyText}>This trade is no longer available.</Text>
        </View>
        <AppTabBar items={tabItems} active={activeTab} onPress={navigateTab} />
      </View>
    );
  }

  const thread = threadOrNull;
  const price = thread.agreedPrice ?? latestOfferPrice(thread);
  const bags = thread.requestedBags;
  const brokerOptions = Array.from(new Set([...brokersForRole(role), NO_BROKER]));

  function finish() {
    if (!broker) return;
    confirmTrade(thread.id, broker, bags);
    setDoneOpen(true);
  }

  function closeDone() {
    setDoneOpen(false);
    router.replace({
      pathname: role === "seller" ? "/orders" : "/trades",
      params: { tab: "completed" },
    });
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton
          accessibilityLabel="Back to negotiation"
          fallback={{ pathname: "/negotiation/[id]", params: { id: thread.id } }}
        />

        <View style={styles.hero}>
          <View style={styles.successIcon}>
            <Text style={styles.check}>✓</Text>
          </View>
          <Text style={styles.heroTitle}>
            {role === "seller" ? "Trade agreed" : "Trade Confirmed!"}
          </Text>
          <Text style={styles.heroSubtitle}>Your order has been confirmed</Text>
        </View>

        <View style={styles.card}>
          <DetailRow label="Item" value={thread.item} />
          <DetailRow
            label={role === "seller" ? "Buyer" : "Seller"}
            value={thread.counterparty}
          />
          <DetailRow label="Price" value={priceLabel(price)} strong />
          <DetailRow label="Quantity" value={bagsLabel(bags)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Broker</Text>
          <Text style={styles.cardHint}>Select Broker involved in the deal</Text>
          <Dropdown
            label="Broker"
            placeholder="Select a broker"
            value={broker}
            options={brokerOptions}
            onChange={setBroker}
          />
        </View>

        <Button title="Done" onPress={finish} disabled={!broker} />

        <Sheet visible={doneOpen} title="Trade confirmed" onClose={closeDone}>
          <View style={styles.doneCenter}>
            <View style={styles.doneIcon}>
              <Text style={styles.check}>✓</Text>
            </View>
            <Text style={styles.doneText}>
              Your Trade confirmation details can be seen in Completed Trades
              section and will also be sent on your Whatsapp.
            </Text>
          </View>
          <Button title="OK" onPress={closeDone} />
        </Sheet>
      </ScrollView>

      <AppTabBar items={tabItems} active={activeTab} onPress={navigateTab} />
    </View>
  );
}

function DetailRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  emptyScreen: {
    flex: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
  },
  emptyText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  hero: {
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.successBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  check: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.success,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  heroSubtitle: {
    fontSize: 13.5,
    color: colors.muted,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
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
  rowValueStrong: {
    fontWeight: "800",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  cardHint: {
    fontSize: 12,
    color: colors.muted,
    marginTop: -spacing.xs,
  },
  doneCenter: {
    alignItems: "center",
    gap: spacing.md,
  },
  doneIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.successBg,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
    textAlign: "center",
  },
});
