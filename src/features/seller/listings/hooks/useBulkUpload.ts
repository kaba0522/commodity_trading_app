import { useCallback, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { getFriendlyApiError } from "@/core/api/client";
import { apiUrl, LISTINGS_ENDPOINTS } from "@/core/api/endpoints";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
  listingsApi,
  type BulkConfirmResult,
  type BulkConfirmRow,
  type BulkPreviewResult,
} from "@/features/seller/listings/api/listingsApi";

export type BulkUploadStep = "pick" | "preview" | "done";

export interface PickedXlsx {
  uri: string;
  name: string;
  mimeType?: string;
}

/**
 * Seller bulk upload (`POST /listings/bulk-upload` → preview →
 * `POST /listings/bulk-confirm`), mirroring
 * `listing-bulk.service.js` in Tradding_backend.
 *
 * Flow: download template → fill in Excel → pick .xlsx → server parses to
 * `ready` + `needsReview` rows → confirm the ready rows.
 */
export function useBulkUpload() {
  const { runWithAuth } = useAuth();
  const [step, setStep] = useState<BulkUploadStep>("pick");
  const [file, setFile] = useState<PickedXlsx | null>(null);
  const [preview, setPreview] = useState<BulkPreviewResult | null>(null);
  const [result, setResult] = useState<BulkConfirmResult | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readyRows = useMemo(
    () => preview?.rows.filter((r) => r.ready) ?? [],
    [preview],
  );
  const reviewRows = useMemo(
    () => preview?.rows.filter((r) => !r.ready) ?? [],
    [preview],
  );

  const downloadTemplate = useCallback(async () => {
    setIsDownloading(true);
    setError(null);
    try {
      await runWithAuth(async (token) => {
        if (Platform.OS === "web") {
          const blob = await listingsApi.downloadTemplate(token);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "listing-bulk-template.xlsx";
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        } else {
          // Native: download straight to a cache file so the auth header
          // travels with the request (no blob round-trip), then share it.
          const { File, Paths } = await import("expo-file-system");
          const Sharing = await import("expo-sharing");
          const dest = new File(Paths.cache, "listing-bulk-template.xlsx");
          const downloaded = await File.downloadFileAsync(
            apiUrl(LISTINGS_ENDPOINTS.template),
            dest,
            { headers: { Authorization: `Bearer ${token}` }, idempotent: true },
          );
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(downloaded.uri, {
              mimeType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
          } else {
            setError(`Template saved to ${downloaded.uri}`);
          }
        }
      });
    } catch (e) {
      setError(getFriendlyApiError(e, "Could not download the template"));
    } finally {
      setIsDownloading(false);
    }
  }, [runWithAuth]);

  const pickFile = useCallback(async () => {
    if (isPicking || isUploading) return;
    setIsPicking(true);
    setError(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (!asset) return;
      const name = asset.name ?? "upload.xlsx";
      if (!/\.xlsx$/i.test(name)) {
        setError("Only .xlsx files are allowed.");
        return;
      }
      setFile({ uri: asset.uri, name, mimeType: asset.mimeType ?? undefined });
      setPreview(null);
      setResult(null);
      setStep("pick");
    } catch (e) {
      setError(getFriendlyApiError(e, "Could not pick the file"));
    } finally {
      setIsPicking(false);
    }
  }, [isPicking, isUploading]);

  const upload = useCallback(async () => {
    if (!file) {
      setError("Pick an .xlsx file first.");
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      let payload: Blob | PickedXlsx = file;
      if (Platform.OS === "web") {
        const res = await fetch(file.uri);
        const blob = await res.blob();
        payload = blob;
      }
      const parsed = await runWithAuth((token) =>
        listingsApi.bulkUpload(payload, file.name, token),
      );
      setPreview(parsed);
      setResult(null);
      setStep("preview");
    } catch (e) {
      setError(getFriendlyApiError(e, "Could not parse the file"));
    } finally {
      setIsUploading(false);
    }
  }, [file, runWithAuth]);

  const confirm = useCallback(async () => {
    if (readyRows.length === 0) {
      setError("No ready rows to confirm — fix the file and re-upload.");
      return;
    }
    setIsConfirming(true);
    setError(null);
    try {
      const rows: BulkConfirmRow[] = readyRows.map((r) => ({
        rowIndex: r.rowIndex,
        categoryId: r.resolved.categoryId as string,
        commodityId: r.resolved.commodityId as string,
        qualityId: r.resolved.qualityId as string,
        quantityBags: r.resolved.quantityBags as number,
        weightKg: r.resolved.weightKg,
        price: r.resolved.price,
        paymentTerms: r.resolved.paymentTerms,
        notes: r.resolved.notes,
        moisture: r.resolved.moisture,
        color: r.resolved.color,
        size: r.resolved.size,
      }));
      const out = await runWithAuth((token) =>
        listingsApi.bulkConfirm(rows, token),
      );
      setResult(out);
      setStep("done");
    } catch (e) {
      setError(getFriendlyApiError(e, "Could not confirm the rows"));
    } finally {
      setIsConfirming(false);
    }
  }, [readyRows, runWithAuth]);

  const reset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setStep("pick");
  }, []);

  return {
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
  };
}
