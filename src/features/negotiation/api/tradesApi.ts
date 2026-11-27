import { ApiError, apiFetch } from "@/core/api/client";
import { TRADES_ENDPOINTS, apiUrl } from "@/core/api/endpoints";
import type { TradeRecord } from "@/types/domain";

/**
 * §22C Trades API. Trades are created by accept / buy-now / price-drop
 * auto-close. The buyer picks the broker once via PATCH /trades/:id/broker.
 */

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function obj(value: unknown): Obj {
  return isObj(value) ? value : {};
}

function text(record: Obj, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function number(record: Obj, ...keys: string[]): number | null {
  for (const key of keys) {
    const raw = record[key];
    const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function partyName(...values: unknown[]): string {
  for (const value of values) {
    if (!isObj(value)) continue;
    const name = text(value, "firmName", "name", "fullName", "buyerName", "sellerName");
    if (name) return name;
  }
  return "";
}

function envelope(raw: unknown): Obj {
  if (!isObj(raw)) return {};
  return isObj(raw["data"]) ? obj(raw["data"]) : raw;
}

function tradePayload(raw: unknown): Obj {
  const data = envelope(raw);
  for (const key of ["trade", "item", "negotiation"]) {
    if (isObj(data[key]) && text(obj(data[key]), "id")) return obj(data[key]);
  }
  return data;
}

function listRows(raw: unknown): Obj[] {
  const data = envelope(raw);
  if (Array.isArray(data["data"])) return data["data"].filter(isObj);
  if (Array.isArray(data["rows"])) return data["rows"].filter(isObj);
  for (const key of ["trades", "items", "results"]) {
    if (Array.isArray(data[key])) return data[key].filter(isObj);
  }
  return [];
}

/** Backend trade → the app's `TradeRecord`; returns null for unusable rows. */
export function normalizeTrade(raw: unknown): TradeRecord | null {
  const trade = tradePayload(raw);
  const id = text(trade, "id");
  if (!id) return null;

  const listing = obj(trade["listing"]);
  const buyer = obj(trade["buyer"]);
  const seller = obj(trade["seller"]);
  const broker = obj(trade["broker"]);
  const commission = obj(trade["commission"]);

  return {
    id,
    negotiationId:
      text(trade, "negotiationId") || text(obj(trade["negotiation"]), "id") || undefined,
    listingId: text(trade, "listingId") || text(listing, "id") || undefined,
    buyerId: text(trade, "buyerId") || text(buyer, "id") || undefined,
    sellerId: text(trade, "sellerId") || text(seller, "id") || undefined,
    buyer: partyName(buyer) || text(trade, "buyerName") || partyName(trade) || "Buyer",
    seller:
      partyName(seller) || text(trade, "sellerName") || partyName(trade) || "Seller",
    item:
      text(trade, "item", "itemName") ||
      text(listing, "itemName", "item", "name") ||
      "Trade",
    category:
      text(obj(listing["category"]), "name") ||
      text(trade, "category", "categoryName") ||
      undefined,
    price: number(trade, "finalPrice", "price", "agreedPrice") ?? 0,
    bags:
      number(trade, "quantityBags", "bags", "bagsRequested") ??
      number(listing, "quantityBags") ??
      0,
    status: text(trade, "status", "tradeStatus") || "confirmed",
    brokerId: text(trade, "brokerId") || text(broker, "id") || undefined,
    brokerName:
      text(trade, "brokerName") || partyName(broker) || text(broker, "name") || undefined,
    brokerPending:
      trade["brokerPending"] === true || trade["buyerCanChooseBroker"] === true,
    buyerCanChooseBroker: trade["buyerCanChooseBroker"] === true,
    confirmedAt: text(trade, "confirmedAt") || undefined,
    createdAt: text(trade, "createdAt") || undefined,
    commission:
      number(trade, "commissionAmount") ?? number(commission, "amount") ?? undefined,
    commissionRate:
      number(trade, "commissionRate") ?? number(commission, "rate") ?? undefined,
  };
}

function tradeFrom(raw: unknown): TradeRecord {
  const trade = normalizeTrade(raw);
  if (!trade) throw new ApiError(502, "The server returned an unsupported trade format.");
  return trade;
}

export interface ChooseBrokerInput {
  /** Backend broker user id. Use `isSelf` when no broker is involved. */
  brokerId?: string;
  /** Buyer acts as their own broker. */
  isSelf?: boolean;
}

export interface CommissionInput {
  commission: number;
  commissionRate?: number;
}

export const tradesApi = {
  /** GET /trades/me — caller's trades. */
  async mine(
    token: string,
    params?: { status?: "confirmed" | "cancelled"; limit?: number },
  ): Promise<TradeRecord[]> {
    const raw = await apiFetch<unknown>(apiUrl(TRADES_ENDPOINTS.mine(params)), { token });
    return listRows(raw).map(normalizeTrade).filter((t): t is TradeRecord => t !== null);
  },

  /** GET /trades/:id — one trade, used by the broker-selection screen. */
  async byId(id: string, token: string): Promise<TradeRecord> {
    const raw = await apiFetch<unknown>(apiUrl(TRADES_ENDPOINTS.byId(id)), { token });
    return tradeFrom(raw);
  },

  /** PATCH /trades/:id/broker — buyer only, once. */
  async chooseBroker(id: string, input: ChooseBrokerInput, token: string): Promise<TradeRecord> {
    const body: Obj = input.isSelf
      ? // Different deployments model "no broker" in one of these three ways.
        { brokerId: null, isSelf: true, self: true }
      : { brokerId: input.brokerId };
    const raw = await apiFetch<unknown>(apiUrl(TRADES_ENDPOINTS.chooseBroker(id)), {
      method: "PATCH",
      token,
      body,
    });
    return tradeFrom(raw);
  },

  /** POST /trades/:id/cancel — buyer/seller/admin, depending on status. */
  async cancel(id: string, token: string): Promise<TradeRecord> {
    const raw = await apiFetch<unknown>(apiUrl(TRADES_ENDPOINTS.cancel(id)), {
      method: "POST",
      token,
    });
    return tradeFrom(raw);
  },

  /** PATCH /trades/:id/commission — admin/broker, when commission is revised. */
  async updateCommission(
    id: string,
    input: CommissionInput,
    token: string,
  ): Promise<TradeRecord> {
    const raw = await apiFetch<unknown>(apiUrl(TRADES_ENDPOINTS.commission(id)), {
      method: "PATCH",
      token,
      body: { ...input },
    });
    return tradeFrom(raw);
  },

  /** GET /trades — admin listing with arbitrary filters. */
  async adminList(
    params: Record<string, string | number | boolean>,
    token: string,
  ): Promise<TradeRecord[]> {
    const raw = await apiFetch<unknown>(apiUrl(TRADES_ENDPOINTS.adminList(params)), { token });
    return listRows(raw).map(normalizeTrade).filter((t): t is TradeRecord => t !== null);
  },
};
