import { apiFetch } from "./client";
import { MEDIA_ENDPOINTS, apiUrl } from "./endpoints";
import { File as ExpoFile } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";

export interface CloudinarySignData {
  uploadUrl: string;
  apiKey: string;
  signature: string;
  timestamp: number;
  folder: string;
  allowed_formats: string;
}

export type CloudinarySignedUrl =
  | { success: true; data: CloudinarySignData }
  | { success: false; error: string };

export interface CloudinarySignParams {
  resourceType: "image" | "video";
}

export async function cloudinarySignUrl(
  params: CloudinarySignParams,
  token: string,
): Promise<CloudinarySignedUrl> {
  return apiFetch<CloudinarySignedUrl>(apiUrl(MEDIA_ENDPOINTS.sign), {
    method: "POST",
    token,
    body: params,
  });
}

export interface CloudinaryUploadAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number;
  file?: Blob;
}

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  width?: number;
  height?: number;
  duration?: number;
  resource_type: "image" | "video";
  format?: string;
  bytes?: number;
}

function uploadErrorMessage(raw: string, status: number): string {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const error = (parsed as Record<string, unknown>)["error"];
      if (error && typeof error === "object") {
        const message = (error as Record<string, unknown>)["message"];
        if (typeof message === "string" && message.trim()) return message;
      }
    }
  } catch {
    // Keep a useful plain-text error response below.
  }
  return raw.trim() || `Cloudinary upload failed (${status})`;
}

export async function cloudinaryUploadFile(
  asset: CloudinaryUploadAsset,
  resourceType: "image" | "video",
  token: string,
): Promise<CloudinaryUploadResult> {
  const signed = await cloudinarySignUrl({ resourceType }, token);
  if (!signed.success) {
    throw new Error(signed.error || "Failed to get Cloudinary signed URL");
  }

  const { uploadUrl, apiKey, signature, timestamp, folder, allowed_formats } =
    signed.data;
  const uploadEndpoint = new URL(uploadUrl);
  if (
    uploadEndpoint.protocol !== "https:" ||
    uploadEndpoint.hostname !== "api.cloudinary.com" ||
    !uploadEndpoint.pathname.endsWith(`/${resourceType}/upload`)
  ) {
    throw new Error("The server returned an invalid Cloudinary upload URL");
  }

  const formData = new FormData();
  const fileName =
    asset.fileName ??
    asset.uri.split(/[?#]/, 1)[0].split("/").pop() ??
    "upload";
  const filePart = asset.file ?? new ExpoFile(asset.uri);
  formData.append("file", filePart, fileName);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);
  formData.append("allowed_formats", allowed_formats);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  let response: Response;
  let raw: string;
  try {
    response = await expoFetch(uploadUrl, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    raw = await response.text();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Could not reach Cloudinary. Check your connection and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new Error(uploadErrorMessage(raw, response.status));
  }

  let result: unknown;
  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error("Cloudinary returned an invalid upload response");
  }
  if (
    !result ||
    typeof result !== "object" ||
    typeof (result as Record<string, unknown>)["secure_url"] !== "string" ||
    (result as Record<string, unknown>)["resource_type"] !== resourceType
  ) {
    throw new Error("Cloudinary returned an invalid upload response");
  }
  return result as CloudinaryUploadResult;
}
