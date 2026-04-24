import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const incomingUrl = new URL(request.url);
  const nextPath = incomingUrl.searchParams.get("next") || "/";

  const backendBase = process.env.BACKEND_BASE_URL || "http://127.0.0.1:8000";
  const backendUrl = new URL("/accounts/google/login/", backendBase);
  backendUrl.searchParams.set("next", nextPath);

  return NextResponse.redirect(backendUrl);
}
