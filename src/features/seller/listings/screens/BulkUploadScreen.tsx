import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/common/BackButton";
import { FormStatus } from "@/components/ui/FormStatus";
import { useBulkUpload } from "@/features/seller/listings/hooks/useBulkUpload";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

/**
 * Seller bulk upload: download the .xlsx template → fill → pick → preview
 * (ready vs needs-review, per backend `parseUploadedWorkbook`) → confirm.
 * Confirm creates new listings or updates the live duplicate.
 */
export function BulkUploadScreen() {
  const {
    step,
    file,
    preview,
    readyRows,
    reviewRows,
    result,
    isPicking,
    isDownloading,
    isUploading,
    isConfirming,
    error,
    downloadTemplate,
    pickFile,
    upload,
    confirm,
    reset,
  } = useBulkUpload();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: spacing.md },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <BackButton fallback="/add-listing" />
      <Text style={styles.title}>Bulk upload</Text>
      <Text style={styles.subtitle}>
        Fill the Excel template, upload it, review the preview, then confirm.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>1 · Template</Text>
        <Text style={styles.muted}>
          Columns: Category, Commodity, Quality, Quantity (Bags), Weight (Kg),
          Price, Payment Terms, Notes, Moisture, Color, Size.
        </Text>
        <Button
          title={isDownloading ? "Downloading…" : "Download template (.xlsx)"}
          variant="secondary"
          disabled={isDownloading}
          onPress={downloadTemplate}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>2 · Upload filled file</Text>
        <Button
          title={
            isPicking
              ? "Opening files…"
              : file
                ? `Change file (${file.name})`
                : "Pick .xlsx file"
          }
          variant="secondary"
          disabled={isPicking || isUploading}
          onPress={pickFile}
        />
        {file ? (
          <Text style={styles.muted} numberOfLines={1}>
            Selected: {file.name}
          </Text>
        ) : null}
        <Button
          title={isUploading ? "Parsing…" : "Upload & preview"}
          disabled={!file || isUploading}
          loading={isUploading}
          onPress={upload}
        />
      </View>

      {preview ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>3 · Preview</Text>
          <Text style={styles.summary}>
            {preview.summary.totalRows} rows · {preview.summary.readyRows}{" "}
            ready · {preview.summary.needsReviewRows} need review
          </Text>

          {readyRows.length > 0 ? (
            <View style={styles.group}>
              <Text style={styles.groupTitle}>
                Ready ({readyRows.length})
              </Text>
              {readyRows.map((r) => (
                <View key={r.rowIndex} style={styles.row}>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      Row {r.rowIndex} ·{" "}
                      {r.resolved.itemName ??
                        String(r.raw["commodity"] ?? "Unknown")}
                    </Text>
                    <Text style={styles.muted} numberOfLines={2}>
                      {r.resolved.quantityBags ?? "—"} bags
                      {r.resolved.weightKg
                        ? ` · ${r.resolved.weightKg}kg`
                        : ""}
                      {r.resolved.price ? ` · Rs.${r.resolved.price}` : ""}
                      {r.willUpdateExisting ? " · updates existing" : ""}
                    </Text>
                  </View>
                  <View style={styles.readyTag}>
                    <Text style={styles.readyTagText}>READY</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {reviewRows.length > 0 ? (
            <View style={styles.group}>
              <Text style={styles.groupTitle}>
                Needs review ({reviewRows.length})
              </Text>
              {reviewRows.map((r) => (
                <View key={r.rowIndex} style={[styles.row, styles.rowWarn]}>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      Row {r.rowIndex}
                    </Text>
                    {r.errors.map((msg) => (
                      <Text key={msg} style={styles.errorLine}>
                        • {msg}
                      </Text>
                    ))}
                    {r.resolved.categorySuggestion ? (
                      <Text style={styles.muted}>
                        Did you mean category “
                        {r.resolved.categorySuggestion.name}”?
                      </Text>
                    ) : null}
                    {r.resolved.commoditySuggestion ? (
                      <Text style={styles.muted}>
                        Did you mean commodity “
                        {r.resolved.commoditySuggestion.name}”?
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
              <Text style={styles.muted}>
                Fix these rows in Excel and re-upload. Only ready rows are
                confirmed below.
              </Text>
            </View>
          ) : null}

          {step === "preview" ? (
            <Button
              title={
                isConfirming
                  ? "Confirming…"
                  : `Confirm ${readyRows.length} ready row${readyRows.length === 1 ? "" : "s"}`
              }
              disabled={readyRows.length === 0 || isConfirming}
              loading={isConfirming}
              onPress={confirm}
            />
          ) : null}
        </View>
      ) : null}

      {step === "done" && result ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Done</Text>
          <Text style={styles.summary}>
            {result.created.length} created · {result.updated.length} updated ·{" "}
            {result.failed.length} failed
          </Text>
          {result.failed.map((f) => (
            <Text key={String(f.rowIndex)} style={styles.errorLine}>
              Row {f.rowIndex ?? "?"}: {f.reason}
            </Text>
          ))}
          <Button
            title="Back to today's listings"
            onPress={() => router.replace("/add-listing")}
          />
          <Button title="Upload another file" variant="secondary" onPress={reset} />
        </View>
      ) : null}

      {error ? <FormStatus kind="error" message={error} /> : null}
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
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: -spacing.sm,
  },
  card: {
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  summary: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  muted: {
    fontSize: 12.5,
    color: colors.muted,
  },
  group: {
    gap: spacing.sm,
  },
  groupTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.muted,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
  },
  rowWarn: {
    borderColor: colors.danger,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.text,
  },
  readyTag: {
    backgroundColor: colors.primaryTint,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  readyTagText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: colors.primaryDark,
  },
  errorLine: {
    fontSize: 12.5,
    color: colors.danger,
  },
});
