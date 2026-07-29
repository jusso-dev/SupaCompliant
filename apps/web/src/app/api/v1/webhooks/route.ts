import { NextResponse } from "next/server";
import { z } from "zod";
import { listWebhooks, registerWebhook } from "@/lib/api/keys";

export async function GET() {
  return NextResponse.json({ webhooks: listWebhooks() });
}

const createSchema = z.object({
  url: z.string().url(),
  events: z
    .array(z.string())
    .default([
      "assessment.started",
      "assessment.completed",
      "assessment.failed",
      "finding.critical",
      "regression.detected",
    ]),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  const { webhook, secret } = registerWebhook(parsed.data);
  return NextResponse.json({
    webhook,
    secret,
    note: "Store signing secret now. Payloads use HMAC-SHA256 over timestamp.eventId.body with 5-minute replay window.",
  });
}
