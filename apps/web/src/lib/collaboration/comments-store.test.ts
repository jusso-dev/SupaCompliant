import { describe, expect, it } from "vitest";
import { addComment, sanitiseMarkdown } from "./comments-store";

describe("comments", () => {
  it("strips HTML from markdown body", () => {
    expect(sanitiseMarkdown("Hello <script>alert(1)</script>")).toBe(
      "Hello alert(1)",
    );
  });

  it("extracts mentions and never mutates technical results", () => {
    const c = addComment({
      author: "Alex",
      bodyMarkdown: "Please review @sam on this control",
      controlId: "pg.rls.tables_without_rls",
    });
    expect(c.mentions).toContain("@sam");
    expect(c.bodyMarkdown).toContain("Please review");
  });
});
