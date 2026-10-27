import { ApiError, apiFetch } from "@/core/api/client";
import { apiUrl, FREIGHT_ENDPOINTS } from "@/core/api/endpoints";

export interface FreightRoute {
  id: string;
  originName: string;
  destinationName: string;
  priceLow: number | null;
  priceHigh: number | null;
  unit: string;
  truckCapacity: string | null;
  priceValidUntil: string | null;
  status: string;
}

export interface FreightPage {
  data: FreightRoute[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const PAGE_LIMIT = 20;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeRoute(value: unknown): FreightRoute {
  const route = asRecord(value);
  if (
    !route ||
    typeof route["id"] !== "string" ||
    typeof route["originName"] !== "string" ||
    typeof route["destinationName"] !== "string" ||
    typeof route["unit"] !== "string" ||
    typeof route["status"] !== "string"
  ) {
    throw new ApiError(500, "Unexpected freight route returned by the server.");
  }

  return {
    id: route["id"],
    originName: route["originName"],
    destinationName: route["destinationName"],
    priceLow: asOptionalNumber(route["priceLow"]),
    priceHigh: asOptionalNumber(route["priceHigh"]),
    unit: route["unit"],
    truckCapacity: asOptionalString(route["truckCapacity"]),
    priceValidUntil: asOptionalString(route["priceValidUntil"]),
    status: route["status"],
  };
}

function normalizePage(value: unknown): FreightPage {
  const root = asRecord(value);
  const data = root?.["data"];
  const meta = asRecord(root?.["meta"]);
  if (
    !Array.isArray(data) ||
    !meta ||
    typeof meta["page"] !== "number" ||
    typeof meta["limit"] !== "number" ||
    typeof meta["total"] !== "number" ||
    typeof meta["totalPages"] !== "number"
  ) {
    throw new ApiError(500, "Unexpected freight response returned by the server.");
  }
  return {
    data: data.map(normalizeRoute),
    meta: {
      page: meta["page"],
      limit: meta["limit"],
      total: meta["total"],
      totalPages: meta["totalPages"],
    },
  };
}

/** Authenticated, read-only access to the backend freight-rate table. */
export const freightApi = {
  async list(
    token: string,
    params: { page: number; origin?: string; destination?: string },
  ): Promise<FreightPage> {
    const raw = await apiFetch<unknown>(
      apiUrl(
        FREIGHT_ENDPOINTS.list({
          ...params,
          limit: PAGE_LIMIT,
        }),
      ),
      { token },
    );
    return normalizePage(raw);
  },
};
