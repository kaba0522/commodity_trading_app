const raw = (process.env.EXPO_PUBLIC_API_URL ?? "").trim();

export const ENV = {
  /** Base URL for the backend API. */
  apiUrl: raw || "https://api.example.com",
  /** Cloudinary configuration */
  cloudinary:
    process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME != null
      ? {
          cloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME,
          apiKey: process.env.EXPO_PUBLIC_CLOUDINARY_API_KEY,
          apiSecret: process.env.EXPO_PUBLIC_CLOUDINARY_API_SECRET,
        }
      : null,
} as const;
