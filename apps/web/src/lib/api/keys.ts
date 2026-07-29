import { createHash, randomBytes, createHmac, timingSafeEqual } from "node:crypto";

export type ApiKeyRecord = {
  id: string;
  name: string;
  prefix: string;
  hash: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
};

const g = globalThis as unknown as { __scApiKeys?: ApiKeyRecord[] };

function store(): ApiKeyRecord[] {
  if (!g.__scApiKeys) g.__scApiKeys = [];
  return g.__scApiKeys;
}

export function createApiKey(input: {
  name: string;
  scopes: string[];
  expiresAt?: string;
}): { raw: string; record: ApiKeyRecord } {
  const raw = `sc_${randomBytes(24).toString("base64url")}`;
  const record: ApiKeyRecord = {
    id: randomBytes(8).toString("hex"),
    name: input.name,
    prefix: raw.slice(0, 10),
    hash: hashKey(raw),
    scopes: input.scopes,
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt,
  };
  store().push(record);
  return { raw, record };
}

export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function listApiKeys(): Omit<ApiKeyRecord, "hash">[] {
  return store().map(({ hash: _h, ...rest }) => rest);
}

export function revokeApiKey(id: string): boolean {
  const k = store().find((x) => x.id === id);
  if (!k) return false;
  k.revokedAt = new Date().toISOString();
  return true;
}

export function verifyApiKey(
  raw: string,
): { ok: true; key: ApiKeyRecord } | { ok: false } {
  const h = hashKey(raw);
  const key = store().find((k) => k.hash === h && !k.revokedAt);
  if (!key) return { ok: false };
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) return { ok: false };
  key.lastUsedAt = new Date().toISOString();
  return { ok: true, key };
}

export type WebhookRecord = {
  id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
};

const gw = globalThis as unknown as { __scWebhooks?: WebhookRecord[] };

function webhooks(): WebhookRecord[] {
  if (!gw.__scWebhooks) gw.__scWebhooks = [];
  return gw.__scWebhooks;
}

export function registerWebhook(input: {
  url: string;
  events: string[];
}): { webhook: Omit<WebhookRecord, "secret">; secret: string } {
  const secret = `whsec_${randomBytes(16).toString("base64url")}`;
  const webhook: WebhookRecord = {
    id: randomBytes(8).toString("hex"),
    url: input.url,
    secret,
    events: input.events,
    active: true,
  };
  webhooks().push(webhook);
  const { secret: _s, ...safe } = webhook;
  return { webhook: safe, secret };
}

export function signWebhookPayload(
  secret: string,
  body: string,
  timestamp: number,
  eventId: string,
): string {
  const payload = `${timestamp}.${eventId}.${body}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyWebhookSignature(opts: {
  secret: string;
  body: string;
  timestamp: number;
  eventId: string;
  signature: string;
  now?: number;
}): boolean {
  const now = opts.now ?? Date.now();
  // Replay window: 5 minutes
  if (Math.abs(now - opts.timestamp) > 5 * 60_000) return false;
  const expected = signWebhookPayload(
    opts.secret,
    opts.body,
    opts.timestamp,
    opts.eventId,
  );
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(opts.signature, "hex"),
    );
  } catch {
    return false;
  }
}

export function listWebhooks(): Omit<WebhookRecord, "secret">[] {
  return webhooks().map(({ secret: _s, ...rest }) => rest);
}
