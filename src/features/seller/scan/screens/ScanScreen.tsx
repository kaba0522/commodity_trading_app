import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/common/BackButton";
import { priceLabel } from "@/core/utils/format";
import { useScanSheet } from "@/features/seller/scan/hooks/useScanSheet";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

/**
 * Seller scan flow (`isScan` + `isReview` in Seller App.html).
 * Photo capture/pick is real (expo-image-picker); row parsing is simulated
 * until an OCR backend exists — the review step edits + publishes the
 * sample rows locally.
 */
export function ScanScreen() {
  const {
    step,
    photoUri,
    isPicking,
    isParsing,
    rows,
    editingId,
    setEditingId,
    setRowPrice,
    takePhoto,
    pickFromLibrary,
    clearPhoto,
    parseSheet,
    backToScan,
  } = useScanSheet();

  function publish() {
    router.replace("/add-listing");
  }

  if (step === "review") {
    return (
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: spacing.md },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton accessibilityLabel="Back to scan" onPress={backToScan} />
        <Text style={styles.title}>Review {rows.length} rows</Text>
        <Text style={styles.subtitle}>
          Tap a price to fix it. Nothing goes live until you publish.
        </Text>

        {photoUri ? (
          <View style={styles.sheetStrip}>
            <Image
              source={{ uri: photoUri }}
              style={styles.sheetThumb}
              contentFit="cover"
              accessibilityLabel="Scanned price sheet"
            />
            <Text style={styles.sheetLabel}>Sheet scanned — parsed below</Text>
          </View>
        ) : null}

        <View style={styles.discussionCard}>
          <View style={styles.discussionTag}>
            <Text style={styles.discussionTagText}>FOR DISCUSSION</Text>
          </View>
          <Text style={styles.body}>
            Rows highlighted here match rows marked yellow on the real sheet.
            We don&apos;t yet know what yellow means — featured? changed
            today? Ask before this becomes a real flag.
          </Text>
        </View>

        <View style={styles.list}>
          {rows.map((row) => {
            const editing = editingId === row.id;
            const numeric = Number(row.price);
            return (
              <View
                key={row.id}
                style={[styles.row, row.featured && styles.rowFeatured]}
              >
                <View style={styles.rowMain}>
                  <View style={styles.tagRow}>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{row.category}</Text>
                    </View>
                    {row.featured ? (
                      <View style={styles.outlineTag}>
                        <Text style={styles.outlineTagText}>
                          yellow on sheet
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.rowTitle}>{row.item}</Text>
                  <Text style={styles.muted}>{row.weight} bag</Text>
                </View>
                {editing ? (
                  <TextInput
                    style={styles.priceInput}
                    keyboardType="numeric"
                    autoFocus
                    value={row.price}
                    onChangeText={(value) => setRowPrice(row.id, value)}
                    onBlur={() => setEditingId(null)}
                    onSubmitEditing={() => setEditingId(null)}
                  />
                ) : (
                  <Pressable
                    onPress={() => setEditingId(row.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit price for ${row.item}`}
                  >
                    <Text style={styles.priceLink}>
                      {Number.isFinite(numeric) && row.price.trim() !== ""
                        ? priceLabel(numeric)
                        : "N/A"}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>

        <Button
          title={`Publish ${rows.length} listings`}
          onPress={publish}
        />
      </ScrollView>
    );
  }

  const busy = isPicking || isParsing;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: spacing.md },
      ]}
    >
      <BackButton />
      <Text style={styles.title}>Scan price sheet</Text>
      <Text style={styles.subtitle}>
        Photograph today&apos;s sheet or upload a photo. We&apos;ll pull out
        the rows for you to check.
      </Text>

      <Pressable
        onPress={pickFromLibrary}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={
          photoUri ? "Change price sheet photo" : "Upload price sheet photo"
        }
        style={styles.dropBox}
      >
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={styles.preview}
            contentFit="cover"
            accessibilityLabel="Selected price sheet"
          />
        ) : (
          <>
            <View style={styles.dropIcon}>
              <Text style={styles.dropIconText}>▢</Text>
            </View>
            <Text style={styles.dropTitle}>Drop a photo or tap to upload</Text>
            <Text style={styles.muted}>JPG or PNG · one page of the price list</Text>
          </>
        )}
      </Pressable>

      {photoUri ? (
        <View style={styles.photoActions}>
          <Pressable
            onPress={takePhoto}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Retake photo"
          >
            <Text style={styles.linkText}>Retake</Text>
          </Pressable>
          <Pressable
            onPress={pickFromLibrary}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Choose a different photo"
          >
            <Text style={styles.linkText}>Choose different</Text>
          </Pressable>
          <Pressable
            onPress={clearPhoto}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
          >
            <Text style={[styles.linkText, styles.removeText]}>Remove</Text>
          </Pressable>
        </View>
      ) : (
        <Button
          title={isPicking ? "Opening camera…" : "Take photo"}
          variant="secondary"
          disabled={busy}
          onPress={takePhoto}
        />
      )}

      <Button
        title={
          isParsing ? "Parsing…" : isPicking ? "Loading photo…" : "Upload and Parse"
        }
        disabled={!photoUri || busy}
        onPress={parseSheet}
      />
      {!photoUri ? (
        <Text style={styles.muted}>
          Add a photo of the sheet first — parsing runs on-device in this
          preview; nothing is uploaded.
        </Text>
      ) : null}
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
    fontSize: 14,
    color: colors.muted,
    marginTop: -spacing.sm,
  },
  muted: {
    fontSize: 12.5,
    color: colors.muted,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
    opacity: 0.85,
  },
  dropBox: {
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: "dashed",
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    overflow: "hidden",
  },
  preview: {
    width: "100%",
    height: 220,
    borderRadius: 8,
  },
  dropIcon: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  dropIconText: {
    fontSize: 22,
    color: colors.primaryDark,
  },
  dropTitle: {
    fontSize: 14,
    color: colors.text,
    textAlign: "center",
  },
  photoActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
  removeText: {
    color: colors.muted,
  },
  sheetStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
  },
  sheetThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  sheetLabel: {
    fontSize: 13,
    color: colors.muted,
    flex: 1,
  },
  discussionCard: {
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: spacing.md,
  },
  discussionTag: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryTint,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  discussionTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  rowFeatured: {
    backgroundColor: colors.primaryTint,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tag: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  outlineTag: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  outlineTagText: {
    fontSize: 11.5,
    color: colors.muted,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginTop: 4,
  },
  priceLink: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    textDecorationLine: "underline",
    textDecorationStyle: "dotted",
  },
  priceInput: {
    width: 84,
    textAlign: "right",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    backgroundColor: colors.background,
  },
});
