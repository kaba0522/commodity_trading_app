import { Button } from "@/components/ui/Button";
import { useFreightRoutes } from "@/features/shared/freight/hooks/useFreightRoutes";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

function priceLabel(low: number | null, high: number | null): string {
  if (low === null && high === null) return "Price expired";
  const format = (value: number) =>
    `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  if (low === null) return high === null ? "Price expired" : format(high);
  if (high === null || low === high) return format(low);
  return `${format(low)}–${format(high)}`;
}

function unitLabel(unit: string): string {
  return unit.replace(/[_-]+/g, " ");
}

/** Shared read-only freight rates for buyer and seller roles. */
export function FreightScreen() {
  const insets = useSafeAreaInsets();
  const {
    search,
    setSearch,
    routes,
    isLoading,
    isLoadingMore,
    error,
    canLoadMore,
    retry,
    loadMore,
  } = useFreightRoutes();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>REFERENCE</Text>
          <Text style={styles.title}>Freight rates</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>
        Read-only freight prices · rates are updated daily
      </Text>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search city"
        placeholderTextColor={colors.muted}
        accessibilityLabel="Search origin or destination city"
        returnKeyType="search"
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.muted}>Loading freight rates…</Text>
        </View>
      ) : error && routes.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" variant="secondary" onPress={retry} />
        </View>
      ) : routes.length === 0 ? (
        <Text style={styles.empty}>
          {search.trim()
            ? "No freight routes match that city."
            : "No freight routes are available yet."}
        </Text>
      ) : (
        <>
          <View style={styles.table}>
            <View style={[styles.row, styles.tableHeader]}>
              <Text style={[styles.cell, styles.heading]}>Origin</Text>
              <Text style={[styles.cell, styles.heading]}>Destination</Text>
              <Text style={[styles.priceCell, styles.heading]}>Freight</Text>
              <Text style={[styles.cell, styles.heading]}>Capacity</Text>
            </View>
            {routes.map((route) => (
              <View key={route.id} style={styles.row}>
                <Text style={styles.cell}>{route.originName}</Text>
                <Text style={styles.cell}>{route.destinationName}</Text>
                <View style={styles.priceCell}>
                  <Text
                    style={[
                      styles.price,
                      route.priceLow === null && styles.expired,
                    ]}
                  >
                    {priceLabel(route.priceLow, route.priceHigh)}
                  </Text>
                  <Text style={styles.unit}>{unitLabel(route.unit)}</Text>
                </View>
                <Text style={[styles.cell, styles.capacity]}>
                  {route.truckCapacity ?? "—"}
                </Text>
              </View>
            ))}
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {canLoadMore ? (
            <Button
              title={isLoadingMore ? "Loading…" : "Load more routes"}
              variant="secondary"
              onPress={loadMore}
              loading={isLoadingMore}
              disabled={isLoadingMore}
            />
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleBlock: {
    gap: 2,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: colors.muted,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
  },
  search: {
    minHeight: 46,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.text,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.card,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 54,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tableHeader: {
    minHeight: 42,
    backgroundColor: colors.surface,
  },
  cell: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.xs,
    color: colors.text,
    fontSize: 12.5,
  },
  heading: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  city: {
    color: colors.text,
    fontSize: 12.5,
  },
  capacity: {
    color: colors.muted,
    fontSize: 10,
  },
  priceCell: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-end",
    paddingHorizontal: spacing.xs,
  },
  price: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  expired: {
    color: colors.muted,
    fontWeight: "500",
  },
  unit: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 9,
    textAlign: "right",
  },
  center: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
  },
  empty: {
    paddingVertical: spacing.xl,
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
  },
});
