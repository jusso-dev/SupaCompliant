import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { EncryptedBlob } from "./crypto.js";

const ALGO = "aes-256-gcm";

function decodeKek(raw: string): Buffer {
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("KEK must be 32 bytes base64");
  }
  return key;
}

function wrapDek(dek: Buffer, kek: Buffer): Buffer {
  const nonce = randomBytes(12);
  const cipher = createCipheriv(ALGO, kek, nonce);
  const enc = Buffer.concat([cipher.update(dek), cipher.final(), cipher.getAuthTag()]);
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

/**
 * Re-wrap a secret blob from old KEK to new KEK without exposing plaintext
 * outside this function (plaintext exists only in memory briefly).
 */
export function rewrapSecret(
  blob: EncryptedBlob,
  oldKekB64: string,
  newKekB64: string,
  newKekVersion: string,
): EncryptedBlob {
  const oldKek = decodeKek(oldKekB64);
  const newKek = decodeKek(newKekB64);
  const dek = unwrapDek(Buffer.from(blob.wrappedDek, "base64"), oldKek);

  // Decrypt then re-encrypt with new DEK under new KEK for forward secrecy
  const raw = Buffer.from(blob.ciphertext, "base64");
  const nonce = Buffer.from(blob.nonce, "base64");
  const tag = raw.subarray(raw.length - 16);
  const ct = raw.subarray(0, raw.length - 16);
  const decipher = createDecipheriv(ALGO, dek, nonce);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);

  const newDek = randomBytes(32);
  const newNonce = randomBytes(12);
  const cipher = createCipheriv(ALGO, newDek, newNonce);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  // Zero sensitive buffers where possible
  plaintext.fill(0);
  dek.fill(0);

  return {
    ciphertext: ciphertext.toString("base64"),
    nonce: newNonce.toString("base64"),
    wrappedDek: wrapDek(newDek, newKek).toString("base64"),
    kekVersion: newKekVersion,
  };
}

export function generateKek(): string {
  return randomBytes(32).toString("base64");
}

export function fingerprintKek(kekB64: string): string {
  return createHash("sha256").update(Buffer.from(kekB64, "base64")).digest("hex").slice(0, 16);
}
