import { NextResponse } from "next/server";

import { requestBackend, toJsonOrText } from "../../_lib/backend";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ albumId: string }> },
) {
  const { albumId } = await context.params;
  const payload = await request.json();

  const upstream = await requestBackend(`/api/albums/${albumId}/update/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await toJsonOrText(upstream);
  return NextResponse.json(body, { status: upstream.status });
}
