import { BackButton } from "@/components/common/BackButton";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { FormStatus } from "@/components/ui/FormStatus";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { cloudinaryUploadFile } from "@/core/api/cloudinary";
import { getFriendlyApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useAddListing } from "@/features/seller/listings/hooks/useAddListing";
import { QUALITY_GRADES } from "@/features/seller/listings/schemas/listingSchemas";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
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

const MAX_LISTING_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

function mediaExtension(asset: ImagePicker.ImagePickerAsset): string {
  const fileName = asset.fileName ?? asset.uri.split(/[?#]/, 1)[0].split("/").pop() ?? "";
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension && extension !== fileName.toLowerCase()) return extension;
  const mimeType = asset.mimeType?.toLowerCase();
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "video/mp4") return "mp4";
  if (mimeType === "video/quicktime") return "mov";
  if (mimeType === "video/webm") return "webm";
  return "";
}

function validateMediaAsset(
  asset: ImagePicker.ImagePickerAsset,
  resourceType: "image" | "video",
): string | null {
  const extension = mediaExtension(asset);
  const allowedFormats =
    resourceType === "image"
      ? ["jpg", "jpeg", "png", "webp"]
      : ["mp4", "mov", "webm"];
  if (!allowedFormats.includes(extension)) {
    return resourceType === "image"
      ? "Photos must be JPG, JPEG, PNG, or WebP."
      : "Videos must be MP4, MOV, or WebM.";
  }
  const maxBytes = resourceType === "image" ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES;
  const fileSize = asset.fileSize ?? asset.file?.size;
  if (fileSize !== undefined && fileSize > maxBytes) {
    return resourceType === "image"
      ? "Each photo must be 5 MB or smaller."
      : "The video must be 50 MB or smaller.";
  }
  return null;
}

/**
 * Seller Add listing: category → commodity (live backend UUIDs), quality
 * grade, quantity (required), weight and price (optional); publishes
 * `side: "SELL"` to the real backend. Photos/videos are uploaded directly
 * to Cloudinary via signed URLs, and the resulting secure_url(s) are sent
 * to the backend when creating the listing.
 * itemName is derived server-side from the commodity, so there is no free-text item field.
 */
