import { Button } from "@/components/ui/Button";
import { useSellerHome, type HomeFilter, type HomeRow } from "@/features/seller/home/hooks/useSellerHome";
import { bagsLabel, priceLabel } from "@/core/utils/format";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface CategoryGroup {
  category: string;
  rows: HomeRow[];
}

/**
 * Seller home (`isHome` in Seller App.html → "My Listings"): expiry countdown,
 * Live / Needs-price filters, listings grouped by category with an inline
 * rate sheet on the price, Bulk edit in the header and an add-listing FAB.
 */
export function SellerHomeScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<HomeFilter>(null);
  const [rateTarget, setRateTarget] = useState<HomeRow | null>(null);
  const [draft, setDraft] = useState("");
  const {
    rows,
    liveCount,
    needsCount,
    allPriced,
    expired,
    expiryLabel,
    isLoading,
    error,
    retry,
    savingId,
    savedId,
    saveError,
    savePrice,
    clearSaveError,
  } = useSellerHome();

  // Prototype `homeFilter`: a "needs" filter that just became empty clears itself.
  const activeFilter: HomeFilter = needsCount === 0 && filter === "needs" ? null : filter;
  const visibleRows = useMemo(
    () =>
      activeFilter === "live"
        ? rows.filter((r) => r.price !== null)
        : activeFilter === "needs"
          ? rows.filter((r) => r.price === null)
          : rows,
    [rows, activeFilter],
  );

  const groups = useMemo<CategoryGroup[]>(() => {
    const out: CategoryGroup[] = [];
    for (const row of visibleRows) {
      let group = out.find((g) => g.category === row.category);
      if (!group) {
        group = { category: row.category, rows: [] };
        out.push(group);
      }
      group.rows.push(row);
    }
    return out;
  }, [visibleRows]);

  function openListing(row: HomeRow) {
    router.push({ pathname: "/listing/[id]", params: { id: row.id } });
  }

  function openRateSheet(row: HomeRow) {
    clearSaveError();
    setRateTarget(row);
    setDraft(row.price !== null ? String(row.price) : "");
  }

  function closeRateSheet() {
    setRateTarget(null);
    setDraft("");
    clearSaveError();
  }

  async function handleSaveRate() {
    if (!rateTarget) return;
    const value = Number(draft);
    if (!Number.isFinite(value) || value <= 0) return;
    const ok = await savePrice(rateTarget.id, value);
    if (ok) {
      setRateTarget(null);
      setDraft("");
    }
  }

  const rateValue = Number(draft);
  const saveDisabled =
    !draft.trim() || !Number.isFinite(rateValue) || rateValue <= 0 || savingId !== null;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
              My Listings
            </Text>
            <View
              style={[
                styles.tag,
                expired ? styles.tagExpired : styles.tagLive,
              ]}
            >
              <Text
                style={[
                  styles.tagText,
                  expired ? styles.tagTextExpired : null,
                ]}
              >
                {expiryLabel}
              </Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.bulkButton,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/bulk-edit")}
            accessibilityRole="button"
            accessibilityLabel="Bulk edit prices"
          >
            <Text style={styles.bulkButtonText}>Bulk edit</Text>
          </Pressable>
        </View>

        {expired ? (
          <View style={styles.expiredCard}>
            <Text style={styles.expiredTitle}>Prices cleared at 2:00 AM</Text>
            <Text style={styles.expiredBody}>
              Yesterday&apos;s listings are kept, just waiting on fresh prices
              for today.
            </Text>
            <View style={styles.expiredAction}>
              <Button
                title="Add today's prices"
                onPress={() => router.push("/bulk-edit")}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.filters}>
          <Pressable
            style={[
              styles.filterCard,
              activeFilter === "live" && styles.filterCardLive,
            ]}
            onPress={() =>
              setFilter((f) => (f === "live" ? null : "live"))
            }
            accessibilityRole="button"
            accessibilityState={{ selected: activeFilter === "live" }}
            accessibilityLabel={`Show live listings, ${liveCount}`}
          >
            <Text
              style={[
                styles.filterCount,
                activeFilter === "live" && styles.filterTextOn,
              ]}
            >
              {liveCount}
            </Text>
            <Text
              style={[
                styles.filterLabel,
                activeFilter === "live" && styles.filterTextOn,
              ]}
            >
              Live
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filterCard,
              styles.filterCardNeeds,
              allPriced && styles.filterCardAllPriced,
              activeFilter === "needs" && styles.filterCardNeedsOn,
            ]}
            onPress={() =>
              setFilter((f) => (f === "needs" ? null : "needs"))
            }
            disabled={allPriced}
            accessibilityRole="button"
            accessibilityState={{ selected: activeFilter === "needs" }}
            accessibilityLabel={
              allPriced
                ? "All listings are priced"
                : `Show listings needing a price, ${needsCount}`
            }
          >
            <Text
              style={[
                styles.filterCount,
                styles.filterNeedsText,
                allPriced && styles.filterAllPricedText,
                activeFilter === "needs" && styles.filterTextOn,
              ]}
            >
              {needsCount}
            </Text>
            <Text
              style={[
                styles.filterLabel,
                styles.filterNeedsText,
                allPriced && styles.filterAllPricedText,
                activeFilter === "needs" && styles.filterTextOn,
              ]}
              numberOfLines={1}
            >
              {allPriced ? "All priced ✓" : "Needs price"}
            </Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.centerText}>Loading your listings…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <Button title="Retry" variant="secondary" onPress={retry} />
          </View>
        ) : (
          <>
            {groups.map((group) => (
              <View key={group.category} style={styles.group}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{group.category}</Text>
                </View>
                <View style={styles.groupBody}>
                  {group.rows.map((row, i) => (
                    <View
                      key={row.id}
                      style={[styles.row, i > 0 && styles.rowDivider]}
                    >
                      <View style={styles.rowBadge}>
                        <Text style={styles.rowBadgeText} numberOfLines={2}>
                          {row.item}
                        </Text>
                      </View>
                      <Pressable
                        style={styles.rowMain}
                        onPress={() => openListing(row)}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${row.item}`}
                      >
                        <Text style={styles.rowQuality} numberOfLines={1}>
                          {(row.quality || "Standard").replace(/_/g, " ")}
                        </Text>
                        {row.bags > 0 ? (
                          <Text style={styles.rowBags}>
                            {bagsLabel(row.bags)}
                          </Text>
                        ) : null}
                      </Pressable>
                      <Pressable
                        style={styles.rowPrice}
                        onPress={() => openRateSheet(row)}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit rate for ${row.item}`}
                      >
                        <Text
                          style={[
                            styles.priceText,
                            row.price === null && styles.priceNeeds,
                          ]}
                        >
                          {row.price === null ? "Add Rate" : priceLabel(row.price)}
                        </Text>
                        {row.price === null ? (
                          <Text style={styles.priceHint}>to Make it Live</Text>
                        ) : null}
                        {savedId === row.id ? (
                          <Text style={styles.savedHint}>✓ Saved</Text>
                        ) : null}
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ))}

            {visibleRows.length === 0 ? (
              <Text style={styles.empty}>
                {rows.length === 0
                  ? "No listings yet — tap + to add your first one."
                  : "Nothing here right now."}
              </Text>
            ) : null}
          </>
        )}

        <View style={styles.moreRow}>
          <Pressable
            onPress={() => router.push("/scan")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Scan a price sheet"
          >
            <Text style={styles.moreLink}>Scan sheet</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/bulk-upload")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Bulk upload a spreadsheet"
          >
            <Text style={styles.moreLink}>Bulk upload (.xlsx)</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
        onPress={() => router.push("/add-listing-form")}
        accessibilityRole="button"
        accessibilityLabel="Add listing"
      >
        <Text style={styles.fabPlus}>+</Text>
      </Pressable>

      <Modal
        visible={rateTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeRateSheet}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdrop}
            onPress={closeRateSheet}
            accessibilityRole="button"
            accessibilityLabel="Close rate editor"
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View
              style={[
                styles.sheet,
                { paddingBottom: insets.bottom + spacing.lg },
              ]}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHead}>
                <View style={styles.sheetTitleBlock}>
                  <Text style={styles.sheetKicker} numberOfLines={1}>
                    {rateTarget?.category} · {rateTarget?.weight} bag
                  </Text>
                  <Text style={styles.sheetTitle} numberOfLines={1}>
                    {rateTarget?.item}
                  </Text>
                </View>
                <Pressable
                  onPress={closeRateSheet}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel rate edit"
                >
                  <Text style={styles.sheetCancel}>Cancel</Text>
                </Pressable>
              </View>

              <View style={styles.amountBox}>
                <Text style={styles.currency}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  value={draft}
                  onChangeText={(v) => setDraft(v.replace(/[^\d]/g, "").slice(0, 7))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  maxLength={7}
                  autoFocus
                  accessibilityLabel="Price per bag"
                />
                <Text style={styles.perBag}>per bag</Text>
              </View>

              {saveError ? (
                <Text style={styles.errorText}>{saveError}</Text>
              ) : null}

              <Pressable
                style={[
                  styles.saveButton,
                  saveDisabled && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveRate}
                disabled={saveDisabled}
                accessibilityRole="button"
                accessibilityLabel="Save rate"
                accessibilityState={{ disabled: saveDisabled }}
              >
                <Text style={styles.saveButtonText}>
                  {savingId !== null ? "Saving…" : "Save Rate"}
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },
  tag: {
    alignSelf: "flex-start",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagLive: {
    backgroundColor: colors.accent2Tint,
  },
  tagExpired: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tagText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accent2Dark,
  },
  tagTextExpired: {
    color: colors.primary,
  },
  bulkButton: {
    flexShrink: 0,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bulkButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  pressed: {
    opacity: 0.7,
  },
  expiredCard: {
    gap: spacing.sm,
    backgroundColor: colors.primaryTint,
    borderRadius: 16,
    padding: spacing.md,
  },
  expiredTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.primaryDark,
  },
  expiredBody: {
    fontSize: 13.5,
    color: colors.text,
  },
  expiredAction: {
    alignSelf: "flex-start",
  },
  filters: {
    flexDirection: "row",
    gap: 10,
  },
  filterCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterCardLive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  filterCardNeeds: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
  },
  filterCardNeedsOn: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  filterCardAllPriced: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  filterCount: {
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 26,
    color: colors.text,
  },
  filterLabel: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 14,
    color: colors.text,
  },
  filterNeedsText: {
    color: colors.danger,
  },
  filterAllPricedText: {
    color: colors.success,
  },
  filterTextOn: {
    color: colors.onPrimary,
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
    fontSize: 13,
    color: colors.danger,
    textAlign: "center",
  },
  group: {
    marginTop: 2,
  },
  groupHeader: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  groupTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.text,
  },
  groupBody: {
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 68,
    backgroundColor: colors.background,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowBadge: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryTint,
    padding: 4,
  },
  rowBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 13,
    textAlign: "center",
    color: colors.primaryDark,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 2,
    paddingVertical: 8,
    paddingLeft: 12,
  },
  rowQuality: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    textTransform: "capitalize",
  },
  rowBags: {
    fontSize: 11,
    color: colors.muted,
  },
  rowPrice: {
    minWidth: 100,
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  priceText: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 21,
    color: colors.text,
    textDecorationLine: "underline",
    textDecorationStyle: "dotted",
  },
  priceNeeds: {
    color: colors.danger,
  },
  priceHint: {
    fontSize: 10.5,
    fontWeight: "500",
    color: colors.muted,
  },
  savedHint: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.success,
  },
  empty: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    paddingVertical: 20,
  },
  moreRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  moreLink: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
  },
  fabPlus: {
    fontSize: 32,
    fontWeight: "300",
    lineHeight: 34,
    marginTop: -2,
    color: colors.onPrimary,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(32,30,29,0.45)",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 14,
    paddingHorizontal: 20,
    gap: 14,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    alignSelf: "center",
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  sheetTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  sheetKicker: {
    fontSize: 13,
    color: colors.muted,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  sheetCancel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    paddingVertical: 6,
  },
  amountBox: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 6,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  currency: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.text,
  },
  amountInput: {
    minWidth: 60,
    padding: 0,
    fontSize: 38,
    fontWeight: "700",
    textAlign: "center",
    color: colors.text,
  },
  perBag: {
    fontSize: 14,
    color: colors.muted,
  },
  saveButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.onPrimary,
  },
});
