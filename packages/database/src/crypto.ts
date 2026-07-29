import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const ALGO = "aes-256-gcm";

export interface EncryptedBlob {
  /** base64 */
  ciphertext: string;
  /** base64 */
  nonce: string;
  /** base64 wrapped DEK */
  wrappedDek: string;
  /** key version label */
  kekVersion: string;
}

function loadKek(): Buffer {
  const raw = process.env.SUPACOMPLIANT_KEK;
  if (!raw) {
    throw new Error("SUPACOMPLIANT_KEK is required (32-byte key as base64)");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("SUPACOMPLIANT_KEK must decode to 32 bytes");
  }
  return key;
}

function wrapDek(dek: Buffer, kek: Buffer): Buffer {
  // AES-GCM wrap with fixed zero nonce derived — use random nonce stored with blob
  const nonce = randomBytes(12);
  const cipher = createCipheriv(ALGO, kek, nonce);
  const enc = Buffer.concat([cipher.update(dek), cipher.final(), cipher.getAuthTag()]);
  // store nonce||ciphertext+tag
  return Buffer.concat([nonce, enc]);
}

function unwrapDek(wrapped: Buffer, kek: Buffer): Buffer {
  const nonce = wrapped.subarray(0, 12);
  const data = wrapped.subarray(12);
  const tag = data.subarray(data.length - 16);
  const ct = data.subarray(0, data.length - 16);
  const decipher = createDecipheriv(ALGO, kek, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

export function encryptSecret(
  plaintext: string,
  kekVersion = "v1",
): EncryptedBlob {
  const kek = loadKek();
  const dek = randomBytes(32);
  const nonce = randomBytes(12);
  const cipher = createCipheriv(ALGO, dek, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return {
    ciphertext: ciphertext.toString("base64"),
    nonce: nonce.toString("base64"),
    wrappedDek: wrapDek(dek, kek).toString("base64"),
    kekVersion,
  };
}

export function decryptSecret(blob: EncryptedBlob): string {
  const kek = loadKek();
  const dek = unwrapDek(Buffer.from(blob.wrappedDek, "base64"), kek);
  const raw = Buffer.from(blob.ciphertext, "base64");
  const nonce = Buffer.from(blob.nonce, "base64");
  const tag = raw.subarray(raw.length - 16);
  const ct = raw.subarray(0, raw.length - 16);
  const decipher = createDecipheriv(ALGO, dek, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = `sc_${randomBytes(24).toString("base64url")}`;
  return { raw, hash: hashApiKey(raw), prefix: raw.slice(0, 10) };
}

/** Test helper: derive a valid KEK from a passphrase for local demo only */
export function deriveDemoKek(passphrase = "supacompliant-local-dev-only"): string {
  return createHash("sha256").update(passphrase).digest("base64");
}
