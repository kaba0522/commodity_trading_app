import { ApiError, apiDownload, apiFetch, apiUpload } from "@/core/api/client";
import {
  COMMODITIES_ENDPOINTS,
  COMMODITY_CATEGORIES_ENDPOINTS,
  LISTINGS_ENDPOINTS,
  apiUrl,
} from "@/core/api/endpoints";
import type { Category, Listing, ListingStatus } from "@/types/domain";

/**
 * Real backend: `router.use(authenticate)` — every call needs the session token.
 * Field names mirror `validateSellListingInput` in the backend
 * (`listing.validation.js`): categoryId/commodityId UUIDs, quantityBags
 * required, weightKg/price optional, quality one of the backend grades.
 */
export interface CreateListingInput {
  categoryId: string;
  commodityId: string;
  quality?: string | null;
  quantityBags: number;
  weightKg?: number | null;
  /** Price per bag in rupees; null = shell listing without price. */
  price?: number | null;
  moisture?: string | null;
  color?: string | null;
  size?: string | null;
  /** Per-listing override in days; null = the firm default applies. */
  paymentTerms?: number | null;
  notes?: string | null;
}

/** Minimal created-listing shape (tolerates `{ success, data }` or flat). */
export interface CreatedListing {
  id: string;
  item: string;
  price: number | null;
}

export interface BulkPriceUpdate {
  listingId: string;
  price: number;
}

/** Backend `parseUploadedWorkbook` preview row (POST /listings/bulk-upload). */
export interface BulkPreviewSuggestion {
  id: string;
  name: string;
  similarity: number;
}

export interface BulkPreviewRow {
  rowIndex: number;
  raw: Record<string, unknown>;
  resolved: {
    categoryId: string | null;
    categoryMatch: "exact" | "fuzzy" | "unresolved";
    categorySuggestion: BulkPreviewSuggestion | null;
    commodityId: string | null;
    commodityMatch: "exact" | "fuzzy" | "unresolved";
    commoditySuggestion: BulkPreviewSuggestion | null;
    itemName: string | null;
    quality: string | null;
    quantityBags: number | null;
    weightKg: number | null;
    price: number | null;
    paymentTerms: number | null;
    notes: string | null;
    moisture: string | null;
    color: string | null;
    size: string | null;
  };
  willUpdateExisting: string | null;
  errors: string[];
  ready: boolean;
}

export interface BulkPreviewResult {
  summary: { totalRows: number; readyRows: number; needsReviewRows: number };
  rows: BulkPreviewRow[];
}

/** One row for POST /listings/bulk-confirm — resolved IDs + validated cells. */
export interface BulkConfirmRow {
  rowIndex?: number;
  categoryId: string;
  commodityId: string;
  quality?: string | null;
  quantityBags: number;
  weightKg?: number | null;
  price?: number | null;
  paymentTerms?: number | null;
  notes?: string | null;
  moisture?: string | null;
  color?: string | null;
  size?: string | null;
}

export interface BulkConfirmResult {
  created: { rowIndex?: number; listingId: string }[];
  updated: { rowIndex?: number; listingId: string }[];
  failed: { rowIndex?: number; reason: string }[];
}

function toPayload(input: CreateListingInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    side: "SELL",
    categoryId: input.categoryId,
    commodityId: input.commodityId,
    quantityBags: input.quantityBags,
  };
  if (input.quality) body["quality"] = input.quality;
  if (input.weightKg != null) body["weightKg"] = input.weightKg;
  if (input.price != null) body["price"] = input.price;
  if (input.moisture) body["moisture"] = input.moisture;
  if (input.color) body["color"] = input.color;
  if (input.size) body["size"] = input.size;
  if (input.paymentTerms) body["paymentTerms"] = input.paymentTerms;
  if (input.notes) body["notes"] = input.notes;
  return body;
}

