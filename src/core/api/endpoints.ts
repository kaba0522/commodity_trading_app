import { ENV } from "@/core/config/env";

export const AUTH_ENDPOINTS = {
  requestOtp: "/auth/login",
  verifyOtp: "/auth/verify-otp",
  refresh: "/auth/refresh",
  logout: "/auth/logout",
} as const;

export const CLOUDINARY_ENDPOINTS = {
  signUrl: "/cloudinary/upload-url",
} as const;

export const MEDIA_ENDPOINTS = {
  sign: "/media/sign",
} as const;

export const TOS_ENDPOINTS = {
  current: "/tos-versions/current",
  accept: "/tos/accept",
  status: "/tos/status",
} as const;

export const USERS_ENDPOINTS = {
  me: "/users/me",
} as const;

export const SETTINGS_ENDPOINTS = {
  byKey: (key: string) => `/settings/${encodeURIComponent(key)}`,
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

export const QUALITIES_ENDPOINTS = {
  // Qualities belong to a commodity (not a category). `limit=100` fills dropdowns.
  list: (commodityId: string) => {
    const q = new URLSearchParams({ commodityId, limit: "100" });
    return `/qualities?${q.toString()}`;
  },
} as const;

/** §22D — Negotiation (offers, counters, chat) and its admin on-behalf twins. */
export const NEGOTIATION_ENDPOINTS = {
  start: "/negotiations",
  buyNow: "/negotiations/buy-now",
  byId: (id: string) => `/negotiations/${id}`,
  list: (params: {
    tab?: "active" | "completed";
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params.tab) q.set("tab", params.tab);
    q.set("limit", String(params.limit ?? 100));
    if (params.page) q.set("page", String(params.page));
    return `/negotiations?${q.toString()}`;
  },
  counter: (id: string) => `/negotiations/${id}/counter`,
  accept: (offerId: string) => `/negotiations/offers/${offerId}/accept`,
  decline: (offerId: string) => `/negotiations/offers/${offerId}/decline`,
  withdraw: (id: string) => `/negotiations/${id}/withdraw`,
  messages: (id: string) => `/negotiations/${id}/messages`,
  // Admin acting for a buyer/seller. Body = normal body + onBehalfOfUserId.
  onBehalf: {
    start: "/negotiations/on-behalf",
    counter: (id: string) => `/negotiations/on-behalf/${id}/counter`,
    accept: (offerId: string) =>
      `/negotiations/on-behalf/offers/${offerId}/accept`,
    decline: (offerId: string) =>
      `/negotiations/on-behalf/offers/${offerId}/decline`,
    withdraw: (id: string) => `/negotiations/on-behalf/${id}/withdraw`,
    messages: (id: string) => `/negotiations/on-behalf/${id}/messages`,
  },
} as const;

/** §22C — Trades created by accept / Buy-now / price-drop auto-close. */
export const TRADES_ENDPOINTS = {
  mine: (params?: { status?: "confirmed" | "cancelled"; limit?: number }) => {
    const q = new URLSearchParams({ limit: String(params?.limit ?? 100) });
    if (params?.status) q.set("status", params.status);
    return `/trades/me?${q.toString()}`;
  },
  adminList: (params: Record<string, string | number | boolean>) => {
    const q = new URLSearchParams({ limit: "100" });
    Object.entries(params).forEach(([key, value]) => {
      q.set(key, String(value));
    });
    return `/trades?${q.toString()}`;
  },
  byId: (id: string) => `/trades/${id}`,
  chooseBroker: (id: string) => `/trades/${id}/broker`,
  cancel: (id: string) => `/trades/${id}/cancel`,
  commission: (id: string) => `/trades/${id}/commission`,
} as const;

/** §22 / §22B — brokers used on the trade-accept screen. */
export const BROKERS_ENDPOINTS = {
  options: "/brokers/options",
  myTrades: (params?: { status?: "confirmed" | "cancelled"; limit?: number }) => {
    const q = new URLSearchParams({ limit: String(params?.limit ?? 100) });
    if (params?.status) q.set("status", params.status);
    return `/brokers/me/trades?${q.toString()}`;
  },
  myTradeById: (id: string) => `/brokers/me/trades/${id}`,
  commissions: (brokerId: string) => `/brokers/${brokerId}/commissions`,
} as const;

/** §22E — admin notification outbox (read-only). */
export const NOTIFICATIONS_ENDPOINTS = {
  list: (params: Record<string, string | number | boolean>) => {
    const q = new URLSearchParams({ limit: "100" });
    Object.entries(params).forEach(([key, value]) => {
      q.set(key, String(value));
    });
    return `/notifications?${q.toString()}`;
  },
  failed: "/notifications/failed",
} as const;

export function apiUrl(path: string): string {
  return `${ENV.apiUrl}${path}`;
}
