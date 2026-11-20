import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/Button";
import { useBrokerTrades } from "@/features/broker/trades/hooks/useBrokerTrades";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { ScrollView, StyleSheet, Text, View } from "react-native";

/**
 * Broker's own trades. For now the backend contract for broker-scoped
 * trades is not finalized — this screen calls the existing trades endpoint
 * with a broker-scoped query and degrades gracefully when the endpoint
 * returns empty or 404. The UI is intentionally minimal until the backend
 * contract lands.
 */
export function BrokerTradesScreen() {
  const { trades, isLoading, error, retry } = useBrokerTrades();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: spacing.md, paddingBottom: spacing.xl },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>My Trades</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <Text style={styles.centerText}>Loading your trades…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" variant="secondary" onPress={retry} />
        </View>
      ) : trades.length === 0 ? (
        <EmptyState
          title="No trades yet"
          message="Completed trades where you acted as the broker will appear here."
        />
      ) : (
        <View style={styles.list}>
          {trades.map((trade) => (
            <View key={trade.id} style={styles.card}>
              <Text style={styles.cardTitle}>{trade.item}</Text>
              <Text style={styles.cardMeta}>
                {trade.seller} · {trade.bags} bags · ₹{trade.price}
              </Text>
              <Text style={styles.cardStatus}>{trade.status}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  center: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  centerText: {
    fontSize: 13,
    color: colors.muted,
  },
  errorText: {
    fontSize: 13.5,
    color: colors.danger,
    textAlign: "center",
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: colors.card,
    gap: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  cardMeta: {
    fontSize: 12,
    color: colors.muted,
  },
  cardStatus: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.primary,
    textTransform: "capitalize",
  },
});