function toStringId(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v !== null && typeof v === "object") {
      const nested = v as Record<string, unknown>;
      for (const nk of ["name", "title", "label"]) {
        const nv = nested[nk];
        if (typeof nv === "string" && nv.trim()) return nv.trim();
      }
    }
  }
  return "";
}

/** Display name from a string or a nested object (user/firm/commodity/category). */
function nestedName(v: unknown): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of [
      "firmName",
      "firm",
      "company",
      "companyName",
      "shopName",
      "name",
      "fullName",
      "displayName",
      "username",
      "title",
      "label",
    ]) {
      const nv = o[k];
      if (typeof nv === "string" && nv.trim()) return nv.trim();
    }
  }
  return "";
}

/** Seller comes nested as `user: { firmName, name, ... }` — never a flat string. */
function pickSeller(obj: Record<string, unknown>): string {
  for (const k of [
    "seller",
    "sellerName",
    "vendor",
    "firm",
    "firmName",
    "company",
    "companyName",
    "shopName",
  ]) {
    const n = nestedName(obj[k]);
    if (n) return n;
  }
  // Backend nests the seller as `user` (see GET /listings log: `user: [Object]`).
  for (const k of ["user", "owner", "createdBy", "sellerUser", "profile"]) {
    const n = nestedName(obj[k]);
    if (n) return n;
  }
  return "Unknown seller";
}

/** Category: flat `category`, nested `category/commodity` objects, else catalog lookup. */
function pickCategory(
  obj: Record<string, unknown>,
  categoryById?: Map<string, string>,
  commodityToCategory?: Map<string, string>,
): string {
  const rawCategory = obj["category"];
  const direct =
    (typeof rawCategory === "string" ? rawCategory.trim() : "") ||
    (rawCategory !== null && typeof rawCategory === "object"
      ? nestedName(rawCategory)
      : "") ||
    pickString(obj, "categoryName", "category_name", "categoryLabel");
  if (direct) {
    const resolved = categoryById?.get(direct);
    if (resolved) return resolved;
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(direct)) {
      return direct;
    }
  }
  const rawCategoryId =
    rawCategory !== null && typeof rawCategory === "object"
      ? toStringId(
          (rawCategory as Record<string, unknown>)["id"] ??
            (rawCategory as Record<string, unknown>)["_id"],
        )
      : toStringId(rawCategory);
  if (rawCategoryId && categoryById?.has(rawCategoryId)) {
    return categoryById.get(rawCategoryId) ?? "";
  }
  const commodity = obj["commodity"];
  const commodityCategory =
    commodity !== null && typeof commodity === "object"
      ? nestedName((commodity as Record<string, unknown>)["category"])
      : "";
  if (commodityCategory) {
    return categoryById?.get(commodityCategory) ?? commodityCategory;
  }
  if (categoryById || commodityToCategory) {
    const cid = toStringId(obj["categoryId"] ?? obj["category_id"]);
    if (cid && categoryById?.get(cid)) return categoryById.get(cid) as string;
    const mid = toStringId(obj["commodityId"] ?? obj["commodity_id"]);
    if (mid && commodityToCategory?.get(mid))
      return commodityToCategory.get(mid) as string;
  }
  return "";
}

/** Item: backend derives `itemName` from the commodity — prefer it, else catalog. */
function pickItem(
  obj: Record<string, unknown>,
  commodityById?: Map<string, string>,
): string {
  const direct =
    pickString(obj, "itemName", "item_name") ||
    pickString(obj, "item", "title") ||
    nestedName(obj["commodity"]) ||
    pickString(obj, "commodityName", "commodity_name", "productName", "product", "name");
  if (direct) return direct;
  if (commodityById) {
    const mid = toStringId(obj["commodityId"] ?? obj["commodity_id"]);
    if (mid && commodityById.get(mid)) return commodityById.get(mid) as string;
  }
  return "";
}

