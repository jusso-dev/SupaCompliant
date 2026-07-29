const SECRET_PATTERNS: RegExp[] = [
  /password\s*[=:]\s*['"]?[^'"\s]+/gi,
  /passwd\s*[=:]\s*['"]?[^'"\s]+/gi,
  /api[_-]?key\s*[=:]\s*['"]?[^'"\s]+/gi,
  /secret\s*[=:]\s*['"]?[^'"\s]+/gi,
  /token\s*[=:]\s*['"]?[^'"\s]+/gi,
  /bearer\s+[a-z0-9._\-]+/gi,
  /postgres(?:ql)?:\/\/[^\s'"]+/gi,
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, // JWT-like
];

const KEY_HINTS = [
  "password",
  "passwd",
  "secret",
  "token",
  "apikey",
  "api_key",
  "access_key",
  "private_key",
  "service_role",
  "authorization",
];

export function redactString(input: string): string {
  let out = input;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, "[REDACTED]");
  }
  return out;
}

export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 12) return "[TRUNCATED]";
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1));
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const lower = k.toLowerCase();
      if (KEY_HINTS.some((h) => lower.includes(h))) {
        next[k] = "[REDACTED]";
      } else {
        next[k] = redactValue(v, depth + 1);
      }
    }
    return next;
  }
  return value;
}

export function safeSummary(text: string, maxLen = 500): string {
  const redacted = redactString(text);
  if (redacted.length <= maxLen) return redacted;
  return `${redacted.slice(0, maxLen)}…`;
}
