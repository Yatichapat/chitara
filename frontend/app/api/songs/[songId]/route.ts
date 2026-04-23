import { NextResponse } from "next/server";

import { requestBackend, toJsonOrText } from "../../_lib/backend";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ songId: string }> },
) {
  const { songId } = await context.params;
  const payload = await request.json();

  const upstream = await requestBackend(`/api/songs/${songId}/update/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await toJsonOrText(upstream);
  return NextResponse.json(body, { status: upstream.status });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ songId: string }> },
) {
  const { songId } = await context.params;

  const upstream = await requestBackend(`/api/songs/${songId}/delete/`, {
    method: "DELETE",
  });

  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const body = await toJsonOrText(upstream);
  return NextResponse.json(body, { status: upstream.status });
}