/** Best-effort catalog maps (categoryId→name, commodityId→name/category) for UUID payloads. */
async function fetchCatalogMaps(token: string): Promise<{
  categoryById: Map<string, string>;
  commodityById: Map<string, string>;
  commodityToCategory: Map<string, string>;
}> {
  const categoryById = new Map<string, string>();
  const commodityById = new Map<string, string>();
  const commodityToCategory = new Map<string, string>();
  try {
    const catRaw = await apiFetch<unknown>(apiUrl(COMMODITY_CATEGORIES_ENDPOINTS.list), { token });
    const catList = unwrapList(catRaw);
    for (const e of catList) {
      if (e && typeof e === "object") {
        const o = e as Record<string, unknown>;
        const id = toStringId(o["id"] ?? o["_id"]);
        const name = typeof o["name"] === "string" ? (o["name"] as string).trim() : "";
        if (id && name) categoryById.set(id, name);
      }
    }
    const comRaw = await apiFetch<unknown>(apiUrl(COMMODITIES_ENDPOINTS.list()), { token });
    const comList = unwrapList(comRaw);
    for (const e of comList) {
      if (e && typeof e === "object") {
        const o = e as Record<string, unknown>;
        const id = toStringId(o["id"] ?? o["_id"]);
        const name = typeof o["name"] === "string" ? (o["name"] as string).trim() : "";
        if (id && name) commodityById.set(id, name);
        const cid = toStringId(o["categoryId"] ?? o["category_id"]);
        const catName =
          (o["category"] && typeof o["category"] === "object"
            ? nestedName(o["category"])
            : "") ||
          (typeof o["categoryName"] === "string" ? String(o["categoryName"]).trim() : "");
        if (id && cid) {
          const resolved = categoryById.get(cid) || catName;
          if (resolved) commodityToCategory.set(id, resolved);
        }
      }
    }
  } catch {
    // Catalog is best-effort — listings still render with embedded names.
  }
  return { categoryById, commodityById, commodityToCategory };
}

function pickNumber(
  obj: Record<string, unknown>,
  ...keys: string[]
): number | null {
  for (const k of keys) {
    const v = obj[k];
    const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
    if (typeof n === "number" && Number.isFinite(n)) return n;
  }
  return null;
}

/** Backend sends `{ success: true, data: ... }`; accept bare payloads too. */
function unwrapOne(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") {
    const root = raw as Record<string, unknown>;
    const inner = root["data"];
    if (inner !== null && typeof inner === "object")
      return inner as Record<string, unknown>;
    return root;
  }
  return {};
}

function unwrapList(raw: unknown): Record<string, unknown>[] {
  const pick = (
    obj: Record<string, unknown>,
  ): Record<string, unknown>[] | null => {
    for (const k of [
      "items",
      "results",
      "listings",
      "categories",
      "commodities",
      "rows",
    ]) {
      const v = obj[k];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
    return null;
  };
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === "object") {
    const root = raw as Record<string, unknown>;
    const inner = root["data"];
    if (Array.isArray(inner)) return inner as Record<string, unknown>[];
    if (inner !== null && typeof inner === "object") {
      const fromInner = pick(inner as Record<string, unknown>);
      if (fromInner) return fromInner;
    }
    const fromRoot = pick(root);
    if (fromRoot) return fromRoot;
  }
  return [];
}

/**
 * Backend-exact owner id (`D:\Tradding_backend\prisma\schema.prisma` model
 * Listing, `listing.service serializeListing` spreads the row verbatim):
 * flat `userId` UUID on every row, plus nested `user.id` on `getById`.
 */
function pickOwnerId(obj: Record<string, unknown>): string | undefined {
  const flat = toStringId(obj["userId"]);
  if (flat) return flat;
  const user = obj["user"];
  if (user !== null && typeof user === "object") {
    const nested = user as Record<string, unknown>;
    const nestedId = toStringId(nested["id"] ?? nested["userId"]);
    if (nestedId) return nestedId;
  }
  return undefined;
}

