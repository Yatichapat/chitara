import { NextResponse } from "next/server";

import { requestBackend, toJsonOrText } from "../_lib/backend";

export async function GET() {
  const upstream = await requestBackend("/api/songs/");
  const body = await toJsonOrText(upstream);
  return NextResponse.json(body, { status: upstream.status });
}
