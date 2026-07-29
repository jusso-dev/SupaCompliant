import { describe, expect, it, beforeAll } from "vitest";
import { decryptSecret, encryptSecret, deriveDemoKek } from "./crypto.js";
import { fingerprintKek, generateKek, rewrapSecret } from "./kek-rotation.js";

beforeAll(() => {
  process.env.SUPACOMPLIANT_KEK = deriveDemoKek("old-kek-passphrase");
});

describe("KEK rotation", () => {
  it("rewraps secrets so new KEK can decrypt", () => {
    const oldKek = process.env.SUPACOMPLIANT_KEK!;
    const blob = encryptSecret("super-secret-db-password");
    expect(decryptSecret(blob)).toBe("super-secret-db-password");

    const newKek = generateKek();
    const rewrapped = rewrapSecret(blob, oldKek, newKek, "v2");
    expect(rewrapped.kekVersion).toBe("v2");
    expect(rewrapped.ciphertext).not.toBe(blob.ciphertext);

    process.env.SUPACOMPLIANT_KEK = newKek;
    expect(decryptSecret(rewrapped)).toBe("super-secret-db-password");
  });

  it("fingerprints KEK without revealing it", () => {
    const a = generateKek();
    const b = generateKek();
    expect(fingerprintKek(a)).toHaveLength(16);
    expect(fingerprintKek(a)).not.toBe(fingerprintKek(b));
  });

  it("never leaves plaintext in rewrap output fields", () => {
    const oldKek = deriveDemoKek("x");
    process.env.SUPACOMPLIANT_KEK = oldKek;
    const blob = encryptSecret("plain-password-value");
    const newKek = generateKek();
    const out = rewrapSecret(blob, oldKek, newKek, "v2");
    const joined = JSON.stringify(out);
    expect(joined).not.toContain("plain-password-value");
  });
});
