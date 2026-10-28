export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Pull a human-readable message out of a non-OK response body. */
function extractErrorMessage(raw: string, status: number): string {
  if (!raw) return `Request failed (${status})`;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "string") return parsed || `Request failed (${status})`;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      for (const key of ["message", "error", "detail", "msg"]) {
        const v = obj[key];
        if (typeof v === "string" && v.trim()) return v;
        // Server shape: { success: false, error: { code, message } }
        if (v !== null && typeof v === "object") {
          const nested = (v as Record<string, unknown>)["message"];
          if (typeof nested === "string" && nested.trim()) return nested;
        }
      }
      const errors = obj["errors"];
      if (Array.isArray(errors) && typeof errors[0] === "string") return errors[0];
      if (Array.isArray(errors) && errors[0] && typeof errors[0] === "object") {
        const first = (errors[0] as Record<string, unknown>)["message"];
        if (typeof first === "string" && first.trim()) return first;
      }
    }
  } catch {
    // Not JSON — fall through. Strip HTML tags so server error pages stay readable.
    const text = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (text) return text.slice(0, 200);
  }
  return `Request failed (${status})`;
}

/** True when the server rejected the access token (expired/invalid). */
export function isUnauthorizedError(e: unknown): boolean {
  return e instanceof ApiError && e.status === 401;
}

/** Map any thrown API failure to a UI-ready message. */
export function getFriendlyApiError(e: unknown, fallback = "Something went wrong"): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof DOMException && e.name === "AbortError") {
    return "Request timed out. Check your connection and try again.";
  }
  if (e instanceof TypeError) {
    return "Could not reach the server. Is the backend running and CORS enabled for this origin?";
  }
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

function authHeaders(token?: string): Record<string, string> {
  return {
    // Bypass ngrok's browser-warning interstitial on *.ngrok-free.dev,
    // which otherwise swallows browser GETs (no CORS headers -> net::ERR_FAILED).
    // Harmless against non-ngrok hosts.
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Minimal JSON fetch wrapper. Callers pass a full URL built with `apiUrl()`. */
export async function apiFetch<T>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  const method = options.method ?? "GET";
  if (__DEV__) {
    console.log(`[api] ${method} ${url}`);
  }
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(options.token),
        ...(options.headers ?? {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      const message = extractErrorMessage(raw, res.status);
      if (__DEV__) {
        console.log(`[api] ${res.status} ${method} ${url}`);
      }
      throw new ApiError(res.status, message);
    }
    const data = (await res.json()) as T;
    if (__DEV__) {
      console.log(`[api] OK ${method} ${url}`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Multipart upload for the bulk `.xlsx` flow.
 * Backend (`routes/listings.js`): multer memoryStorage, 5MB limit, single
 * file field named `file`. Do NOT set Content-Type — fetch generates the
 * multipart boundary.
 */
export async function apiUpload<T>(
  url: string,
  form: FormData,
  options: Pick<ApiFetchOptions, "token" | "timeoutMs" | "headers"> = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60000);
  if (__DEV__) {
    console.log(`[api] POST ${url} (multipart)`);
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...authHeaders(options.token),
        ...(options.headers ?? {}),
      },
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      if (__DEV__) {
        console.log(`[api] ${res.status} POST ${url}`);
      }
      throw new ApiError(res.status, extractErrorMessage(raw, res.status));
    }
    const data = (await res.json()) as T;
    if (__DEV__) {
      console.log(`[api] OK POST ${url}`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

/** Binary GET for the bulk template (`GET /listings/template` → .xlsx). */
export async function apiDownload(
  url: string,
  options: Pick<ApiFetchOptions, "token" | "timeoutMs" | "headers"> = {},
): Promise<Blob> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60000);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        ...authHeaders(options.token),
        ...(options.headers ?? {}),
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      throw new ApiError(res.status, extractErrorMessage(raw, res.status));
    }
    return await res.blob();
  } finally {
    clearTimeout(timeout);
  }
}