/**
 * Coerce one backend listing (`listing.service serializeListing` + `user`
 * include) into the app `Listing` shape. Exact backend fields: `id` (uuid),
 * `itemName` (derived from commodity), `quality`, `weightKg`, `price`
 * (number|null), `userId`, `categoryId`/`commodityId` (uuids, resolved via
 * catalog maps), `status` (backend enum), `user: { firmName, name, ... }`.
 */
function normalizeListing(
  obj: Record<string, unknown>,
  maps?: {
    categoryById: Map<string, string>;
    commodityById: Map<string, string>;
    commodityToCategory: Map<string, string>;
  },
): Listing | null {
  const id = toStringId(obj["id"]);
  // Backend `itemName` is always derived from `commodity.name` (create +
  // bulk-confirm); catalog map is only a fallback for stale rows.
  const item = pickItem(obj, maps?.commodityById);
  if (!id || !item) return null;
  const weightKg = pickNumber(obj, "weightKg");
  const weight =
    pickString(obj, "weight", "weightPerBag", "bagWeight") ||
    (weightKg != null ? `${weightKg}KG` : "");
  const seller = pickSeller(obj);
  const category =
    pickCategory(obj, maps?.categoryById, maps?.commodityToCategory) ||
    "Uncategorized";
  // Backend `VALID_STATUSES`: active, price_expired, na, withdrawn, traded
  // (schema also defines `sold_out`). Kept verbatim so the Active/Expired
  // tabs split on the real lifecycle.
  const rawStatus = pickString(obj, "status").toLowerCase();
  const status: ListingStatus | undefined =
    rawStatus === "active" ||
    rawStatus === "price_expired" ||
    rawStatus === "na" ||
    rawStatus === "withdrawn" ||
    rawStatus === "traded" ||
    rawStatus === "sold_out"
      ? rawStatus
      : undefined;
  const sellerId = pickOwnerId(obj);
  const bags = pickNumber(obj, "quantityBags", "bags");
  return {
    id,
    category: category as Category,
    item,
    quality: pickString(obj, "quality"),
    weight,
    seller,
    price: pickNumber(obj, "price") ?? 0,
    paymentTerms: pickNumber(obj, "paymentTerms", "payment_terms"),
    priceValidUntil: pickString(obj, "priceValidUntil", "price_valid_until") || null,
    ...(bags != null ? { bags } : {}),
    ...(status ? { status } : {}),
    ...(sellerId ? { sellerId } : {}),
  } as Listing;
}

function normalizeCreated(raw: unknown): CreatedListing {
  const data = unwrapOne(raw);
  const id = toStringId(data["id"]);
  // Backend derives `itemName` from the commodity — it is never a client input.
  const item = pickItem(data);
  const price = pickNumber(data, "price");
  if (!id || !item) {
    throw new ApiError(500, "Unexpected server response to listing publish.");
  }
  return { id, item, price };
}

/**
 * Active/Expired split for the seller tabs. Backend `status` is the source
 * of truth: only `"active"` is Active; `"price_expired"` and `"na"` (shell
 * listing without price) are Expired. Payloads without a recognized status
 * fall back to the priced rule (`price > 0`).
 */
export function isActiveListing(l: Pick<Listing, "status" | "price">): boolean {
  if (l.status) return l.status === "active";
  return l.price > 0;
}

