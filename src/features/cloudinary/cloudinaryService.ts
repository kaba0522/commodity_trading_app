import { cloudinarySignUrl } from "@/core/api/cloudinary";
import type { CloudinarySignedUrl } from "@/core/api/cloudinary";

export type { CloudinarySignedUrl };

/**
 * @deprecated Use `cloudinarySignUrl` from `@/core/api/cloudinary` directly.
 *
 * Signing must happen on the backend — the app must never contain the
 * Cloudinary API secret. This wrapper only forwards the typed request.
 */
export async function generateCloudinarySignUrl(
  resourceType: "image" | "video",
  token: string,
): Promise<CloudinarySignedUrl> {
  return cloudinarySignUrl({ resourceType }, token);
}
