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

/** Cloudinary stores audio on its video endpoint (§20 voice notes). */
export type CloudinaryResourceType = "image" | "video" | "audio";

export interface CloudinarySignParams {
  resourceType: CloudinaryResourceType;
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

function uploadErrorMessage(
  raw: string,
  status: number,
  resourceType: CloudinaryResourceType,
): string {
  let message = "";
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const error = (parsed as Record<string, unknown>)["error"];
      if (error && typeof error === "object") {
        const candidate = (error as Record<string, unknown>)["message"];
        if (typeof candidate === "string") message = candidate.trim();
      }
    }
  } catch {
    // Fall back to the plain-text response below.
  }
  if (!message) message = raw.trim();

  if (/invalid format|not allowed|allowed_formats|unsupported format/i.test(message)) {
    if (resourceType === "audio") {
      return "This audio format is not supported. Please record a new voice note.";
    }
    if (resourceType === "image") {
      return "Photos must be JPG, JPEG, PNG, or WebP.";
    }
    return "Videos must be MP4, MOV, or WebM.";
  }

  return message || `Cloudinary upload failed (${status})`;
}

export async function cloudinaryUploadFile(
  asset: CloudinaryUploadAsset,
  resourceType: CloudinaryResourceType,
  token: string,
  /**
   * Voice notes are signed as `audio` so the backend can attribute the upload
   * to the sender, but Cloudinary stores them on /video/upload. Override this
   * only when an audio upload error needs audio-specific wording.
   */
  errorContext: CloudinaryResourceType = resourceType,
): Promise<CloudinaryUploadResult> {
  const signed = await cloudinarySignUrl({ resourceType }, token);
  if (!signed.success) {
    throw new Error(signed.error || "Failed to get Cloudinary signed URL");
  }

  const { uploadUrl, apiKey, signature, timestamp, folder, allowed_formats } =
    signed.data;
  // §20: audio is signed for /video/upload — Cloudinary stores audio there.
  const uploadPath = resourceType === "audio" ? "video" : resourceType;
  const expectedResponseType = uploadPath;
  const uploadEndpoint = new URL(uploadUrl);
  if (
    uploadEndpoint.protocol !== "https:" ||
    uploadEndpoint.hostname !== "api.cloudinary.com" ||
    !uploadEndpoint.pathname.endsWith(`/${uploadPath}/upload`)
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
    throw new Error(uploadErrorMessage(raw, response.status, errorContext));
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
    (result as Record<string, unknown>)["resource_type"] !== expectedResponseType
  ) {
    throw new Error("Cloudinary returned an invalid upload response");
  }
  return result as CloudinaryUploadResult;
}
