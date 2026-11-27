import { ApiError, apiFetch } from "@/core/api/client";
import { BROKERS_ENDPOINTS, apiUrl } from "@/core/api/endpoints";
import type { TradeRecord } from "@/types/domain";
import { normalizeTrade } from "./tradesApi";

/** §22 / §22B — broker directory, broker-scoped trades and commissions. */

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

function envelope(raw: unknown): Obj {
  if (!isObj(raw)) return {};
  return isObj(raw["data"]) ? obj(raw["data"]) : raw;
}

function rows(raw: unknown): Obj[] {
  const data = envelope(raw);
  if (Array.isArray(data["data"])) return data["data"].filter(isObj);
  if (Array.isArray(data["rows"])) return data["rows"].filter(isObj);
  for (const key of ["brokers", "options", "items", "results"]) {
    if (Array.isArray(data[key])) return data[key].filter(isObj);
  }
  return [];
}

export interface BrokerOption {
  id: string;
  name: string;
  firmName?: string;
  phone?: string;
  commissionRate?: number;
}

export function normalizeBrokerOption(raw: unknown): BrokerOption | null {
  const broker = obj(raw);
  const user = obj(broker["user"]);
  const id =
    text(broker, "id", "userId") || text(user, "id") || text(broker, "brokerId");
  const name =
    text(broker, "name", "fullName", "firmName") ||
    text(user, "name", "fullName", "firmName");
  if (!id || !name) return null;
  return {
    id,
    name,
    firmName: text(broker, "firmName") || text(user, "firmName") || undefined,
    phone: text(broker, "phone") || text(user, "phone") || undefined,
    commissionRate:
      number(broker, "commissionRate") ?? number(user, "commissionRate") ?? undefined,
  };
}

export interface BrokerCommission {
  id: string;
  tradeId: string;
  amount: number;
  rate?: number;
  status?: string;
  createdAt?: string;
}

function normalizeCommission(raw: unknown): BrokerCommission | null {
  const record = obj(raw);
  const id = text(record, "id");
  const tradeId = text(record, "tradeId") || text(obj(record["trade"]), "id");
  const amount = number(record, "amount", "commission");
  if (!id || !tradeId || amount === null) return null;
  return {
    id,
    tradeId,
    amount,
    rate: number(record, "rate", "commissionRate") ?? undefined,
    status: text(record, "status") || undefined,
    createdAt: text(record, "createdAt") || undefined,
  };
}

export const brokersApi = {
  /** GET /brokers/options — buyer's broker picker on an agreed trade. */
  async options(token: string): Promise<BrokerOption[]> {
    const raw = await apiFetch<unknown>(apiUrl(BROKERS_ENDPOINTS.options), { token });
    return rows(raw).map(normalizeBrokerOption).filter((b): b is BrokerOption => b !== null);
  },

  /** GET /brokers/me/trades — broker workspace. */
  async myTrades(
    token: string,
    params?: { status?: "confirmed" | "cancelled"; limit?: number },
  ): Promise<TradeRecord[]> {
    const raw = await apiFetch<unknown>(apiUrl(BROKERS_ENDPOINTS.myTrades(params)), {
      token,
    });
    return rows(raw).map(normalizeTrade).filter((t): t is TradeRecord => t !== null);
  },

  /** GET /brokers/me/trades/:id — broker-scoped trade detail. */
  async myTradeById(id: string, token: string): Promise<TradeRecord> {
    const raw = await apiFetch<unknown>(apiUrl(BROKERS_ENDPOINTS.myTradeById(id)), {
      token,
    });
    const trade = normalizeTrade(raw);
    if (!trade) throw new ApiError(502, "The server returned an unsupported trade format.");
    return trade;
  },

  /** GET /brokers/:id/commissions — broker earnings ledger. */
  async commissions(brokerId: string, token: string): Promise<BrokerCommission[]> {
    const raw = await apiFetch<unknown>(apiUrl(BROKERS_ENDPOINTS.commissions(brokerId)), {
      token,
    });
    return rows(raw)
      .map(normalizeCommission)
      .filter((c): c is BrokerCommission => c !== null);
  },
};
