import { NextRequest } from "next/server";

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://127.0.0.1:8000";

function toBackendUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const cleanBase = BACKEND_BASE_URL.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

function sanitizeFilename(input: string): string {
  const cleaned = input
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!cleaned) {
    return "song.mp3";
  }

  return cleaned.toLowerCase().endsWith(".mp3") ? cleaned : `${cleaned}.mp3`;
}

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("src");
  if (!src) {
    return new Response("Missing src query parameter.", { status: 400 });
  }

  const shouldDownload = request.nextUrl.searchParams.get("download") === "1";
  const rawFilename = request.nextUrl.searchParams.get("filename") || "song.mp3";
  const filename = sanitizeFilename(rawFilename);

  const range = request.headers.get("range");
  const upstream = await fetch(toBackendUrl(src), {
    headers: range ? { Range: range } : undefined,
  });

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const contentLength = upstream.headers.get("content-length");
  const acceptRanges = upstream.headers.get("accept-ranges");
  const contentRange = upstream.headers.get("content-range");

  if (contentType) headers.set("content-type", contentType);
  if (contentLength) headers.set("content-length", contentLength);
  if (acceptRanges) headers.set("accept-ranges", acceptRanges);
  if (contentRange) headers.set("content-range", contentRange);
  if (shouldDownload) {
    headers.set("content-disposition", `attachment; filename=\"${filename}\"`);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
