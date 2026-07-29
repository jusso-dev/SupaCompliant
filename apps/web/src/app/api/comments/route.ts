import { NextResponse } from "next/server";
import { z } from "zod";
import { addComment, listComments } from "@/lib/collaboration/comments-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const comments = listComments({
    controlId: searchParams.get("controlId") ?? undefined,
    runId: searchParams.get("runId") ?? undefined,
  });
  return NextResponse.json({ comments });
}

const postSchema = z.object({
  author: z.string().min(1).max(120),
  bodyMarkdown: z.string().min(1).max(10_000),
  controlId: z.string().optional(),
  runId: z.string().optional(),
  threadId: z.string().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  const comment = addComment(parsed.data);
  return NextResponse.json({
    comment,
    note: "Comments never alter immutable technical results.",
  });
}
