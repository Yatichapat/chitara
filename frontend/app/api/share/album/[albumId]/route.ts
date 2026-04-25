import { NextResponse } from "next/server";

import { requestBackend, toJsonOrText } from "../../../_lib/backend";

export async function GET(
  request: Request,
  context: { params: Promise<{ albumId: string }> },
) {
  const { albumId } = await context.params;
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const query = email ? `?email=${encodeURIComponent(email)}` : "";

  const upstream = await requestBackend(`/api/albums/${albumId}/share/${query}`);
  const body = await toJsonOrText(upstream);
  return NextResponse.json(body, { status: upstream.status });
}
