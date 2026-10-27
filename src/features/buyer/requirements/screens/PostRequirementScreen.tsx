import { BackButton } from "@/components/common/BackButton";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { FormStatus } from "@/components/ui/FormStatus";
import { usePostRequirement } from "@/features/buyer/requirements/hooks/usePostRequirement";
import { QUALITY_GRADES } from "@/features/seller/listings/schemas/listingSchemas";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { router } from "expo-router";
import { useState } from "react";
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
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
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
  const qualityOptions = QUALITY_GRADES.map((grade) =>
    grade
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()),
  );
  const selectedQualityLabel = values.quality
    ? values.quality
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
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
        </View>
        <View style={styles.header}>
          <Text style={styles.title}>Post requirement</Text>
        </View>
        <Text style={styles.subtitle}>
          Visible to all sellers — they will come to you.
        </Text>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Product details</Text>
          <Dropdown
            label="Category"
            placeholder={
              catalogLoading ? "Loading categories…" : "Select a category"
            }
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
              Could not load categories. Check your connection and reopen this
              tab.
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
          <Dropdown
            label="Quality grade (optional)"
            placeholder="Select a quality grade"
            value={selectedQualityLabel}
            options={qualityOptions}
            onChange={(label) => {
              const found = QUALITY_GRADES.find(
                (grade) =>
                  grade
                    .replaceAll("_", " ")
                    .replace(/\b\w/g, (letter) => letter.toUpperCase()) ===
                  label,
              );
              if (found) setField("quality", found);
            }}
            error={fieldErrors.quality ?? null}
          />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Quantity & terms</Text>
          <View>
            <Text style={styles.label}>Quantity (bags)</Text>
            <TextInput
              style={[
                styles.input,
                fieldErrors.quantity ? styles.inputError : null,
              ]}
              value={values.quantity}
              onChangeText={(v) =>
                setField("quantity", v.replace(/[^0-9]/g, ""))
              }
              placeholder="e.g. 50"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
            />
            {fieldErrors.quantity ? (
              <Text style={styles.fieldError}>{fieldErrors.quantity}</Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.label}>Weight per bag (kg)</Text>
            <TextInput
              style={[
                styles.input,
                fieldErrors.weightKg ? styles.inputError : null,
              ]}
              value={values.weightKg}
              onChangeText={(v) =>
                setField("weightKg", v.replace(/[^0-9]/g, ""))
              }
              placeholder="e.g. 30"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              inputMode="numeric"
            />
            {fieldErrors.weightKg ? (
              <Text style={styles.fieldError}>{fieldErrors.weightKg}</Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.label}>Payment terms (days)</Text>
            <TextInput
              style={[
                styles.input,
                fieldErrors.paymentTerms ? styles.inputError : null,
              ]}
              value={values.paymentTerms}
              onChangeText={(v) =>
                setField("paymentTerms", v.replace(/[^0-9]/g, ""))
              }
              placeholder="e.g. 15"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              inputMode="numeric"
            />
            {fieldErrors.paymentTerms ? (
              <Text style={styles.fieldError}>{fieldErrors.paymentTerms}</Text>
            ) : null}
          </View>
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

        {/* <ExpandableGroupCard
          title="Add more details (optional)"
          expanded={showOptionalDetails}
          onToggle={() => setShowOptionalDetails((expanded) => !expanded)}
        >
          <View style={styles.optionalContent}>
            <View>
              <Text style={styles.label}>Delivery location</Text>
              <TextInput
                style={[
                  styles.input,
                  fieldErrors.location ? styles.inputError : null,
                ]}
                value={values.location}
                onChangeText={(v) => setField("location", v)}
                placeholder="e.g. Srinagar"
                placeholderTextColor={colors.muted}
                autoCorrect={false}
              />
              {fieldErrors.location ? (
                <Text style={styles.fieldError}>{fieldErrors.location}</Text>
              ) : null}
            </View>
            <View>
              <Text style={styles.label}>Notes for seller</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textarea,
                  fieldErrors.notes ? styles.inputError : null,
                ]}
                value={values.notes}
                onChangeText={(v) => setField("notes", v)}
                placeholder="Any specific requirements…"
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={500}
              />
              {fieldErrors.notes ? (
                <Text style={styles.fieldError}>{fieldErrors.notes}</Text>
              ) : null}
            </View>
          </View>
        </ExpandableGroupCard> */}
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
    gap: 14,
    backgroundColor: colors.background,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
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
  formCard: {
    gap: 12,
    padding: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  optionalContent: {
    gap: 12,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    color: colors.text,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
  },
  textarea: {
    minHeight: 80,
    paddingTop: 12,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
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
