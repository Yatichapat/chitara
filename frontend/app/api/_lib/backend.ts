const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://127.0.0.1:8000";

function toBackendUrl(path: string): string {
  const cleanBase = BACKEND_BASE_URL.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

export async function requestBackend(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(toBackendUrl(path), {
    cache: "no-store",
    ...init,
  });
}

export async function toJsonOrText(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { error: text } : {};
}
