import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/common/BackButton";
import { useBulkEdit } from "@/features/seller/listings/hooks/useBulkEdit";
import { priceLabel } from "@/core/utils/format";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

/**
 * Seller bulk price edit (`isBulk` in Seller App.html) for live listings.
 */
export function BulkEditScreen() {
  const {
    activeRows,
    selected,
    selectedCount,
    selectedActiveCount,
    bulkAmount,
    setBulkAmount,
    toggleSelect,
    selectAll,
    clear,
    applyDelta,
    applyTypedAmount,
    isLoading,
    isSaving,
    error,
    saveError,
    retry,
  } = useBulkEdit();
  const visibleSelectableIds = activeRows.map((row) => row.id);

  return (
    <View style={[styles.safe, { paddingTop: spacing.md }]}>
      <View style={styles.head}>
        <BackButton fallback="/add-listing" />
        <Text style={styles.title}>Bulk edit prices</Text>
        <View style={styles.selectRow}>
          <View style={styles.selectButtons}>
            <View style={styles.selectFlex}>
              <Button
                title="Select all"
                variant="secondary"
                onPress={() => selectAll(visibleSelectableIds)}
              />
            </View>
            <View style={styles.selectFlex}>
              <Button title="Clear" variant="secondary" onPress={clear} />
            </View>
          </View>
          <Text style={styles.muted}>{selectedCount} selected</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.muted}>Loading listings…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" variant="secondary" onPress={retry} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {activeRows.map((row) => {
            const isSelected = selected.includes(row.id);
            return (
              <Pressable
                key={row.id}
                style={styles.row}
                onPress={() => toggleSelect(row.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`${row.item} ${row.price === null ? "no price" : priceLabel(row.price)}`}
              >
                <View
                  style={[styles.box, isSelected && styles.boxChecked]}
                >
                  {isSelected ? <Text style={styles.check}>✓</Text> : null}
                </View>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {row.item}
                  </Text>
                  <Text style={styles.muted} numberOfLines={2}>
                    {row.category} · {row.quality || "Quality not specified"} ·{" "}
                    {row.bags ?? "—"} {row.bags === 1 ? "bag" : "bags"}
                  </Text>
                </View>
                <Text style={styles.rowPrice}>
                  {row.price === null ? "N/A" : priceLabel(row.price)}
                </Text>
              </Pressable>
            );
          })}
          {activeRows.length === 0 ? (
            <Text style={styles.note}>No live listings to edit.</Text>
          ) : (
            <Text style={styles.note}>
              Select live listings to adjust their prices.
            </Text>
          )}
        </ScrollView>
      )}

      <View
        style={[styles.footer, { paddingBottom: spacing.md }]}
      >
        {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
        <View style={styles.deltaRow}>
          <View style={styles.selectFlex}>
            <Button
              title="− 50"
              variant="secondary"
              disabled={selectedActiveCount === 0 || isSaving}
              onPress={() => applyDelta(-50)}
            />
          </View>
          <View style={styles.selectFlex}>
            <Button
              title="+ 50"
              variant="secondary"
              disabled={selectedActiveCount === 0 || isSaving}
              onPress={() => applyDelta(50)}
            />
          </View>
        </View>
        <View style={styles.deltaRow}>
          <TextInput
            style={[styles.input, styles.amountInput]}
            placeholder="Custom amount, e.g. -25"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            value={bulkAmount}
            onChangeText={setBulkAmount}
            editable={!isSaving}
          />
          <View style={styles.applyButton}>
            <Button
              title={isSaving ? "Saving…" : "Apply"}
              disabled={selectedActiveCount === 0 || isSaving}
              onPress={applyTypedAmount}
            />
          </View>
        </View>
        {selectedCount === 0 ? (
          <Text style={styles.muted}>Select live listings to edit prices.</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  head: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  selectButtons: {
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
  },
  selectFlex: {
    flex: 1,
  },
  muted: {
    fontSize: 12,
    color: colors.muted,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    textAlign: "center",
  },
  list: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  boxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  check: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onPrimary,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  rowPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    flexShrink: 0,
  },
  note: {
    fontSize: 12.5,
    color: colors.muted,
    textAlign: "center",
    paddingVertical: 4,
  },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  deltaRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },
  amountInput: {
    flex: 1,
  },
  applyButton: {
    minWidth: 110,
  },
});
