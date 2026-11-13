import { apiErrorSchema } from "@contracts";

/**
 * The only place the browser learns where the API lives. Vite inlines
 * `import.meta.env.VITE_API_URL` at build time, so this stays configurable
 * per environment (local, preview, production) without touching code.
 */
export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8787").replace(
  /\/$/,
  ""
);

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Thin fetch wrapper:
 *  - always sends cookies (Better Auth sessions)
 *  - turns every non-2xx response into an ApiError with the server's message
 *  - never throws on an empty body
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers
    });
  } catch {
    throw new ApiError(
      0,
      "network_error",
      `Cannot reach the API at ${API_URL}. Is the server running?`
    );
  }

  const text = await response.text();

  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(payload);
    if (parsed.success) {
      throw new ApiError(
        response.status,
        parsed.data.error.code,
        parsed.data.error.message,
        parsed.data.error.details
      );
    }
    throw new ApiError(response.status, "unknown_error", `Request failed (${response.status}).`);
  }

  return payload as T;
}
