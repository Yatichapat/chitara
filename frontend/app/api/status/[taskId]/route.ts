import { NextResponse } from "next/server";

import { requestBackend, toJsonOrText } from "../../_lib/backend";

export async function GET(
  _request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const upstream = await requestBackend(`/api/songs/generate/${taskId}/`);
  const body = await toJsonOrText(upstream);
  return NextResponse.json(body, { status: upstream.status });
}
