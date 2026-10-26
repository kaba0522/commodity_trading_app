import { CategoryChips } from "@/components/common/CategoryChips";
import { ListingRow } from "@/components/common/ListingRow";
import { ModeToggle } from "@/components/common/ModeToggle";
import { Button } from "@/components/ui/Button";
import { useBrowse } from "@/features/buyer/browse/hooks/useBrowse";
import type { BrowseRow } from "@/features/buyer/browse/hooks/useBrowse";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
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
          <Text style={styles.eyebrow}>Buyer view</Text>
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
          {groups.map((group) => (
            <View key={group.key} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>
                  {group.category} · {group.item}
                </Text>
                <Text style={styles.groupMeta}>{group.weight} bag</Text>
              </View>
              {group.rows.map((row) => (
                <ListingRow
                  key={row.id}
                  qualityBadge={row.qualityText}
                  title={row.seller}
                  subtitle={`${row.qualityText} · ${row.weight}`}
                  price={row.priceText}
                  onPress={() => openListing(row)}
                />
              ))}
            </View>
          ))}
          {groups.length === 0 ? (
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
              <View key={sg.seller} style={styles.group}>
                <Pressable
                  style={styles.sellerHeader}
                  onPress={() => toggleSeller(sg.seller)}
                  accessibilityRole="button"
                  accessibilityLabel={sg.seller}
                >
                  <Text style={styles.sellerName} numberOfLines={1}>
                    {sg.seller}
                  </Text>
                  <Text style={styles.chevron}>{isCollapsed ? "›" : "⌄"}</Text>
                </Pressable>
                {isCollapsed
                  ? null
                  : sg.itemGroups.map((group) => (
                      <View key={group.key} style={styles.subGroup}>
                        <View style={styles.groupHeader}>
                          <Text style={styles.groupTitle}>
                            {group.category} · {group.item}
                          </Text>
                          <Text style={styles.groupMeta}>
                            {group.weight} bag
                          </Text>
                        </View>
                        {group.rows.map((row) => (
                          <ListingRow
                            key={row.id}
                            qualityBadge={row.qualityText}
                            title={row.item}
                            subtitle={`${row.qualityText} · ${row.weight}`}
                            price={row.priceText}
                            onPress={() => openListing(row)}
                          />
                        ))}
                      </View>
                    ))}
              </View>
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
    gap: spacing.sm,
  },
  subGroup: {
    gap: spacing.sm,
    paddingLeft: spacing.xs,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  groupMeta: {
    fontSize: 12.5,
    color: colors.muted,
  },
  sellerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primaryTint,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sellerName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  chevron: {
    fontSize: 16,
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
