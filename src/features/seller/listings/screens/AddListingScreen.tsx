import { BackButton } from "@/components/common/BackButton";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { FormStatus } from "@/components/ui/FormStatus";
import { useAddListing } from "@/features/seller/listings/hooks/useAddListing";
import { QUALITY_GRADES } from "@/features/seller/listings/schemas/listingSchemas";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
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

/** Firm-level fallback (Seller App.html `FIRM_PAYMENT_DEFAULT`). */
const FIRM_PAYMENT_DEFAULT = "10-15 days";

/**
 * Seller Add listing: category → commodity (live backend UUIDs), quality
 * grade, quantity (required), weight/price (optional); publishes
 * `side: "SELL"` to the real backend. `itemName` is derived server-side
 * from the commodity, so there is no free-text item field.
 */
export function AddListingScreen() {
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
    categoriesLoading,
    commodities,
    commoditiesLoading,
    categoryNameById,
    commodityNameById,
  } = useAddListing();

  const categoryOptions = categories.map((c) => c.name);
  const selectedCategoryName = values.categoryId
    ? (categoryNameById.get(values.categoryId) ?? "")
    : "";
  const commodityOptions = commodities.map((c) => c.name);
  const selectedCommodityName = values.commodityId
    ? (commodityNameById.get(values.commodityId) ?? "")
    : "";
  const commodityPlaceholder = !values.categoryId
    ? "Select a category first"
    : commoditiesLoading
      ? "Loading commodities…"
      : commodityOptions.length === 0
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
            accessibilityLabel="Back to dashboard"
            fallback="/add-listing"
          />
        </View>
        <Text style={styles.title}>Add listing</Text>
        <Text style={styles.subtitle}>
          Publish today&apos;s price for one commodity.
        </Text>

        <Dropdown
          label="Category"
          placeholder={categoriesLoading ? "Loading categories…" : "Select a category"}
          value={selectedCategoryName}
          options={categoryOptions}
          onChange={(name) => {
            const found = categories.find((c) => c.name === name);
            if (found) setField("categoryId", found.id);
          }}
          error={fieldErrors.categoryId ?? null}
        />
        {!categoriesLoading && categories.length === 0 ? (
          <Text style={styles.fieldError}>
            Could not load categories. Check your connection and reopen this tab.
          </Text>
        ) : null}

        <Dropdown
          label="Commodity"
          placeholder={commodityPlaceholder}
          value={selectedCommodityName}
          options={commodityOptions}
          onChange={(name) => {
            const found = commodities.find((c) => c.name === name);
            if (found) setField("commodityId", found.id);
          }}
          error={fieldErrors.commodityId ?? null}
        />

        <Dropdown
          label="Quality grade"
          placeholder="No grade (optional)"
          value={values.quality}
          options={QUALITY_GRADES}
          onChange={(v) => setField("quality", v)}
          error={fieldErrors.quality ?? null}
        />

        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Weight per bag (kg)</Text>
            <TextInput
              style={[
                styles.input,
                fieldErrors.weightKg ? styles.inputError : null,
              ]}
              value={values.weightKg}
              onChangeText={(v) => setField("weightKg", v.replace(/[^0-9]/g, ""))}
              placeholder="30"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
            />
            {fieldErrors.weightKg ? (
              <Text style={styles.fieldError}>{fieldErrors.weightKg}</Text>
            ) : null}
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>Price per bag (Rs.)</Text>
            <TextInput
              style={[
                styles.input,
                fieldErrors.price ? styles.inputError : null,
              ]}
              value={values.price}
              onChangeText={(v) => setField("price", v.replace(/[^0-9.]/g, ""))}
              placeholder="12600"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
            />
            {fieldErrors.price ? (
              <Text style={styles.fieldError}>{fieldErrors.price}</Text>
            ) : null}
          </View>
        </View>

        <View>
          <Text style={styles.label}>Quantity (bags)</Text>
          <TextInput
            style={[
              styles.input,
              fieldErrors.quantity ? styles.inputError : null,
            ]}
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

        <Text style={styles.sectionTitle}>Optional details</Text>
        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Moisture</Text>
            <TextInput
              style={styles.input}
              value={values.moisture}
              onChangeText={(v) => setField("moisture", v)}
              placeholder="e.g. 12%"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
            />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>Color</Text>
            <TextInput
              style={styles.input}
              value={values.color}
              onChangeText={(v) => setField("color", v)}
              placeholder="e.g. Pila"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
            />
          </View>
        </View>
        <View>
          <Text style={styles.label}>Size</Text>
          <TextInput
            style={styles.input}
            value={values.size}
            onChangeText={(v) => setField("size", v)}
            placeholder="optional"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
          />
        </View>
        <View>
          <Text style={styles.label}>
            Notes <Text style={styles.optionalTag}>optional</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={values.notes}
            onChangeText={(v) => setField("notes", v)}
            placeholder="Anything else buyers should know"
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.mediaRow}>
          <View style={styles.mediaBox}>
            <Text style={styles.mediaTitle}>Photo</Text>
            <Text style={styles.mediaNote}>Upload arrives soon</Text>
          </View>
          <View style={styles.mediaBox}>
            <Text style={styles.mediaTitle}>Sample video</Text>
            <Text style={styles.mediaNote}>Upload arrives soon</Text>
          </View>
        </View>

        <Pressable
          onPress={() => setField("overridePayment", !values.overridePayment)}
          style={styles.checkRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: values.overridePayment }}
        >
          <View
            style={[
              styles.checkbox,
              values.overridePayment ? styles.checkboxChecked : null,
            ]}
          >
            {values.overridePayment ? (
              <Text style={styles.checkboxTick}>✓</Text>
            ) : null}
          </View>
          <Text style={styles.checkLabel}>
            Override payment terms for this listing
          </Text>
        </Pressable>
        {values.overridePayment ? (
          <View>
            <TextInput
              style={[
                styles.input,
                fieldErrors.paymentTerms ? styles.inputError : null,
              ]}
              value={values.paymentTerms}
              onChangeText={(v) => setField("paymentTerms", v)}
              placeholder="Payment terms in days (e.g. 15)"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              inputMode="numeric"
            />
            {fieldErrors.paymentTerms ? (
              <Text style={styles.fieldError}>{fieldErrors.paymentTerms}</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.muted}>
            Firm default applies: {FIRM_PAYMENT_DEFAULT}
          </Text>
        )}

        {error ? <FormStatus kind="error" message={error} /> : null}
        {success ? <FormStatus kind="success" message={success} /> : null}

        <Button title="Publish listing" onPress={submit} loading={isLoading} />
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
  textarea: {
    minHeight: 84,
    paddingVertical: 12,
  },
  inputError: {
    borderColor: colors.danger,
  },
  fieldError: {
    fontSize: 12.5,
    color: colors.danger,
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  flex1: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 12.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.muted,
    marginTop: spacing.sm,
  },
  mediaRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  mediaBox: {
    flex: 1,
    height: 96,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: spacing.sm,
  },
  mediaTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  mediaNote: {
    fontSize: 11.5,
    color: colors.muted,
    textAlign: "center",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  checkboxTick: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.primaryDark,
  },
  checkLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  muted: {
    fontSize: 12,
    color: colors.muted,
  },
});
