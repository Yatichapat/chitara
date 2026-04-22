import { NextResponse } from "next/server";

import { requestBackend, toJsonOrText } from "../_lib/backend";

export async function POST(request: Request) {
  const payload = await request.json();

  const upstream = await requestBackend("/api/songs/generate/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await toJsonOrText(upstream);
  return NextResponse.json(body, { status: upstream.status });
}
