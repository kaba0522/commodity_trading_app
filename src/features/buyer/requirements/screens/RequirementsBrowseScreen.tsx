import { CategoryChips } from "@/components/common/CategoryChips";
import { ListingRow } from "@/components/common/ListingRow";
import { ModeToggle } from "@/components/common/ModeToggle";
import { ProfileButton } from "@/components/common/ProfileButton";
import { Button } from "@/components/ui/Button";
import { useRequirementsBrowse } from "@/features/buyer/requirements/hooks/useRequirementsBrowse";
import { resolveBackendRole } from "@/core/auth/roleStore";
import { useAuth } from "@/features/auth/hooks/useAuth";
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

/** Seller Browse (`isRequirements` in Seller App.html): buyer requirements, By Commodity / By Buyer. */
export function RequirementsBrowseScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const role = resolveBackendRole(session?.user);
  const isSeller = role === "seller";
  const { buyer: buyerParam } = useLocalSearchParams<{ buyer?: string }>();
  const {
    categories,
    mode,
    setMode,
    category,
    setCategory,
    buyerSearch,
    setBuyerSearch,
    rows,
    totalCount,
    buyerGroups,
    collapsed,
    toggleBuyer,
    isLoading,
    error,
    retry,
  } = useRequirementsBrowse();

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
        <Text style={styles.title}>Buyer requirements</Text>
        {isSeller ? null : <ProfileButton />}
      </View>
      <Text style={styles.subtitle}>
        {totalCount} buyer {totalCount === 1 ? "requirement" : "requirements"}
      </Text>
      <ModeToggle
        first="By Commodity"
        second="By Buyer"
        value={mode === "commodity" ? "first" : "second"}
        onChange={(v) => setMode(v === "first" ? "commodity" : "buyer")}
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
          {rows.map((row) => (
            <ListingRow
              key={row.id}
              tag={row.category}
              title={row.item}
              subtitle={row.wantsText}
              pill={row.paysText}
              price={row.priceText}
              priceCaption="target"
              onPress={() => openRequirement(row)}
            />
          ))}
          {rows.length === 0 ? (
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
              <View key={bg.buyer} style={styles.group}>
                <Pressable
                  style={styles.buyerHeader}
                  onPress={() => toggleBuyer(bg.buyer)}
                  accessibilityRole="button"
                  accessibilityLabel={bg.buyer}
                >
                  <Text style={styles.buyerName} numberOfLines={1}>
                    {bg.buyer}
                  </Text>
                  <Text style={styles.chevron}>{isCollapsed ? "›" : "⌄"}</Text>
                </Pressable>
                {isCollapsed
                  ? null
                  : bg.rows.map((row) => (
                      <View key={row.id} style={styles.rowIndent}>
                        <ListingRow
                          tag={row.category}
                          title={row.item}
                          subtitle={row.wantsText}
                          pill={row.paysText}
                          price={row.priceText}
                          priceCaption="target"
                          onPress={() => openRequirement(row)}
                        />
                      </View>
                    ))}
              </View>
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
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subtitle: {
    fontSize: 12,
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
    gap: spacing.md,
  },
  group: {
    gap: spacing.sm,
  },
  rowIndent: {
    paddingLeft: spacing.xs,
  },
  buyerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primaryTint,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buyerName: {
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
