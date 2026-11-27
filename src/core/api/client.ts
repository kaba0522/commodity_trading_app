export class ApiError extends Error {
  status: number;
  /** Backend code from `{ error: { code, message } }`, when present. */
  code?: string;
  /** Structured extra data, e.g. partial-fill `{ available, price }`. */
  details?: unknown;

  constructor(
    status: number,
    message: string,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    if (code) this.code = code;
    if (details !== undefined) this.details = details;
  }
}

interface ParsedApiError {
  message: string;
  code?: string;
  details?: unknown;
}

/** Pull message, code and details out of a non-OK response body. */
function parseErrorBody(raw: string, status: number): ParsedApiError {
  const fallback = `Request failed (${status})`;
  if (!raw) return { message: fallback };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "string") {
      return { message: parsed || fallback };
    }
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const errorObject =
        obj["error"] !== null && typeof obj["error"] === "object"
          ? (obj["error"] as Record<string, unknown>)
          : null;
      const code =
        typeof errorObject?.["code"] === "string"
          ? errorObject["code"]
          : undefined;
      const details = errorObject?.["details"] ?? obj["details"];
      for (const key of ["message", "error", "detail", "msg"]) {
        const v = obj[key];
        if (typeof v === "string" && v.trim()) return { message: v, code, details };
        // Server shape: { success: false, error: { code, message } }
        if (v !== null && typeof v === "object") {
          const nested = (v as Record<string, unknown>)["message"];
          if (typeof nested === "string" && nested.trim()) {
            return { message: nested, code, details };
          }
        }
      }
      const errors = obj["errors"];
      if (Array.isArray(errors) && typeof errors[0] === "string") {
        return { message: errors[0], code, details };
      }
      if (Array.isArray(errors) && errors[0] && typeof errors[0] === "object") {
        const first = (errors[0] as Record<string, unknown>)["message"];
        if (typeof first === "string" && first.trim()) {
          return { message: first, code, details };
        }
      }
    }
  } catch {
    // Not JSON — fall through. Strip HTML tags so server error pages stay readable.
    const text = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (text) return { message: text.slice(0, 200) };
  }
  return { message: fallback };
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

const SENSITIVE_RESPONSE_KEY =
  /token|password|secret|authorization|cookie|otp|phone|mobile|email|address/i;

function redactApiResponse(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactApiResponse);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        SENSITIVE_RESPONSE_KEY.test(key)
          ? "[REDACTED]"
          : redactApiResponse(entry),
      ]),
    );
  }
  return value;
}

function logApiResponse(method: string, url: string, data: unknown): void {
  if (__DEV__) {
    console.log(`[api] RESPONSE ${method} ${url}`, redactApiResponse(data));
  }
}

function logApiErrorResponse(
  status: number,
  method: string,
  url: string,
  raw: string,
): void {
  if (!__DEV__ || !raw) return;
  try {
    const data: unknown = JSON.parse(raw);
    console.log(
      `[api] RESPONSE ${status} ${method} ${url}`,
      redactApiResponse(data),
    );
  } catch {
    console.log(`[api] RESPONSE ${status} ${method} ${url} [non-JSON body]`);
  }
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
      const parsed = parseErrorBody(raw, res.status);
      if (__DEV__) {
        console.log(`[api] ${res.status} ${method} ${url}`);
      }
      logApiErrorResponse(res.status, method, url, raw);
      throw new ApiError(res.status, parsed.message, parsed.code, parsed.details);
    }
    const data = (await res.json()) as T;
    if (__DEV__) {
      console.log(`[api] OK ${method} ${url}`);
      logApiResponse(method, url, data);
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
      logApiErrorResponse(res.status, "POST", url, raw);
      const parsed = parseErrorBody(raw, res.status);
      throw new ApiError(res.status, parsed.message, parsed.code, parsed.details);
    }
    const data = (await res.json()) as T;
    if (__DEV__) {
      console.log(`[api] OK POST ${url}`);
      logApiResponse("POST", url, data);
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
      const parsed = parseErrorBody(raw, res.status);
      throw new ApiError(res.status, parsed.message, parsed.code, parsed.details);
    }
    return await res.blob();
  } finally {
    clearTimeout(timeout);
  }
}
