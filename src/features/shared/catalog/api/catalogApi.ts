import { apiFetch } from "@/core/api/client";
import { COMMODITIES_ENDPOINTS, COMMODITY_CATEGORIES_ENDPOINTS, apiUrl } from "@/core/api/endpoints";

/** Commodity category row (GET `/commodity-categories` → `{ id, name }`). */
export interface CatalogCategory {
  id: string;
  name: string;
}

/** Commodity row (GET `/commodities` → `{ id, name, categoryId }`). */
export interface CatalogCommodity {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
}

function toId(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function unwrapList(raw: unknown): unknown[] {
  const pick = (obj: Record<string, unknown>): unknown[] | null => {
    for (const k of ["items", "results", "commodities", "categories", "rows"]) {
      const v = obj[k];
      if (Array.isArray(v)) return v;
    }
    return null;
  };
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const root = raw as Record<string, unknown>;
    const inner = root["data"];
    if (Array.isArray(inner)) return inner;
    if (inner !== null && typeof inner === "object") {
      const fromInner = pick(inner as Record<string, unknown>);
      if (fromInner) return fromInner;
    }
    const fromRoot = pick(root);
    if (fromRoot) return fromRoot;
  }
  return [];
}

function displayName(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["name", "title", "label", "category"]) {
      const n = o[k];
      if (typeof n === "string" && n.trim()) return n.trim();
    }
  }
  return null;
}

/** Real backend catalog APIs — no dummy data. */
export const catalogApi = {
  /** GET `/commodity-categories` — `{ id (UUID), name }` rows. */
  async getCommodityCategories(token: string): Promise<CatalogCategory[]> {
    const raw = await apiFetch<unknown>(apiUrl(COMMODITY_CATEGORIES_ENDPOINTS.list), { token });
    const out: CatalogCategory[] = [];
    const seen = new Set<string>();
    for (const entry of unwrapList(raw)) {
      if (entry === null || typeof entry !== "object") continue;
      const o = entry as Record<string, unknown>;
      const id = toId(o["id"] ?? o["_id"]);
      const name = displayName(o["name"]);
      if (!id || !name || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, name });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  },

  /**
   * GET `/commodities[?categoryId=]` — `{ id (UUID), name, categoryId }` rows.
   * Pass `categoryId` to list only commodities in that category.
   */
  async getCommodities(token: string, categoryId?: string): Promise<CatalogCommodity[]> {
    const raw = await apiFetch<unknown>(
      apiUrl(COMMODITIES_ENDPOINTS.list(categoryId)),
      { token },
    );
    const out: CatalogCommodity[] = [];
    const seen = new Set<string>();
    for (const entry of unwrapList(raw)) {
      if (entry === null || typeof entry !== "object") continue;
      const o = entry as Record<string, unknown>;
      const id = toId(o["id"] ?? o["_id"]);
      const name = displayName(o["name"] ?? o["item"] ?? o["title"]);
      const commodityCategoryId =
        toId(o["categoryId"]) ?? toId(o["category_id"]) ?? toId(o["categoryID"]) ?? "";
      const nested = o["category"];
      const categoryName =
        (typeof nested === "object" && nested !== null
          ? displayName((nested as Record<string, unknown>)["name"])
          : null) ??
        displayName(o["categoryName"]) ??
        "";
      if (!id || !name || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, name, categoryId: commodityCategoryId, categoryName });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  },
};
