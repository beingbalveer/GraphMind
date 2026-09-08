/**
 * Unified, Typed API Client for GraphMind Frontend.
 *
 * Enforces same-origin routing via Next.js rewrites (/api/v1/...),
 * automatically attaches credentials: "include" for HttpOnly cookies,
 * and intercepts 401 Unauthorized responses with silent token refresh and request replay.
 */

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail || `API Request Failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

let isRefreshing = false;
let refreshSubscribers: Array<(ok: boolean) => void> = [];

function onRefreshed(ok: boolean) {
  refreshSubscribers.forEach((callback) => callback(ok));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (ok: boolean) => void) {
  refreshSubscribers.push(callback);
}

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const normalized = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = normalized.startsWith("/api/v1") ? normalized : `/api/v1${normalized}`;

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...((options.headers as Record<string, string>) || {}),
  };

  const fetchConfig: RequestInit = {
    ...options,
    credentials: "include",
    headers,
  };

  const response = await fetch(url, fetchConfig);

  // Transparent 401 Silent Refresh & Replay
  if (
    response.status === 401 &&
    !url.includes("/api/v1/auth/login") &&
    !url.includes("/api/v1/auth/register") &&
    !url.includes("/api/v1/auth/refresh") &&
    !url.includes("/api/v1/auth/google")
  ) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshResponse = await fetch("/api/v1/auth/refresh", {
          method: "POST",
          credentials: "include",
        });

        if (refreshResponse.ok) {
          isRefreshing = false;
          onRefreshed(true);
        } else {
          isRefreshing = false;
          onRefreshed(false);
          if (typeof window !== "undefined") {
            const currentPath = window.location.pathname;
            if (!currentPath.startsWith("/login")) {
              window.location.href = `/login?next=${encodeURIComponent(currentPath)}`;
            }
          }
          throw new ApiError(401, "Session expired. Please sign in again.");
        }
      } catch (err) {
        isRefreshing = false;
        onRefreshed(false);
        throw err;
      }
    } else {
      // Wait for the active refresh request to resolve
      const refreshOk = await new Promise<boolean>((resolve) => {
        addRefreshSubscriber(resolve);
      });

      if (!refreshOk) {
        throw new ApiError(401, "Session expired. Please sign in again.");
      }
    }

    // Replay the original request once
    const retryResponse = await fetch(url, fetchConfig);
    if (!retryResponse.ok) {
      const errData = await retryResponse.json().catch(() => ({}));
      const detail = errData.detail || errData.error?.message || retryResponse.statusText;
      throw new ApiError(retryResponse.status, detail);
    }

    if (retryResponse.status === 204) {
      return null as T;
    }
    return retryResponse.json();
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const validationMsg =
      errorData.error?.details?.[0]?.msg ||
      (Array.isArray(errorData.detail) ? errorData.detail[0]?.msg : null);
    const detail =
      validationMsg ||
      (typeof errorData.detail === "string" ? errorData.detail : null) ||
      errorData.error?.message ||
      response.statusText;
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

export const apiClient = {
  get: <T = unknown>(endpoint: string, options?: RequestInit) =>
    apiFetch<T>(endpoint, { ...options, method: "GET" }),

  post: <T = unknown>(endpoint: string, body?: unknown, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = unknown>(endpoint: string, body?: unknown, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = unknown>(endpoint: string, options?: RequestInit) =>
    apiFetch<T>(endpoint, { ...options, method: "DELETE" }),
};