export function AddListingScreen() {
  const insets = useSafeAreaInsets();
  const [optionalDetailsOpen, setOptionalDetailsOpen] = useState(false);
  const [isPickingMedia, setIsPickingMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { runWithAuth } = useAuth();
  const {
    values,
    setField,
    setMediaField,
    fieldErrors,
    error,
    success,
    isLoading,
    submit,
    categories,
    categoriesLoading,
    commodities,
    commoditiesLoading,
    defaultPaymentTerms,
    categoryNameById,
    commodityNameById,
  } = useAddListing();
  const photos = values.photoUrls;
  const sampleVideo = values.videoUrls[0] ?? null;

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

  const uploadToCloudinary = async (
    asset: ImagePicker.ImagePickerAsset,
    resourceType: "image" | "video",
  ) => {
    setIsUploading(true);
    try {
      const result = await runWithAuth((token) =>
        cloudinaryUploadFile(asset, resourceType, token),
      );
      return result.secure_url;
    } finally {
      setIsUploading(false);
    }
  };

  async function pickPhotos() {
    if (isPickingMedia || photos.length >= MAX_LISTING_PHOTOS) return;
    setMediaError(null);
    setIsPickingMedia(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMediaError("Allow photo library access to choose listing photos.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: MAX_LISTING_PHOTOS - photos.length,
        quality: 0.8,
      });
      if (!result.canceled) {
        for (const asset of result.assets) {
          const validationError = validateMediaAsset(asset, "image");
          if (validationError) {
            setMediaError(validationError);
            break;
          }
          try {
            const secureUrl = await uploadToCloudinary(asset, "image");
            setMediaField("photoUrls", (current) =>
              current.includes(secureUrl) || current.length >= MAX_LISTING_PHOTOS
                ? current
                : [...current, secureUrl],
            );
          } catch (cause) {
            setMediaError(getFriendlyApiError(cause, "Failed to upload photo"));
            break;
          }
        }
      }
    } catch (cause) {
      setMediaError(
        cause instanceof Error
          ? `Could not open the photo library: ${cause.message}`
          : "Could not open the photo library.",
      );
    } finally {
      setIsPickingMedia(false);
    }
  }

  async function pickSampleVideo() {
    if (isPickingMedia) return;
    setMediaError(null);
    setIsPickingMedia(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMediaError("Allow photo library access to choose a sample video.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        selectionLimit: 1,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const validationError = validateMediaAsset(asset, "video");
        if (validationError) {
          setMediaError(validationError);
          return;
        }
        try {
          const secureUrl = await uploadToCloudinary(asset, "video");
          setMediaField("videoUrls", [secureUrl]);
        } catch (cause) {
          setMediaError(getFriendlyApiError(cause, "Failed to upload video"));
        }
      }
    } catch (cause) {
      setMediaError(
        cause instanceof Error
          ? `Could not open the video library: ${cause.message}`
          : "Could not open the video library.",
      );
    } finally {
      setIsPickingMedia(false);
    }
  }

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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Product details</Text>
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
            label="Quality grade (optional)"
            placeholder="Select a quality grade"
            value={values.quality}
            options={QUALITY_GRADES}
            onChange={(v) => setField("quality", v)}
            error={fieldErrors.quality ?? null}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pricing & quantity</Text>
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>
                Weight per bag (kg) <Text style={styles.optionalTag}>optional</Text>
              </Text>
              <TextInput
                style={[styles.input, fieldErrors.weightKg ? styles.inputError : null]}
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
              <Text style={styles.label}>
                Price per bag (Rs.) <Text style={styles.optionalTag}>optional</Text>
              </Text>
              <TextInput
                style={[styles.input, fieldErrors.price ? styles.inputError : null]}
                value={values.price}
                onChangeText={(v) => setField("price", v.replace(/[^0-9.]/g, ""))}
                placeholder="Leave blank = open to offers"
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

          {defaultPaymentTerms === null ? (
            <View>
              <Text style={styles.muted}>
                Set payment terms for this listing. The backend requires listing
                terms or a seller default in your profile.
              </Text>
              <Text style={styles.label}>Payment terms (days)</Text>
              <TextInput
                style={[styles.input, fieldErrors.paymentTerms ? styles.inputError : null]}
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
            <>
              <Pressable
                onPress={() => setField("overridePayment", !values.overridePayment)}
                style={styles.checkRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: values.overridePayment }}
              >
                <View
                  style={[styles.checkbox, values.overridePayment ? styles.checkboxChecked : null]}
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
                  <Text style={styles.label}>Payment terms (days)</Text>
                  <TextInput
                    style={[styles.input, fieldErrors.paymentTerms ? styles.inputError : null]}
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
                  Firm default applies: {defaultPaymentTerms} days
                </Text>
              )}
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Media</Text>
          <View style={styles.mediaRow}>
            <Pressable
              style={[
                styles.mediaBox,
                (isPickingMedia || photos.length >= MAX_LISTING_PHOTOS) &&
                  styles.mediaBoxDisabled,
              ]}
              onPress={pickPhotos}
              disabled={isPickingMedia || photos.length >= MAX_LISTING_PHOTOS}
              accessibilityRole="button"
              accessibilityLabel={`Choose listing photos, ${photos.length} of ${MAX_LISTING_PHOTOS} selected`}
            >
              <Text style={styles.mediaIcon}>＋</Text>
              <Text style={styles.mediaTitle}>
                {isUploading
                  ? "Uploading…"
                  : isPickingMedia
                    ? "Opening library…"
                    : "Add photos"}
              </Text>
              <Text style={styles.mediaNote}>
                {photos.length}/${MAX_LISTING_PHOTOS} selected
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.mediaBox,
                isPickingMedia && styles.mediaBoxDisabled,
              ]}
              onPress={pickSampleVideo}
              disabled={isPickingMedia}
              accessibilityRole="button"
              accessibilityLabel="Choose a sample video"
            >
              <Text style={styles.mediaIcon}>▶</Text>
              <Text style={styles.mediaTitle}>
                {isUploading
                  ? "Uploading…"
                  : isPickingMedia
                    ? "Opening library…"
                    : "Add sample video"}
              </Text>
              <Text style={styles.mediaNote}>
                {sampleVideo ? "Replace selected video" : "Choose one video"}
              </Text>
            </Pressable>
          </View>
          {photos.length > 0 ? (
            <View style={styles.mediaGrid}>
              {photos.map((secureUrl, idx) => (
                <View key={idx} style={styles.photoPreview}>
                  <Image
                    source={{ uri: secureUrl }}
                    style={styles.previewImage}
                    contentFit="cover"
                    accessibilityLabel={`Listing photo ${idx + 1}`}
                  />
                  <Pressable
                    style={styles.removeMediaButton}
                    onPress={() =>
                      setMediaField("photoUrls", (current) =>
                        current.filter((_url, i) => i !== idx),
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Remove photo ${idx + 1}`}
                  >
                    <Text style={styles.removeMediaText}>×</Text>
                  </Pressable>
                  <Text style={styles.previewName} numberOfLines={1}>
                    Photo {idx + 1}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {sampleVideo ? (
            <View style={styles.videoPreview}>
              <View style={styles.videoIcon}>
                <Text style={styles.videoPlay}>▶</Text>
              </View>
              <View style={styles.videoDetails}>
                <Text style={styles.videoTitle} numberOfLines={1}>
                  Sample video
                </Text>
                <Text style={styles.mediaNote}>Selected on this device</Text>
              </View>
              <Pressable
                style={styles.removeVideoButton}
                onPress={() => setMediaField("videoUrls", [])}
                accessibilityRole="button"
                accessibilityLabel="Remove selected video"
              >
                <Text style={styles.removeMediaText}>×</Text>
              </Pressable>
            </View>
          ) : null}
          <Text style={styles.mediaNote}>
            Up to 5 photos (5 MB each) and 1 video (50 MB). JPG, PNG, WebP,
            MP4, MOV, or WebM.
          </Text>
          {mediaError ? <FormStatus kind="error" message={mediaError} /> : null}
          {isUploading && (
            <FormStatus kind="info" message="Uploading to Cloudinary…" />
          )}
        </View>

        <View style={styles.optionalCard}>
          <Pressable
            style={styles.optionalHeader}
            onPress={() => setOptionalDetailsOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: optionalDetailsOpen }}
          >
            <View>
              <Text style={styles.optionalTitle}>Add more details (optional)</Text>
              <Text style={styles.optionalSubtitle}>
                Moisture, color, size and notes
              </Text>
            </View>
            <Text style={styles.optionalChevron}>
              {optionalDetailsOpen ? "▲" : "▼"}
            </Text>
          </Pressable>
          {optionalDetailsOpen ? (
            <View style={styles.optionalFields}>
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
              <View style={styles.row}>
                <View style={styles.flex1}>
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
              </View>
            </View>
          ) : null}
        </View>

        {error ? <FormStatus kind="error" message={error} /> : null}
        {success ? <FormStatus kind="success" message={success} /> : null}

        <Button
          title="Publish listing"
          onPress={submit}
          loading={isLoading}
          disabled={isPickingMedia || isUploading}
        />
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
  card: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
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
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxTick: {
    color: colors.onPrimary,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "700",
  },
  checkLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  flex1: {
    flex: 1,
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
  mediaBoxDisabled: {
    opacity: 0.55,
  },
  mediaIcon: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.primary,
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
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  photoPreview: {
    width: 92,
    gap: 4,
  },
  previewImage: {
    width: 92,
    height: 76,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  removeMediaButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  removeMediaText: {
    color: colors.onPrimary,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "700",
  },
  previewName: {
    fontSize: 11,
    color: colors.muted,
  },
  videoPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  videoIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryTint,
  },
  videoPlay: {
    color: colors.primary,
    fontSize: 16,
  },
  videoDetails: {
    flex: 1,
    gap: 3,
  },
  videoTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  removeVideoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  optionalCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  optionalHeader: {
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  optionalTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  optionalSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 3,
  },
  optionalChevron: {
    fontSize: 12,
    color: colors.muted,
  },
  optionalFields: {
    padding: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  muted: {
    fontSize: 12,
    color: colors.muted,
  },
});