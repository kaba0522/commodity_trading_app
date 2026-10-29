import { CategoryChips } from "@/components/common/CategoryChips";
import { ChevronIcon } from "@/components/common/ChevronIcon";
import { ExpandableGroupCard } from "@/components/common/ExpandableGroupCard";
import { ModeToggle } from "@/components/common/ModeToggle";
import { Button } from "@/components/ui/Button";
import { bagsLabel } from "@/core/utils/format";
import { useRequirementsBrowse } from "@/features/buyer/requirements/hooks/useRequirementsBrowse";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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

/** Seller Browse (`isRequirements` in Seller App.html): buyer requirements, By Commodity / By Buyer. */
export function RequirementsBrowseScreen() {
  const insets = useSafeAreaInsets();
  const { buyer: buyerParam } = useLocalSearchParams<{ buyer?: string }>();
  const {
    mode,
    setMode,
    buyerSearch,
    setBuyerSearch,
    rows,
    categories,
    buyerGroups,
    collapsed,
    toggleBuyer,
    isLoading,
    error,
    retry,
  } = useRequirementsBrowse();
  const [category, setCategory] = useState("All");
  const categoryValues = useMemo(() => ["All", ...categories], [categories]);
  const filteredRows = useMemo(
    () =>
      category === "All"
        ? rows
        : rows.filter((row) => row.category === category),
    [category, rows],
  );
  const commodityGroups = useMemo(() => {
    const groups = new Map<string, typeof rows>();
    for (const row of filteredRows) {
      const group = groups.get(row.category) ?? [];
      group.push(row);
      groups.set(row.category, group);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredRows]);

  // Deep-link from requirement detail ("View all requirements from X",
  // `buyerRequirements` screen in Seller App.html): switch to By Buyer + filter.
  useEffect(() => {
    if (typeof buyerParam === "string" && buyerParam.trim()) {
      setMode("buyer");
      setBuyerSearch(buyerParam);
    }
  }, [buyerParam, setBuyerSearch, setMode]);

  function openRequirement(row: (typeof rows)[number]) {
    router.push({
      pathname: "/requirements/[id]",
      params: {
        id: String(row.id),
        category: row.category,
        item: row.item,
        buyer: row.buyer,
        bags: String(row.bags),
        targetPrice: String(row.targetPrice),
        paymentTerms: row.paymentTerms,
        quality: row.quality ?? "",
        weightKg: row.weightKg != null ? String(row.weightKg) : "",
        location: row.location ?? "",
        notes: row.notes ?? "",
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
      <Text style={styles.title}>Buyer Requirements</Text>
      <Text style={styles.subtitle}>
        Buyers looking to buy — offer to sell to them directly.
      </Text>
      <ModeToggle
        first="By Commodity"
        second="By Buyer"
        value={mode === "commodity" ? "first" : "second"}
        onChange={(v) => setMode(v === "first" ? "commodity" : "buyer")}
      />

      {mode === "commodity" ? (
        <CategoryChips
          values={categoryValues}
          value={category}
          onChange={setCategory}
        />
      ) : (
        <TextInput
          style={styles.search}
          placeholder="Search buyer name"
          placeholderTextColor={colors.muted}
          value={buyerSearch}
          onChangeText={setBuyerSearch}
        />
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Loading buyer requirements…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{String(error)}</Text>
          <Button title="Retry" variant="secondary" onPress={retry} />
        </View>
      ) : mode === "commodity" ? (
        <View style={styles.stack}>
          {commodityGroups.map(([groupCategory, groupRows]) => (
            <View key={groupCategory} style={styles.group}>
              <Text style={styles.groupTitle}>{groupCategory}</Text>
              <View style={styles.requirementList}>
                {groupRows.map((row, index) => (
                  <Pressable
                    key={row.id}
                    style={[
                      styles.requirementRow,
                      index === groupRows.length - 1 && styles.lastRow,
                    ]}
                    onPress={() => openRequirement(row)}
                    accessibilityRole="button"
                    accessibilityLabel={`${row.item} requirement from ${row.buyer}, ${bagsLabel(row.bags)}`}
                  >
                    <View style={styles.itemBadge}>
                      <Text style={styles.itemBadgeText} numberOfLines={2}>
                        {row.item}
                      </Text>
                    </View>
                    <View style={styles.requirementInfo}>
                      <Text style={styles.buyerName} numberOfLines={1}>
                        {row.buyer}
                      </Text>
                      <View style={styles.requirementMetaRow}>
                        {row.quality ? (
                          <Text
                            style={styles.requirementMeta}
                            numberOfLines={1}
                          >
                            Quality grade: {row.quality.replace(/_/g, " ")}
                          </Text>
                        ) : null}
                        <Text style={styles.requirementMeta}>
                          {bagsLabel(row.bags)}
                        </Text>
                      </View>
                    </View>
                    <ChevronIcon />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          {filteredRows.length === 0 ? (
            <Text style={styles.empty}>
              No buyer requirements in this category yet.
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.stack}>
          {buyerGroups.map((bg) => {
            const isCollapsed = collapsed.includes(bg.buyer);
            return (
              <ExpandableGroupCard
                key={bg.buyer}
                title={bg.buyer}
                expanded={!isCollapsed}
                onToggle={() => toggleBuyer(bg.buyer)}
              >
                {bg.rows.map((row, index) => (
                  <Pressable
                    key={row.id}
                    style={[
                      styles.buyerRequirementRow,
                      index < bg.rows.length - 1 &&
                        styles.buyerRequirementRowBorder,
                    ]}
                    onPress={() => openRequirement(row)}
                    accessibilityRole="button"
                    accessibilityLabel={`${row.category} ${row.item}, ${bagsLabel(row.bags)}`}
                  >
                    <View style={styles.buyerRequirementInfo}>
                      <Text
                        style={styles.buyerRequirementTitle}
                        numberOfLines={1}
                      >
                        {row.category} · {row.item}
                      </Text>
                      <View style={styles.requirementMetaRow}>
                        {row.quality ? (
                          <Text
                            style={styles.requirementMeta}
                            numberOfLines={1}
                          >
                            Quality grade: {row.quality.replace(/_/g, " ")}
                          </Text>
                        ) : null}
                        <Text style={styles.requirementMeta}>
                          {bagsLabel(row.bags)}
                        </Text>
                      </View>
                    </View>
                    <ChevronIcon />
                  </Pressable>
                ))}
              </ExpandableGroupCard>
            );
          })}
          {buyerGroups.length === 0 ? (
            <Text style={styles.empty}>No buyers match that name.</Text>
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
  title: {
    fontSize: 21,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: -spacing.sm,
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
  groupTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  requirementList: {
    overflow: "hidden",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  requirementRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  itemBadge: {
    alignSelf: "stretch",
    width: 72,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.primaryTint,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  itemBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    color: colors.primaryDark,
  },
  requirementInfo: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.md,
    gap: 3,
  },
  buyerName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  requirementMeta: {
    fontSize: 11,
    color: colors.muted,
  },
  requirementMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  buyerRequirementRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
  },
  buyerRequirementRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  buyerRequirementInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  buyerRequirementTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  buyerRequirementMeta: {
    fontSize: 11,
    color: colors.muted,
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
