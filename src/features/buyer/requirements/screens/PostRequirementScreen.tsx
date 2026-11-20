import { BackButton } from "@/components/common/BackButton";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { FormStatus } from "@/components/ui/FormStatus";
import {
  usePostRequirement,
  type PostRequirementValues,
} from "@/features/buyer/requirements/hooks/usePostRequirement";
import { useCommodityQualities } from "@/features/shared/catalog/hooks/useCommodityQualities";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { router } from "expo-router";
import { useState } from "react";
import {
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

/**
 * Buyer Post requirement: category → commodity (live backend UUIDs),
 * quality grade (optional) and quantity (required); publishes `side: "BUY"`.
 * Price is agreed in negotiation.
 */
interface PostRequirementScreenProps {
  editId?: string;
  initialValues?: Partial<PostRequirementValues>;
}

export function PostRequirementScreen({
  editId,
  initialValues,
}: PostRequirementScreenProps) {
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
    isEditing,
  } = usePostRequirement({ editId, initialValues });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const {
    qualities,
    isLoading: qualitiesLoading,
    error: qualitiesError,
    retry: retryQualities,
  } = useCommodityQualities(
    isEditing ? null : values.commodityId || null,
  );

  const selectedCategoryName = values.categoryId
    ? (categoryNameById.get(values.categoryId) ?? "")
    : "";
  const selectedCommodityName = values.commodityId
    ? (commodityNameById.get(values.commodityId) ?? "")
    : "";
  const qualityOptions = qualities.map((quality) => quality.name);
  const selectedQualityLabel =
    qualities.find((quality) => quality.id === values.qualityId)?.name ?? "";
  const qualityPlaceholder = !values.commodityId
    ? "Select a commodity first"
    : qualitiesLoading
      ? "Loading qualities…"
      : qualitiesError
        ? "Could not load qualities"
        : qualities.length === 0
          ? "No qualities configured for this commodity. Contact an admin to add qualities before posting."
          : "Select a quality grade (optional)";
  const commodityPlaceholder = !values.categoryId
    ? "Select a category first"
    : commoditiesLoading
      ? "Loading commodities…"
      : commoditiesError
        ? "Could not load commodities"
          : commodities.length === 0
            ? "No commodities in this category"
            : "Select a commodity";

  async function handleSubmit() {
    const saved = await submit();
    if (saved && !isEditing) setShowConfirmation(true);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: spacing.md },
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
          <Text style={styles.title}>
            {isEditing ? "Edit requirement" : "Post requirement"}
          </Text>
        </View>
        <Text style={styles.subtitle}>
          {isEditing
            ? "Update the quantity for this requirement."
            : "Visible to all sellers — they will come to you."}
        </Text>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Product details</Text>
          {isEditing ? (
            <View>
              <Text style={styles.label}>Category</Text>
              <Text style={styles.helperText}>{selectedCategoryName}</Text>
              <Text style={styles.label}>Commodity</Text>
              <Text style={styles.helperText}>{selectedCommodityName}</Text>
            </View>
          ) : (
            <>
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
                  Could not load categories. Check your connection and reopen
                  this tab.
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
            </>
          )}
          {!isEditing ? (
            <>
              <Dropdown
                label="Quality grade"
                placeholder={qualityPlaceholder}
                value={selectedQualityLabel}
                options={qualityOptions}
                onChange={(name) => {
                  const found = qualities.find(
                    (quality) => quality.name === name,
                  );
                  if (found) setField("qualityId", found.id);
                }}
              />
              {qualitiesError ? (
                <Pressable
                  onPress={retryQualities}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading qualities"
                >
                  <Text style={styles.fieldError}>
                    {qualitiesError} Tap to retry.
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>
            {isEditing ? "Quantity" : "Quantity & terms"}
          </Text>
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
          {!isEditing ? (
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
          ) : null}
          {!isEditing ? (
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
                <Text style={styles.fieldError}>
                  {fieldErrors.paymentTerms}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {error ? <FormStatus kind="error" message={error} /> : null}
        {success ? <FormStatus kind="success" message={success} /> : null}

        <Button
          title={isEditing ? "Save changes" : "Post requirement"}
          onPress={handleSubmit}
          loading={isLoading}
          disabled={isLoading}
        />
        {success ? (
          <Button
            title={
              isEditing ? "Back to my requirements" : "View my requirements"
            }
            variant="secondary"
            onPress={() => router.back()}
          />
        ) : null}
      </ScrollView>

      <Modal
        visible={showConfirmation}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmation(false)}
      >
        <View style={styles.confirmationOverlay}>
          <View
            style={styles.confirmationCard}
            accessibilityViewIsModal
            accessibilityRole="alert"
          >
            <View style={styles.confirmationIcon}>
              <Text style={styles.confirmationCheck}>✓</Text>
            </View>
            <Text style={styles.confirmationTitle}>Requirement posted!</Text>
            <Text style={styles.confirmationMessage}>{success}</Text>
            <Text style={styles.confirmationHint}>
              Sellers can now send offers to your requirement.
            </Text>
            <Pressable
              style={styles.continueButton}
              onPress={() => setShowConfirmation(false)}
              accessibilityRole="button"
            >
              <Text style={styles.continueButtonText}>
                Continue with post requirement
              </Text>
            </Pressable>
            <Pressable
              style={styles.okButton}
              onPress={() => {
                setShowConfirmation(false);
                router.back();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.okButtonText}>View my requirements</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  confirmationOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
  },
  confirmationCard: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmationIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.successBg,
    marginBottom: spacing.xs,
  },
  confirmationCheck: {
    color: colors.success,
    fontSize: 32,
    fontWeight: "800",
  },
  confirmationTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  confirmationMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
    textAlign: "center",
  },
  confirmationHint: {
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.muted,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  continueButton: {
    width: "100%",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  continueButtonText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  okButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  okButtonText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },
});