export const listingsApi = {
  /**
   * Buyer-browse market feed: `GET /listings?side=SELL` (backend default
   * `status=active` is exactly what the market shows). `limit=100` (backend
   * max, default 20) so the market isn't truncated.
   */
  async list(token: string): Promise<Listing[]> {
    const [raw, maps] = await Promise.all([
      apiFetch<unknown>(
        apiUrl(LISTINGS_ENDPOINTS.list("SELL", { limit: 100 })),
        { token },
      ),
      fetchCatalogMaps(token),
    ]);
    const out: Listing[] = [];
    for (const obj of unwrapList(raw)) {
      const l = normalizeListing(obj, maps);
      if (l) out.push(l);
    }
    return out;
  },

  /**
   * Seller dashboard (`add-listing` tab): the logged-in seller's own
   * listings. Backend (`listing.service getListings`): a seller calling with
   * `side=SELL` and NO `userId` gets `effectiveUserId = own id` — own rows
   * only, never pass another seller's `userId` (403). `status` defaults to
   * `active` server-side, so request `active,price_expired,na` explicitly —
   * otherwise the Expired tab is always empty. `limit=100` (backend max,
   * default is 20) so the dashboard isn't truncated.
   */
  async listMine(token: string): Promise<Listing[]> {
    const [raw, maps] = await Promise.all([
      apiFetch<unknown>(
        apiUrl(
          LISTINGS_ENDPOINTS.list("SELL", {
            status: "active,price_expired,na",
            limit: 100,
          }),
        ),
        { token },
      ),
      fetchCatalogMaps(token),
    ]);
    const out: Listing[] = [];
    for (const obj of unwrapList(raw)) {
      const l = normalizeListing(obj, maps);
      if (l) out.push(l);
    }
    return out;
  },

  /** GET `/listings/:id` — single listing detail. */
  async getById(id: string, token: string): Promise<Listing> {
    const [raw, maps] = await Promise.all([
      apiFetch<unknown>(apiUrl(LISTINGS_ENDPOINTS.byId(id)), { token }),
      fetchCatalogMaps(token),
    ]);
    const listing = normalizeListing(unwrapOne(raw), maps);
    if (!listing)
      throw new ApiError(500, "Unexpected server response to listing detail.");
    return listing;
  },

  /** POST `/listings` — publish a seller listing. */
  async create(
    input: CreateListingInput,
    token: string,
  ): Promise<CreatedListing> {
    const raw = await apiFetch<unknown>(apiUrl(LISTINGS_ENDPOINTS.create), {
      method: "POST",
      token,
      body: toPayload(input),
    });
    return normalizeCreated(raw);
  },

  /** PATCH `/listings/:id` — edit price/fields of own listing. */
  async update(
    id: string,
    patch: Partial<CreateListingInput>,
    token: string,
  ): Promise<Listing> {
    const raw = await apiFetch<unknown>(apiUrl(LISTINGS_ENDPOINTS.byId(id)), {
      method: "PATCH",
      token,
      body: patch,
    });
    const listing = normalizeListing(unwrapOne(raw));
    if (!listing)
      throw new ApiError(500, "Unexpected server response to listing update.");
    return listing;
  },

  /** PATCH `/listings/:id/withdraw` — take own listing off the market. */
  async withdraw(id: string, token: string): Promise<void> {
    await apiFetch<unknown>(apiUrl(LISTINGS_ENDPOINTS.withdraw(id)), {
      method: "PATCH",
      token,
    });
  },

  /**
   * PATCH `/listings/bulk-price` — delta mode. Applies the same +/- `value`
   * to `listingIds` atomically server-side (backend `bulkDeltaPrice`).
   * This is what the Bulk edit screen uses — no stale-price race.
   */
  async bulkPriceDelta(
    listingIds: string[],
    value: number,
    token: string,
  ): Promise<void> {
    await apiFetch<unknown>(apiUrl(LISTINGS_ENDPOINTS.bulkPrice), {
      method: "PATCH",
      token,
      body: { mode: "delta", listingIds, value },
    });
  },

  /**
   * PATCH `/listings/bulk-price` — set-many mode. Distinct absolute price
   * per listing (backend `bulkSetManyPrice`, entries keyed by `listingId`).
   */
  async bulkPriceSetMany(
    updates: BulkPriceUpdate[],
    token: string,
  ): Promise<void> {
    await apiFetch<unknown>(apiUrl(LISTINGS_ENDPOINTS.bulkPrice), {
      method: "PATCH",
      token,
      body: { mode: "set-many", updates },
    });
  },

  /**
   * PATCH `/listings/bulk-price` — legacy absolute-price helper.
   * Prefer `bulkPriceDelta` / `bulkPriceSetMany` which match the backend
   * `{ mode }` dispatcher.
   * @deprecated Use bulkPriceSetMany instead.
   */
  async bulkPrice(updates: BulkPriceUpdate[], token: string): Promise<void> {
    return listingsApi.bulkPriceSetMany(updates, token);
  },

  /** GET `/listings/template` — .xlsx with Category/Commodity dropdowns. */
  async downloadTemplate(token: string): Promise<Blob> {
    return apiDownload(apiUrl(LISTINGS_ENDPOINTS.template), { token });
  },

  /**
   * POST `/listings/bulk-upload` — multipart `file` (.xlsx, 5MB max).
   * Returns a row-by-row preview: `ready` rows can go straight to
   * `bulkConfirm`; the rest carry `errors` + fuzzy `suggestion`s.
   * Accepts a web Blob or a native `{ uri, name, mimeType }` file ref —
   * the latter is required on iOS/Android where Blob-from-uri is unreliable.
   */
  async bulkUpload(
    file: Blob | { uri: string; name: string; mimeType?: string },
    fileName: string,
    token: string,
  ): Promise<BulkPreviewResult> {
    const form = new FormData();
    if (typeof Blob !== "undefined" && file instanceof Blob) {
      form.append("file", file, fileName);
    } else {
      const ref = file as { uri: string; name: string; mimeType?: string };
      form.append("file", {
        uri: ref.uri,
        name: ref.name || fileName,
        type:
          ref.mimeType ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      } as unknown as Blob);
    }
    const raw = await apiUpload<unknown>(apiUrl(LISTINGS_ENDPOINTS.bulkUpload), form, {
      token,
      timeoutMs: 60000,
    });
    const data = unwrapOne(raw);
    const summaryRaw = (data["summary"] ?? data) as Record<string, unknown>;
    const rowsRaw = (data["rows"] ?? []) as unknown[];
    const num = (v: unknown): number =>
      typeof v === "number" && Number.isFinite(v) ? v : 0;
    return {
      summary: {
        totalRows: num(summaryRaw["totalRows"] ?? rowsRaw.length),
        readyRows: num(summaryRaw["readyRows"]),
        needsReviewRows: num(
          summaryRaw["needsReviewRows"] ??
            (Array.isArray(rowsRaw) ? rowsRaw.length - num(summaryRaw["readyRows"]) : 0),
        ),
      },
      rows: (Array.isArray(rowsRaw) ? rowsRaw : []) as BulkPreviewRow[],
    };
  },

  /**
   * POST `/listings/bulk-confirm` — publish the reviewed rows. Creates new
   * listings or updates the seller's live duplicate (same
   * category/commodity/weight/quality). Partial success: check `failed`.
   */
  async bulkConfirm(rows: BulkConfirmRow[], token: string): Promise<BulkConfirmResult> {
    const raw = await apiFetch<unknown>(apiUrl(LISTINGS_ENDPOINTS.bulkConfirm), {
      method: "POST",
      token,
      body: { rows },
    });
    const data = unwrapOne(raw);
    const asList = (v: unknown): Record<string, unknown>[] =>
      Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
    return {
      created: asList(data["created"]).map((r) => ({
        rowIndex: typeof r["rowIndex"] === "number" ? (r["rowIndex"] as number) : undefined,
        listingId: String(r["listingId"] ?? ""),
      })),
      updated: asList(data["updated"]).map((r) => ({
        rowIndex: typeof r["rowIndex"] === "number" ? (r["rowIndex"] as number) : undefined,
        listingId: String(r["listingId"] ?? ""),
      })),
      failed: asList(data["failed"]).map((r) => ({
        rowIndex: typeof r["rowIndex"] === "number" ? (r["rowIndex"] as number) : undefined,
        reason: typeof r["reason"] === "string" ? (r["reason"] as string) : "Unknown error",
      })),
    };
  },
};
