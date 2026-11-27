import { apiFetch } from "@/core/api/client";
import { NOTIFICATIONS_ENDPOINTS, apiUrl } from "@/core/api/endpoints";

/** §22E — admin notification outbox (no end-user screen yet). */

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export interface NotificationRecord {
  id: string;
  userId?: string;
  channel?: string;
  template?: string;
  status?: string;
  error?: string;
  createdAt?: string;
}

function normalize(raw: unknown): NotificationRecord | null {
  if (!isObj(raw)) return null;
  const id = raw["id"];
  if (typeof id !== "string" && typeof id !== "number") return null;
  return {
    id: String(id),
    userId: typeof raw["userId"] === "string" ? raw["userId"] : undefined,
    channel: typeof raw["channel"] === "string" ? raw["channel"] : undefined,
    template: typeof raw["template"] === "string" ? raw["template"] : undefined,
    status: typeof raw["status"] === "string" ? raw["status"] : undefined,
    error: typeof raw["error"] === "string" ? raw["error"] : undefined,
    createdAt: typeof raw["createdAt"] === "string" ? raw["createdAt"] : undefined,
  };
}

function rows(raw: unknown): Obj[] {
  if (!isObj(raw)) return [];
  const data = isObj(raw["data"]) ? raw["data"] : raw;
  for (const key of ["data", "rows", "notifications", "items", "results"]) {
    if (Array.isArray(data[key])) return data[key].filter(isObj);
  }
  return [];
}

export const notificationsApi = {
  async list(
    params: Record<string, string | number | boolean>,
    token: string,
  ): Promise<NotificationRecord[]> {
    const raw = await apiFetch<unknown>(apiUrl(NOTIFICATIONS_ENDPOINTS.list(params)), {
      token,
    });
    return rows(raw).map(normalize).filter((n): n is NotificationRecord => n !== null);
  },

  async failed(token: string): Promise<NotificationRecord[]> {
    const raw = await apiFetch<unknown>(apiUrl(NOTIFICATIONS_ENDPOINTS.failed), { token });
    return rows(raw).map(normalize).filter((n): n is NotificationRecord => n !== null);
  },
};
