import { describe, expect, it, beforeAll } from "vitest";
import {
  decryptSecret,
  deriveDemoKek,
  encryptSecret,
  generateApiKey,
  hashApiKey,
} from "./crypto.js";

beforeAll(() => {
  process.env.SUPACOMPLIANT_KEK = deriveDemoKek();
});

describe("envelope encryption", () => {
  it("round-trips secrets", () => {
    const blob = encryptSecret("super-secret-password");
    expect(blob.ciphertext).not.toContain("super-secret");
    expect(decryptSecret(blob)).toBe("super-secret-password");
  });

  it("api keys hash deterministically", () => {
    const { raw, hash, prefix } = generateApiKey();
    expect(hashApiKey(raw)).toBe(hash);
    expect(prefix.startsWith("sc_")).toBe(true);
  });
});
