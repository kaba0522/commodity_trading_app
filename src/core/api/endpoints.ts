import { ENV } from "@/core/config/env";

export const AUTH_ENDPOINTS = {
  requestOtp: "/auth/login",
  verifyOtp: "/auth/verify-otp",
  refresh: "/auth/refresh",
  logout: "/auth/logout",
} as const;

export const TOS_ENDPOINTS = {
  current: "/tos-versions/current",
  accept: "/tos/accept",
  status: "/tos/status",
} as const;

export const USERS_ENDPOINTS = {
  me: "/users/me",
} as const;

export const LISTINGS_ENDPOINTS = {
  create: "/listings",
  bulkPrice: "/listings/bulk-price",
  template: "/listings/template",
  bulkUpload: "/listings/bulk-upload",
  bulkConfirm: "/listings/bulk-confirm",
  /**
   * Backend `GET /listings` (`routes/listings.js` → `listing.service.getListings`):
   * `side` required (`SELL`/`BUY`); `status` comma-separated subset of
   * `active,price_expired,na,withdrawn,traded` (default `active` when omitted);
   * `limit` 1–100 (default 20); `userId` UUID — sellers must NOT pass another
   * seller's id (403), and omitting it defaults to the caller's own rows when
   * the caller holds the side's role (seller→SELL, buyer→BUY).
   */
  list: (
    side: "BUY" | "SELL",
    params?: { status?: string; limit?: number; userId?: string },
  ) => {
    const q = new URLSearchParams({ side });
    if (params?.status) q.set("status", params.status);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.userId) q.set("userId", params.userId);
    return `/listings?${q.toString()}`;
  },
  byId: (id: string) => `/listings/${id}`,
  withdraw: (id: string) => `/listings/${id}/withdraw`,
} as const;

export const FREIGHT_ENDPOINTS = {
  list: (params: {
    page: number;
    limit: number;
    origin?: string;
    destination?: string;
  }) => {
    const query = new URLSearchParams({
      page: String(params.page),
      limit: String(params.limit),
    });
    if (params.origin) query.set("origin", params.origin);
    if (params.destination) query.set("destination", params.destination);
    return `/freight?${query.toString()}`;
  },
} as const;

export const COMMODITY_CATEGORIES_ENDPOINTS = {
  // Backend paginates (default 20, max 100) — take the max so dropdowns never truncate.
  list: "/commodity-categories?limit=100",
} as const;

export const COMMODITIES_ENDPOINTS = {
  // Same pagination rule as categories; categoryId scopes the list server-side.
  list: (categoryId?: string) => {
    const q = new URLSearchParams({ limit: "100" });
    if (categoryId) q.set("categoryId", categoryId);
    return `/commodities?${q.toString()}`;
  },
} as const;

export function apiUrl(path: string): string {
  return `${ENV.apiUrl}${path}`;
}
