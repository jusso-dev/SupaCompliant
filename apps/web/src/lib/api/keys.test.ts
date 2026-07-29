import { describe, expect, it } from "vitest";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  signWebhookPayload,
  verifyApiKey,
  verifyWebhookSignature,
} from "./keys";

describe("API keys", () => {
  it("returns raw once and verifies by hash", () => {
    const { raw, record } = createApiKey({
      name: "ci",
      scopes: ["assessments:read"],
    });
    expect(raw.startsWith("sc_")).toBe(true);
    expect(listApiKeys().some((k) => k.id === record.id)).toBe(true);
    expect(listApiKeys()[0]).not.toHaveProperty("hash");
    expect(verifyApiKey(raw).ok).toBe(true);
    revokeApiKey(record.id);
    expect(verifyApiKey(raw).ok).toBe(false);
  });
});

describe("webhooks", () => {
  it("signs and verifies with replay window", () => {
    const secret = "whsec_test";
    const body = JSON.stringify({ type: "assessment.completed" });
    const ts = Date.now();
    const eventId = "evt_1";
    const sig = signWebhookPayload(secret, body, ts, eventId);
    expect(
      verifyWebhookSignature({
        secret,
        body,
        timestamp: ts,
        eventId,
        signature: sig,
      }),
    ).toBe(true);
    expect(
      verifyWebhookSignature({
        secret,
        body,
        timestamp: ts - 10 * 60_000,
        eventId,
        signature: sig,
        now: ts,
      }),
    ).toBe(false);
  });
});
