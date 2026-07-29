import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api/keys";

export async function GET() {
  return NextResponse.json({ keys: listApiKeys() });
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.string()).default(["assessments:read"]),
  expiresAt: z.string().optional(),
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
  const { raw, record } = createApiKey(parsed.data);
  const { hash: _h, ...safe } = record;
  return NextResponse.json({
    key: safe,
    raw,
    note: "Store the raw key now — it will not be shown again.",
  });
}

const revokeSchema = z.object({ id: z.string() });

export async function DELETE(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = revokeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  const ok = revokeApiKey(parsed.data.id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ revoked: true });
}
