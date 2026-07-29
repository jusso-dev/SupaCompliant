import { NextResponse } from "next/server";
import { z } from "zod";
import { encryptSecret, deriveDemoKek } from "@supacompliant/database";

/**
 * Demonstrates envelope encryption path for connection secrets.
 * In production, secrets are written only to connection_secrets via service role.
 * This endpoint returns ciphertext shape without storing — never returns plaintext.
 */
const bodySchema = z.object({
  password: z.string().optional(),
  managementToken: z.string().optional(),
});

export async function POST(request: Request) {
  if (!process.env.SUPACOMPLIANT_KEK) {
    // Local/demo: derive deterministic KEK so the path is exercisable in CI
    process.env.SUPACOMPLIANT_KEK = deriveDemoKek("ci-preview-only");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const payload = JSON.stringify({
    password: parsed.data.password,
    managementToken: parsed.data.managementToken,
  });

  const blob = encryptSecret(payload);

  return NextResponse.json({
    encrypted: true,
    // Structure only — ciphertext is safe to inspect as opaque
    ciphertextLength: blob.ciphertext.length,
    nonceLength: blob.nonce.length,
    wrappedDekLength: blob.wrappedDek.length,
    kekVersion: blob.kekVersion,
    note: "Plaintext secrets are never returned. Persist via worker/service role only.",
  });
}
