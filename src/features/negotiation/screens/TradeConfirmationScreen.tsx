import { AppTabBar, BUYER_BAR, SELLER_BAR } from "@/components/common/AppTabBar";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { FormStatus } from "@/components/ui/FormStatus";
import { resolveBackendRole } from "@/core/auth/roleStore";
import { getFriendlyApiError } from "@/core/api/client";
import { bagsLabel, priceLabel } from "@/core/utils/format";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { Sheet } from "@/features/negotiation/components/Sheet";
import { useBrokerOptions } from "@/features/negotiation/hooks/useBrokerOptions";
import { useTrade } from "@/features/negotiation/hooks/useTrade";
import { useTradeActions } from "@/features/negotiation/hooks/useTradeActions";
import type { NegotiationRole } from "@/features/negotiation/utils";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { TradeRecord } from "@/types/domain";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface TradeConfirmationScreenProps {
  id?: string;
  tradeId?: string;
}

/** Prototype label for the "no broker involved" option. */
const NO_BROKER = "No broker";

/** Trade Confirmed (FE doc §6) — the buyer picks the broker once. */
export function TradeConfirmationScreen({
  id,
  tradeId: initialTradeId,
}: TradeConfirmationScreenProps) {
  const { session } = useAuth();
  const {
    trade,
    setTrade,
    isLoading,
    error: loadError,
    retry,
  } = useTrade(initialTradeId, id);
  const { options, isLoading: brokersLoading } = useBrokerOptions();
  const { chooseBroker } = useTradeActions();
  const [brokerLabel, setBrokerLabel] = useState("");
  const [doneOpen, setDoneOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const backendRole = resolveBackendRole(session?.user);
  const role: NegotiationRole = backendRole === "seller" ? "seller" : "buyer";
  if (backendRole === "broker") return <Redirect href="/browse" />;

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

  const brokerLabels = [NO_BROKER, ...options.map((option) => option.name)];
  const needsBroker =
    role === "buyer" &&
    Boolean(trade?.buyerCanChooseBroker || trade?.brokerPending);

  async function finish() {
    if (!trade) return;
    setFormError(null);
    if (needsBroker && !trade.brokerId) {
      if (!brokerLabel) {
        setFormError(`Please select a broker or ${NO_BROKER}.`);
        return;
      }
      setBusy(true);
      try {
        const selected = options.find((option) => option.name === brokerLabel);
        const updated = await chooseBroker(
          trade.id,
          selected ? { brokerId: selected.id } : { isSelf: true },
        );
        setTrade(updated);
      } catch (e) {
        setFormError(getFriendlyApiError(e, "Could not select a broker"));
        setBusy(false);
        return;
      }
      setBusy(false);
    }
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
        {isLoading && !trade ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.muted}>Loading trade…</Text>
          </View>
        ) : !trade ? (
          <View style={styles.center}>
            <FormStatus
              kind="error"
              message={loadError ?? "This trade is no longer available."}
            />
            {loadError ? (
              <Button title="Retry" variant="secondary" onPress={() => void retry()} />
            ) : null}
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <View style={styles.successIcon}>
                <Text style={styles.check}>✓</Text>
              </View>
              <Text style={styles.heroTitle}>
                {role === "seller" ? "Trade agreed" : "Trade Confirmed!"}
              </Text>
              <Text style={styles.heroSubtitle}>Your order has been confirmed</Text>
            </View>

            <TradeCard trade={trade} role={role} />

            {formError ? <FormStatus kind="error" message={formError} /> : null}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Select Broker</Text>
              {needsBroker && !trade.brokerId ? (
                <>
                  <Text style={styles.cardHint}>Select Broker involved in the deal</Text>
                  <Dropdown
                    placeholder={
                      brokersLoading ? "Loading brokers…" : "Select broker"
                    }
                    value={brokerLabel}
                    options={brokerLabels}
                    onChange={setBrokerLabel}
                  />
                </>
              ) : (
                <Text style={styles.brokerValue}>
                  {trade.brokerName ?? NO_BROKER}
                </Text>
              )}
            </View>

            <Button title="Done" loading={busy} onPress={() => void finish()} />
          </>
        )}
      </ScrollView>

      <Sheet
        visible={doneOpen}
        title="Trade confirmed"
        showHeader={false}
        onClose={closeDone}
      >
        <View style={styles.doneCenter}>
          <View style={styles.doneIcon}>
            <Text style={styles.doneCheck}>✓</Text>
          </View>
          <Text style={styles.doneText}>
            Your Trade confirmation details can be seen in Completed Trades
            section and will also be sent on your Whatsapp.
          </Text>
        </View>
        <Button title="OK" onPress={closeDone} />
      </Sheet>

      <AppTabBar items={tabItems} active={activeTab} onPress={navigateTab} />
    </View>
  );
}

function TradeCard({
  trade,
  role,
}: {
  trade: TradeRecord;
  role: NegotiationRole;
}) {
  return (
    <View style={styles.card}>
      <DetailRow label="Item" value={trade.item} />
      <DetailRow
        label={role === "buyer" ? "Seller" : "Buyer"}
        value={role === "buyer" ? trade.seller : trade.buyer}
      />
      <DetailRow label="Price" value={priceLabel(trade.price)} strong />
      <DetailRow label="Quantity" value={bagsLabel(trade.bags)} />
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
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  muted: {
    fontSize: 13,
    color: colors.muted,
  },
  hero: {
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
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
    fontSize: 14,
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
  brokerValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
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
  doneCheck: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.success,
  },
  doneText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: "center",
  },
});
