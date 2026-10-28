import { CategoryChips } from "@/components/common/CategoryChips";
import { ChevronIcon } from "@/components/common/ChevronIcon";
import { ExpandableGroupCard } from "@/components/common/ExpandableGroupCard";
import { ModeToggle } from "@/components/common/ModeToggle";
import { Button } from "@/components/ui/Button";
import type { BrowseRow } from "@/features/buyer/browse/hooks/useBrowse";
import { useBrowse } from "@/features/buyer/browse/hooks/useBrowse";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo } from "react";
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

/** Buyer Browse (`isBrowse` in Buyer App.html): By Commodity / By Seller, rows open detail next slice. */
export function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const { seller: sellerParam } = useLocalSearchParams<{ seller?: string }>();
  const {
    categories,
    mode,
    setMode,
    category,
    setCategory,
    sellerSearch,
    setSellerSearch,
    groups,
    sellerGroups,
    sellerListingCounts,
    collapsed,
    toggleSeller,
    isLoading,
    error,
    retry,
  } = useBrowse();

  const categoryGroups = useMemo(() => {
    const grouped = new Map<string, BrowseRow[]>();
    for (const itemGroup of groups) {
      const rows = grouped.get(itemGroup.category) ?? [];
      grouped.set(itemGroup.category, [...rows, ...itemGroup.rows]);
    }
    return [...grouped].map(([categoryName, rows]) => ({
      category: categoryName,
      rows,
    }));
  }, [groups]);

  // Deep-link from listing detail ("View all listings from X"): switch to
  // By Seller + filter.
  useEffect(() => {
    if (typeof sellerParam === "string" && sellerParam.trim()) {
      setMode("seller");
      setSellerSearch(sellerParam);
    }
  }, [sellerParam, setMode, setSellerSearch]);

  function openListing(row: BrowseRow) {
    router.push({
      pathname: "/browse/[id]",
      params: {
        id: String(row.id),
        category: row.category,
        item: row.item,
        quality: row.quality,
        weight: row.weight,
        seller: row.seller,
        price: String(row.price),
        bags: String(row.bags ?? ""),
        paymentTerms:
          row.paymentTerms !== null && row.paymentTerms !== undefined
            ? String(row.paymentTerms)
            : "",
        priceValidUntil: row.priceValidUntil ?? "",
        sellerListingCount: String(sellerListingCounts[row.seller] ?? 1),
      },
    });
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.md },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          {/* <Text style={styles.eyebrow}>Buyer view</Text> */}
          <Text style={styles.title}>Today&apos;s market</Text>
        </View>
      </View>
      <ModeToggle
        first="By Commodity"
        second="By Seller"
        value={mode === "commodity" ? "first" : "second"}
        onChange={(v) => setMode(v === "first" ? "commodity" : "seller")}
      />

      {mode === "commodity" ? (
        <CategoryChips
          values={categories}
          value={category}
          onChange={setCategory}
        />
      ) : (
        <TextInput
          style={styles.search}
          placeholder="Search seller name"
          placeholderTextColor={colors.muted}
          value={sellerSearch}
          onChangeText={setSellerSearch}
        />
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Loading live listings…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" variant="secondary" onPress={retry} />
        </View>
      ) : mode === "commodity" ? (
        <View style={styles.stack}>
          {categoryGroups.map((group) => (
            <View key={group.category} style={styles.group}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryTitle}>{group.category}</Text>
              </View>
              <View style={styles.categoryBody}>
                {group.rows.map((row, index) => (
                  <Pressable
                    key={row.id}
                    style={[
                      styles.commodityRow,
                      index > 0 && styles.commodityRowDivider,
                    ]}
                    onPress={() => openListing(row)}
                    accessibilityRole="button"
                    accessibilityLabel={`${row.item}, ${row.seller}, ${row.priceText} per bag`}
                  >
                    <View style={styles.commodityBadge}>
                      <Text style={styles.commodityBadgeText} numberOfLines={2}>
                        {row.item}
                      </Text>
                    </View>
                    <View style={styles.commodityInfo}>
                      <Text style={styles.commoditySeller} numberOfLines={1}>
                        {row.seller}
                      </Text>
                      <Text style={styles.commodityMeta} numberOfLines={1}>
                        {row.qualityText}
                        {row.bags != null
                          ? ` · ${row.bags} bags`
                          : row.weight
                            ? ` · ${row.weight}`
                            : ""}
                      </Text>
                    </View>
                    <View style={styles.commodityPrice}>
                      <Text style={styles.commodityPriceText} numberOfLines={1}>
                        {row.priceText}
                      </Text>
                      <Text style={styles.commodityPriceCaption}>per bag</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          {categoryGroups.length === 0 ? (
            <Text style={styles.empty}>
              No live listings in this category yet.
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.stack}>
          {sellerGroups.map((sg) => {
            const isCollapsed = collapsed.includes(sg.seller);
            return (
              <ExpandableGroupCard
                key={sg.seller}
                title={sg.seller}
                expanded={!isCollapsed}
                onToggle={() => toggleSeller(sg.seller)}
              >
                {sg.itemGroups.flatMap((group) =>
                  group.rows.map((row, index) => {
                    const isLast =
                      group === sg.itemGroups[sg.itemGroups.length - 1] &&
                      index === group.rows.length - 1;
                    return (
                      <Pressable
                        key={row.id}
                        style={[
                          styles.sellerListingRow,
                          !isLast && styles.sellerListingRowBorder,
                        ]}
                        onPress={() => openListing(row)}
                        accessibilityRole="button"
                        accessibilityLabel={`${row.category} ${row.item}, ${row.priceText} per bag`}
                      >
                        <View style={styles.sellerListingInfo}>
                          <Text
                            style={styles.sellerListingTitle}
                            numberOfLines={1}
                          >
                            {row.category} · {row.item} · {row.qualityText}
                          </Text>
                          <Text style={styles.sellerListingMeta}>
                            {row.bags != null ? `${row.bags} bags` : row.weight}
                          </Text>
                        </View>
                        <Text style={styles.sellerListingPrice}>
                          {row.priceText}
                        </Text>
                        <ChevronIcon />
                      </Pressable>
                    );
                  }),
                )}
              </ExpandableGroupCard>
            );
          })}
          {sellerGroups.length === 0 ? (
            <Text style={styles.empty}>No sellers match that name.</Text>
          ) : null}
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
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  titleBlock: {
    gap: 2,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.muted,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  search: {
    backgroundColor: colors.searchBg,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  stack: {
    gap: spacing.lg,
  },
  group: {
    marginTop: 2,
  },
  categoryHeader: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  categoryTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.text,
  },
  categoryBody: {
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  commodityRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 68,
    backgroundColor: colors.background,
  },
  commodityRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  commodityBadge: {
    width: 64,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryTint,
    padding: 4,
  },
  commodityBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 13,
    textAlign: "center",
    color: colors.primaryDark,
  },
  commodityInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 2,
    paddingVertical: 8,
    paddingLeft: 12,
  },
  commoditySeller: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  commodityMeta: {
    fontSize: 11,
    color: colors.muted,
  },
  commodityPrice: {
    minWidth: 96,
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  commodityPriceText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  commodityPriceCaption: {
    fontSize: 10,
    color: colors.muted,
  },
  sellerListingRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
  },
  sellerListingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sellerListingInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sellerListingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  sellerListingMeta: {
    fontSize: 11,
    color: colors.muted,
  },
  sellerListingPrice: {
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.primaryTint,
    fontSize: 14,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  empty: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    paddingVertical: spacing.md,
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
});
