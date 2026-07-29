import { describe, expect, it } from "vitest";
import { redactString, redactValue } from "./redact.js";

describe("redact", () => {
  it("redacts connection strings and tokens", () => {
    expect(redactString("url=postgresql://user:secret@host/db")).toContain(
      "[REDACTED]",
    );
    expect(redactString("Authorization: Bearer abc.def.ghi")).toContain(
      "[REDACTED]",
    );
  });

  it("redacts secret-like object keys", () => {
    const out = redactValue({
      host: "db.example.com",
      password: "super-secret",
      nested: { api_key: "k" },
    }) as Record<string, unknown>;
    expect(out.host).toBe("db.example.com");
    expect(out.password).toBe("[REDACTED]");
    expect((out.nested as Record<string, unknown>).api_key).toBe("[REDACTED]");
  });
});
