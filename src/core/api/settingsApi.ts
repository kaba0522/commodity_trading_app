import { ApiError, apiFetch } from "@/core/api/client";
import { apiUrl, SETTINGS_ENDPOINTS } from "@/core/api/endpoints";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function unwrapSetting(value: unknown): Record<string, unknown> {
  const root = asRecord(value);
  const data = asRecord(root?.["data"]);
  return data ?? root ?? {};
}

function parsePriceExpiryTime(value: unknown): string | null {
  if (typeof value === "string") {
    const directTime = value.trim();
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(directTime)) return directTime;
    try {
      return parsePriceExpiryTime(JSON.parse(directTime) as unknown);
    } catch {
      return null;
    }
  }
  const settingValue = asRecord(value);
  if (settingValue) {
    return parsePriceExpiryTime(
      settingValue["time"] ?? settingValue["value"],
    );
  }
  return null;
}

/** Reads the platform's configured daily price-expiry time (`HH:mm`). */
async function getPriceExpiryTime(token: string): Promise<string> {
  const raw = await apiFetch<unknown>(
    apiUrl(SETTINGS_ENDPOINTS.byKey("price_expiry_time")),
    { token },
  );
  const setting = unwrapSetting(raw);
  const nestedSetting = asRecord(setting["setting"]) ?? setting;
  const configuredTime = parsePriceExpiryTime(nestedSetting["value"]);
  if (!configuredTime) {
    throw new ApiError(502, "The server returned an invalid price expiry time.");
  }
  return configuredTime;
}

export const settingsApi = {
  getPriceExpiryTime,
};
