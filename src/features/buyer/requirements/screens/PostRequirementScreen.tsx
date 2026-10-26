import { BackButton } from "@/components/common/BackButton";
import { ProfileButton } from "@/components/common/ProfileButton";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { FormStatus } from "@/components/ui/FormStatus";
import { usePostRequirement } from "@/features/buyer/requirements/hooks/usePostRequirement";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { router } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Buyer Post requirement: category → commodity (live backend UUIDs),
 * quantity (required); publishes `side: "BUY"`. Price is agreed in negotiation.
 */
export function PostRequirementScreen() {
  const insets = useSafeAreaInsets();
  const {
    values,
    setField,
    fieldErrors,
    error,
    success,
    isLoading,
    submit,
    categories,
    commodities,
    catalogLoading,
    commoditiesLoading,
    commoditiesError,
    retryCommodities,
    categoryNameById,
    commodityNameById,
  } = usePostRequirement();

  const selectedCategoryName = values.categoryId
    ? (categoryNameById.get(values.categoryId) ?? "")
    : "";
  const selectedCommodityName = values.commodityId
    ? (commodityNameById.get(values.commodityId) ?? "")
    : "";
  const commodityPlaceholder = !values.categoryId
    ? "Select a category first"
    : commoditiesLoading
      ? "Loading commodities…"
      : commoditiesError
        ? "Could not load commodities"
        : commodities.length === 0
          ? "No commodities in this category"
          : "Select a commodity";

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <BackButton
            accessibilityLabel="Back to my requirements"
            fallback="/post-req"
          />
          <ProfileButton />
        </View>
        <View style={styles.header}>
          <Text style={styles.title}>Post requirement</Text>
        </View>
        <Text style={styles.subtitle}>
          Tell sellers what you want to buy. You can discuss pricing during negotiation.
        </Text>

        <Dropdown
          label="Category"
          placeholder={catalogLoading ? "Loading categories…" : "Select a category"}
          value={selectedCategoryName}
          options={categories.map((c) => c.name)}
          onChange={(name) => {
            const found = categories.find((c) => c.name === name);
            if (found) setField("categoryId", found.id);
          }}
          error={fieldErrors.categoryId ?? null}
        />
        {!catalogLoading && categories.length === 0 ? (
          <Text style={styles.fieldError}>
            Could not load categories. Check your connection and reopen this tab.
          </Text>
        ) : null}

        <Dropdown
          label="Commodity"
          placeholder={commodityPlaceholder}
          value={selectedCommodityName}
          options={commodities.map((c) => c.name)}
          onChange={(name) => {
            const found = commodities.find((c) => c.name === name);
            if (found) setField("commodityId", found.id);
          }}
          error={fieldErrors.commodityId ?? null}
        />
        {commoditiesError ? (
          <Pressable
            onPress={retryCommodities}
            accessibilityRole="button"
            accessibilityLabel="Retry loading commodities"
          >
            <Text style={styles.fieldError}>
              {commoditiesError} Tap to retry.
            </Text>
          </Pressable>
        ) : null}

        <View>
          <Text style={styles.label}>Quantity (bags)</Text>
          <TextInput
            style={[styles.input, fieldErrors.quantity ? styles.inputError : null]}
            value={values.quantity}
            onChangeText={(v) => setField("quantity", v.replace(/[^0-9]/g, ""))}
            placeholder="e.g. 40"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
          />
          {fieldErrors.quantity ? (
            <Text style={styles.fieldError}>{fieldErrors.quantity}</Text>
          ) : null}
        </View>

        {error ? <FormStatus kind="error" message={error} /> : null}
        {success ? <FormStatus kind="success" message={success} /> : null}

        <Button title="Post requirement" onPress={submit} loading={isLoading} />
        {success ? (
          <Button
            title="View my requirements"
            variant="secondary"
            onPress={() => router.back()}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: -spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    color: colors.text,
  },
  optionalTag: {
    fontSize: 11,
    fontWeight: "400",
    color: colors.muted,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.danger,
  },
  fieldError: {
    fontSize: 12.5,
    color: colors.danger,
    marginTop: 4,
  },
});
