import { ApiError, apiFetch } from "@/core/api/client";
import { LISTINGS_ENDPOINTS, apiUrl } from "@/core/api/endpoints";
import type { BuyerRequirement, Category, ListingStatus } from "@/types/domain";

/** Seller browse source (Seller App.html `isRequirements`). */

function pickString(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v !== null && typeof v === "object") {
      const nested = v as Record<string, unknown>;
      for (const key of [
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
        "item",
      ]) {
        const value = nested[key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
    }
  }
  return "";
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

function unwrapList(raw: unknown): Record<string, unknown>[] {
  const pick = (
    obj: Record<string, unknown>,
  ): Record<string, unknown>[] | null => {
    for (const k of ["items", "results", "listings", "rows"]) {
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

function unwrapOne(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") {
    const root = raw as Record<string, unknown>;
    const inner = root["data"];
    if (inner !== null && typeof inner === "object") {
      const nested = inner as Record<string, unknown>;
      // Accept `{ data: { listing } }` as well as `{ data: {...fields} }`.
      for (const k of ["listing", "requirement", "item"]) {
        const v = nested[k];
        if (v !== null && typeof v === "object")
          return v as Record<string, unknown>;
      }
      return nested;
    }
    for (const k of ["listing", "requirement", "item"]) {
      const v = root[k];
      if (v !== null && typeof v === "object")
        return v as Record<string, unknown>;
    }
    return root;
  }
  return {};
}

function toId(v: unknown): string | number | null {
  if (typeof v === "string" && v.trim()) return v;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

/** Coerce one BUY-side listing into the Seller requirements row shape. */
function normalizeRequirement(
  obj: Record<string, unknown>,
  categoryMaps?: {
    categoryById: ReadonlyMap<string, string>;
    commodityToCategory: ReadonlyMap<string, string>;
  },
): BuyerRequirement | null {
  const id =
    toId(obj["id"]) ??
    toId(obj["_id"]) ??
    toId(obj["requirementId"]) ??
    toId(obj["reqId"]) ??
    toId(obj["listingId"]) ??
    toId(obj["requirement_id"]) ??
    toId(obj["listing_id"]) ??
    toId(obj["uuid"]);
  // Backend derives `itemName` from the commodity — prefer it first.
  const item = pickString(
    obj,
    "itemName",
    "item_name",
    "item",
    "commodity",
    "commodityName",
    "commodity_name",
    "productName",
    "product_name",
    "name",
    "title",
    "product",
  );
  if (id == null || !item) return null;
  const rawCategory = obj["category"];
  const categoryObject =
    rawCategory !== null && typeof rawCategory === "object"
      ? (rawCategory as Record<string, unknown>)
      : null;
  const directCategoryName =
    pickString(obj, "categoryName", "category_name", "categoryLabel") ||
    (categoryObject
      ? pickString(categoryObject, "name", "title", "label")
      : "") ||
    (typeof rawCategory === "string" &&
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(rawCategory)
      ? rawCategory
      : "");
  const categoryId =
    toId(obj["categoryId"]) ??
    toId(obj["category_id"]) ??
    toId(categoryObject?.["id"]) ??
    toId(categoryObject?.["_id"]) ??
    (typeof rawCategory === "string" ? toId(rawCategory) : null);
  const commodity = obj["commodity"];
  const commodityObject =
    commodity !== null && typeof commodity === "object"
      ? (commodity as Record<string, unknown>)
      : null;
  const commodityId =
    toId(obj["commodityId"]) ??
    toId(obj["commodity_id"]) ??
    (commodityObject
      ? toId(commodityObject["id"] ?? commodityObject["_id"])
      : null);
  const commodityCategory = commodityObject?.["category"];
  const nestedCommodityCategory =
    commodityCategory !== null && typeof commodityCategory === "object"
      ? (commodityCategory as Record<string, unknown>)
      : null;
  const nestedCommodityCategoryId =
    toId(nestedCommodityCategory?.["id"]) ??
    toId(nestedCommodityCategory?.["_id"]) ??
    (typeof commodityCategory === "string"
      ? toId(commodityCategory)
      : null);
  const nestedCommodityCategoryName =
    (nestedCommodityCategory
      ? pickString(nestedCommodityCategory, "name", "title", "label")
      : "") ||
    (typeof commodityCategory === "string" &&
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(commodityCategory)
      ? commodityCategory
      : "");
  const categoryName =
    (categoryId
      ? categoryMaps?.categoryById.get(String(categoryId))
      : undefined) ||
    (nestedCommodityCategoryId
      ? categoryMaps?.categoryById.get(String(nestedCommodityCategoryId))
      : undefined) ||
    (commodityId
      ? categoryMaps?.commodityToCategory.get(String(commodityId))
      : undefined) ||
    directCategoryName ||
    nestedCommodityCategoryName ||
    "Uncategorized";
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
  return {
    // Keep the backend id verbatim (UUID string or number). Coercing with
    // `Number(id)` collapses every UUID to 0 → duplicate React keys and
    // every row opening the same detail.
    id,
    ...(categoryId != null ? { categoryId: String(categoryId) } : {}),
    ...(commodityId != null ? { commodityId: String(commodityId) } : {}),
    category: categoryName as Category,
    item,
    buyer:
      pickString(
        obj,
        "buyer",
        "buyerName",
        "postedBy",
        "buyerFirm",
        "buyerCompany",
        "buyer_company",
        "customer",
        "firmName",
        "firm",
        "company",
        "companyName",
        "company_name",
        "shopName",
        "createdBy",
        "created_by",
        "user",
        "owner",
        "userName",
        "user_name",
      ) || "Unknown buyer",
    paymentTerms: pickString(
      obj,
      "paymentTerms",
      "paymentTerm",
      "payment",
      "terms",
      "payTerms",
      "paymentTermsText",
      "payment_terms",
    ) || String(pickNumber(obj, "paymentTerms", "payment_terms") ?? ""),
    targetPrice:
      pickNumber(
        obj,
        "targetPrice",
        "targetPricePerBag",
        "target_price",
        "expectedPrice",
        "expectedPricePerBag",
        "expected_price",
        "bidPrice",
        "offerPrice",
        "pricePerBag",
        "price_per_bag",
        "price",
      ) ?? 0,
    bags:
      pickNumber(
        obj,
        "bags",
        "quantity",
        "quantityBags",
        "quantityInBags",
        "quantity_in_bags",
        "bagCount",
        "bag_count",
        "numberOfBags",
        "noOfBags",
        "qtyBags",
        "qty",
      ) ?? 0,
    quality: pickString(obj, "quality", "qualityGrade", "quality_grade"),
    weightKg: pickNumber(obj, "weightKg", "weight_kg", "weight") ?? undefined,
    location: pickString(
      obj,
      "location",
      "deliveryLocation",
      "delivery_location",
    ),
    notes: pickString(obj, "notes", "note", "description"),
    status,
    createdAt: pickString(obj, "createdAt", "created_at", "postedAt", "posted_at"),
  };
}

/** Buyer post-requirement input — price is intentionally excluded for BUY. */
export interface CreateRequirementInput {
  categoryId: string;
  commodityId: string;
  quantityBags: number;
  quality?: string | null;
  weightKg?: number | null;
  paymentTerms?: number | null;
  location?: string | null;
  notes?: string | null;
}

export interface UpdateRequirementInput {
  quantityBags: number;
}

export const requirementsApi = {
  /**
   * POST `/listings` with `side: "BUY"` — post a buyer requirement.
   * `itemName` is derived server-side from the commodity; optional details
   * are sent when provided. BUY price is always excluded.
   */
  async create(
    input: CreateRequirementInput,
    token: string,
  ): Promise<BuyerRequirement> {
    const body: Record<string, unknown> = {
      side: "BUY",
      categoryId: input.categoryId,
      commodityId: input.commodityId,
      quantityBags: input.quantityBags,
    };
    if (input.quality) body["quality"] = input.quality;
    if (input.weightKg != null) body["weightKg"] = input.weightKg;
    if (input.paymentTerms != null) body["paymentTerms"] = input.paymentTerms;
    if (input.location) body["location"] = input.location;
    if (input.notes) body["notes"] = input.notes;
    const raw = await apiFetch<unknown>(apiUrl(LISTINGS_ENDPOINTS.create), {
      method: "POST",
      token,
      body,
    });
    const requirement = normalizeRequirement(unwrapOne(raw));
    if (!requirement) {
      throw new ApiError(
        502,
        "The server returned this requirement in an unsupported format.",
      );
    }
    return requirement;
  },

  /**
   * PATCH `/listings/:id` with only the changed BUY-side fields.
   */
  async update(
    id: string | number,
    input: UpdateRequirementInput,
    token: string,
  ): Promise<BuyerRequirement> {
    const raw = await apiFetch<unknown>(
      apiUrl(LISTINGS_ENDPOINTS.byId(String(id))),
      {
        method: "PATCH",
        token,
        body: input,
      },
    );
    const requirement = normalizeRequirement(unwrapOne(raw));
    if (!requirement) {
      throw new ApiError(
        502,
        "The server returned this updated requirement in an unsupported format.",
      );
    }
    return requirement;
  },

  /**
   * `GET /listings?side=BUY`.
   * - Seller market browse: omit `status` (backend default `active` — the
   *   only status cross-role browsing may see; anything else is 403).
   * - Buyer "my requirements": pass `status: "active,price_expired"` — the
   *   backend defaults `userId` to the caller for the buyer role (own rows
   *   only) and allows own non-active statuses.
   * `limit=100` (backend max, default 20) so neither list truncates.
   */
  async list(
    token: string,
    params?: {
      status?: string;
      limit?: number;
      categoryById?: ReadonlyMap<string, string>;
      commodityToCategory?: ReadonlyMap<string, string>;
    },
  ): Promise<BuyerRequirement[]> {
    const raw = await apiFetch<unknown>(
      apiUrl(
        LISTINGS_ENDPOINTS.list("BUY", {
          limit: params?.limit ?? 100,
          ...(params?.status ? { status: params.status } : {}),
        }),
      ),
      { token },
    );
    const records = unwrapList(raw);
    const categoryMaps = {
      categoryById: params?.categoryById ?? new Map<string, string>(),
      commodityToCategory:
        params?.commodityToCategory ?? new Map<string, string>(),
    };
    const requirements = records
      .map((record) => normalizeRequirement(record, categoryMaps))
      .filter(
        (requirement): requirement is BuyerRequirement => requirement !== null,
      );

    if (__DEV__ && requirements.length !== records.length) {
      const unmapped = records.filter(
        (record) => normalizeRequirement(record) === null,
      );
      console.warn("[requirements] Some BUY listings could not be mapped", {
        received: records.length,
        mapped: requirements.length,
        unmappedFields: unmapped.map((record) => Object.keys(record)),
      });
    }
    if (records.length > 0 && requirements.length === 0) {
      throw new ApiError(
        502,
        "The server returned buyer requirements in an unsupported format.",
      );
    }
    return requirements;
  },

  /**
   * PATCH `/listings/:id/withdraw` — close one of your own requirements.
   * Works for BUY requirements too (backend only checks ownership).
   */
  async withdraw(id: string | number, token: string): Promise<void> {
    await apiFetch<unknown>(apiUrl(LISTINGS_ENDPOINTS.withdraw(String(id))), {
      method: "PATCH",
      token,
    });
  },

  /**
   * GET `/listings/:id` — single buyer-requirement detail
   * (backend: `router.get('/:id', listingController.getById)`).
   */
  async getById(
    id: string,
    token: string,
    categoryMaps?: {
      categoryById?: ReadonlyMap<string, string>;
      commodityToCategory?: ReadonlyMap<string, string>;
    },
  ): Promise<BuyerRequirement> {
    const raw = await apiFetch<unknown>(apiUrl(LISTINGS_ENDPOINTS.byId(id)), {
      token,
    });
    const requirement = normalizeRequirement(unwrapOne(raw), {
      categoryById: categoryMaps?.categoryById ?? new Map<string, string>(),
      commodityToCategory:
        categoryMaps?.commodityToCategory ?? new Map<string, string>(),
    });
    if (!requirement) {
      throw new ApiError(
        502,
        "The server returned this requirement in an unsupported format.",
      );
    }
    return requirement;
  },
};
