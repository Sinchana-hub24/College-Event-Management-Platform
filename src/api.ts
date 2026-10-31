export class ApiError extends Error {
  status: number;
  detail: unknown;
  expectedRole?: "STUDENT" | "ORGANIZER";

  constructor(message: string, status: number, detail?: unknown, expectedRole?: "STUDENT" | "ORGANIZER") {
    super(message);
    this.status = status;
    this.detail = detail;
    this.expectedRole = expectedRole;
  }
}

const TOKEN_STORAGE_KEY = "event_manager_auth_token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail = payload?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : detail?.message || payload?.error || "Request failed. Please try again.";
    throw new ApiError(message, res.status, detail, payload?.expectedRole || detail?.role);
  }

  return payload as T;
}
