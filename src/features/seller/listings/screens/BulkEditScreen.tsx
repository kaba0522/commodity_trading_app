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
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Seller bulk price edit (`isBulk` in Seller App.html): checkbox rows,
 * −50/+50/custom deltas for active listings (delta mode) and absolute
 * prices for expired listings (set-many mode, reactivates them),
 * saved via `PATCH /listings/bulk-price`.
 */
export function BulkEditScreen() {
  const insets = useSafeAreaInsets();
  const {
    rows,
    activeRows,
    expiredRows,
    selected,
    selectedCount,
    selectedActiveCount,
    selectedExpiredCount,
    bulkAmount,
    setBulkAmount,
    expiredPrices,
    setExpiredPrice,
    setManyReady,
    toggleSelect,
    selectAll,
    clear,
    applyDelta,
    applyTypedAmount,
    shiftExpiredDrafts,
    applyExpiredTypedAmount,
    applySetMany,
    isLoading,
    isSaving,
    error,
    saveError,
    retry,
  } = useBulkEdit();
  const visibleRows = [...activeRows, ...expiredRows];
  const visibleSelectableIds = rows.map((row) => row.id);

  return (
    <View style={[styles.safe, { paddingTop: insets.top + spacing.md }]}>
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
          {visibleRows.map((row) => {
            const isSelected = selected.includes(row.id);
            if (!row.active) {
              const draft = expiredPrices[row.id] ?? "";
              return (
                <View key={row.id} style={styles.row}>
                  <Pressable
                    style={[styles.box, isSelected && styles.boxChecked]}
                    onPress={() => toggleSelect(row.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`Select ${row.item}`}
                  >
                    {isSelected ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {row.item}
                    </Text>
                    <Text style={styles.muted} numberOfLines={1}>
                      {row.category} · {row.weight} · Expired ·{" "}
                      {row.price === null ? "N/A" : priceLabel(row.price)}
                    </Text>
                  </View>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="New ₹"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    value={draft}
                    onChangeText={(v) => setExpiredPrice(row.id, v)}
                    accessibilityLabel={`New price for ${row.item}`}
                  />
                </View>
              );
            }
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
                  <Text style={styles.muted} numberOfLines={1}>
                    {row.category} · {row.weight} · Active
                  </Text>
                </View>
                <Text style={styles.rowPrice}>
                  {row.price === null ? "N/A" : priceLabel(row.price)}
                </Text>
              </Pressable>
            );
          })}
          {visibleRows.length === 0 ? (
            <Text style={styles.note}>No listings to edit.</Text>
          ) : (
            <Text style={styles.note}>
              Select active listings to adjust prices. Enter a price for
              expired listings to reactivate them.
            </Text>
          )}
        </ScrollView>
      )}

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}
      >
        {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
        {selectedActiveCount > 0 ? (
          <>
            <View style={styles.deltaRow}>
              <View style={styles.selectFlex}>
                <Button
                  title="− 50"
                  variant="secondary"
                  disabled={selectedActiveCount === 0 || isSaving}
                  loading={false}
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
              />
              <View style={styles.applyButton}>
                <Button
                  title={isSaving ? "Saving…" : "Apply"}
                  disabled={selectedActiveCount === 0 || isSaving}
                  onPress={applyTypedAmount}
                />
              </View>
            </View>
          </>
        ) : null}
        {selectedExpiredCount > 0 ? (
          <>
            <View style={styles.deltaRow}>
              <View style={styles.selectFlex}>
                <Button
                  title="− 50"
                  variant="secondary"
                  disabled={selectedExpiredCount === 0 || isSaving}
                  loading={false}
                  onPress={() => shiftExpiredDrafts(-50)}
                />
              </View>
              <View style={styles.selectFlex}>
                <Button
                  title="+ 50"
                  variant="secondary"
                  disabled={selectedExpiredCount === 0 || isSaving}
                  onPress={() => shiftExpiredDrafts(50)}
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
              />
              <View style={styles.applyButton}>
                <Button
                  title="Apply"
                  disabled={selectedExpiredCount === 0 || isSaving}
                  onPress={applyExpiredTypedAmount}
                />
              </View>
            </View>
            <Button
              title={
                isSaving
                  ? "Saving…"
                  : selectedExpiredCount === 0
                    ? "Set prices"
                    : `Set prices (${selectedExpiredCount})`
              }
              disabled={!setManyReady || isSaving}
              loading={isSaving}
              onPress={applySetMany}
            />
          </>
        ) : null}
        {selectedCount === 0 ? (
          <Text style={styles.muted}>Select listings to edit prices.</Text>
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
  priceInput: {
    width: 110,
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    textAlign: "right",
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
