const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/*
 * ┌──────────────────────────────────────────────────────┐
 * │  BACKEND MATE:                                       │
 * │  Auth headers (Bearer token / session cookie)        │
 * │  should be injected here once auth is integrated.    │
 * │  For now, all requests are unauthenticated.          │
 * └──────────────────────────────────────────────────────┘
 */

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`API ${method} ${path} failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PUT", path, body);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>("POST", path, body);
}
