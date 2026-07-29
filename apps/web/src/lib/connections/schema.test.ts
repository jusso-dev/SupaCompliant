import { describe, expect, it } from "vitest";
import { connectionTestSchema, SUPERUSER_LIKE } from "./schema";

describe("connectionTestSchema", () => {
  it("accepts minimal postgres connection", () => {
    const r = connectionTestSchema.safeParse({
      targetType: "postgresql",
      host: "db.example.com",
      port: 5432,
      database: "postgres",
      username: "supacompliant_assessor",
    });
    expect(r.success).toBe(true);
  });

  it("rejects invalid port", () => {
    const r = connectionTestSchema.safeParse({
      targetType: "postgresql",
      host: "db.example.com",
      port: 99999,
      database: "postgres",
      username: "u",
    });
    expect(r.success).toBe(false);
  });

  it("flags superuser-like names", () => {
    expect(SUPERUSER_LIKE.has("postgres")).toBe(true);
    expect(SUPERUSER_LIKE.has("supacompliant_assessor")).toBe(false);
  });
});
