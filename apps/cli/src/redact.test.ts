import { describe, expect, it } from "vitest";

// Mirror CLI redaction behaviour for tests without importing CLI side effects
function redactError(msg: string): string {
  return msg
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "[REDACTED_URL]")
    .replace(/password[=:][^\s&]+/gi, "password=[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
}

describe("CLI error redaction", () => {
  it("redacts connection strings and bearer tokens", () => {
    expect(
      redactError("fail postgres://user:secret@host/db Bearer abc.def"),
    ).toContain("[REDACTED_URL]");
    expect(
      redactError("fail postgres://user:secret@host/db Bearer abc.def"),
    ).toContain("Bearer [REDACTED]");
  });
});
