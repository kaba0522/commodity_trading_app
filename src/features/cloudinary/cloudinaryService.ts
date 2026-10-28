import { v2 as cloudinary } from "cloudinary";
import crypto from "crypto";

// Cloudinary configuration from env vars
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

/**
 * Generate a Cloudinary signed URL for direct upload.
 * POST /cloudinary/upload-url
 * 
 * Request body: { "resourceType": "image" } | { "resourceType": "video" }
 * 
 * Response: { uploadUrl, apiKey, signature, timestamp, folder, allowed_formats }
 */
export async function generateCloudinarySignUrl(
  resourceType: "image" | "video"
): Promise<{
  success: boolean;
  data?: {
    uploadUrl: string;
    apiKey: string;
    signature: string;
    timestamp: number;
    folder: string;
    allowed_formats: string;
  };
  error?: string;
}> {
  try {
    const timestamp = Math.round(Date.now() / 1000);

    // Generate signature for Cloudinary direct upload
    // Cloudinary expects: signature = sha256(timestamp + api_secret) 
    // But for unsigned uploads with upload preset, we use a different approach
    // Actually, Cloudinary's direct signed upload uses:
    // - api_key, timestamp, signature, folder, resource_type, etc.
    // The signature is: sha256(timestamp + api_secret) for simple cases
    
    // Let's use Cloudinary's built-in unsigned upload preset approach,
    // but since we need per-user folders, we'll sign manually
    
    // Generate the signature
    const signature = crypto
      .createHash("sha256")
      .update(`timestamp=${timestamp}&folder=${resourceType}`)
      .digest("hex");

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
    const apiKey = process.env.CLOUDINARY_API_KEY || "";
    const uploadPreset = `commodity-trading-${resourceType}`;

    // Build the upload URL
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

    // Folder format: listings/<userId> - will be set by the client from auth
    // For now, use a placeholder; the actual userId will be injected per-request
    const folder = `listings/placeholder`;

    // Allowed formats based on resource type
    const allowedFormats = resourceType === "image"
      ? "jpg,jpeg,png,webp"
      : "mp4,mov,webm";

    return {
      success: true,
      data: {
        uploadUrl,
        apiKey,
        signature,
        timestamp,
        folder,
        allowed_formats: allowedFormats,
      },
    };
  } catch (error: any) {
    console.error("Cloudinary sign URL error:", error);
    return {
      success: false,
      error: "Failed to generate Cloudinary signed URL",
    };
  }
}

/**
 * Backend route handler for POST /cloudinary/upload-url
 * This can be used with Express, Fastify, or any Node.js web framework.
 */
export const cloudinarySignUrlHandler = async (
  req: any,
  res: any
) => {
  try {
    const { resourceType } = req.body;

    if (!resourceType || (resourceType !== "image" && resourceType !== "video")) {
      return res.status(400).json({
        success: false,
        error: "resourceType must be one of: image, video",
      });
    }

    const result = await generateCloudinarySignUrl(resourceType);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || "Failed to generate Cloudinary signed URL",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error: any) {
    console.error("Cloudinary sign URL handler error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};