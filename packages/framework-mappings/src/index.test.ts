import { describe, expect, it } from "vitest";
import {
  buildFrameworkIndex,
  frameworks,
  getFramework,
  mappingsForFramework,
} from "./index.js";

describe("framework mappings", () => {
  it("includes Australian frameworks", () => {
    expect(getFramework("ism")?.australianFocus).toBe(true);
    expect(getFramework("essential-eight")?.australianFocus).toBe(true);
    expect(getFramework("pspf")?.australianFocus).toBe(true);
  });

  it("every framework has disclaimer", () => {
    for (const f of frameworks) {
      expect(f.disclaimer.length).toBeGreaterThan(20);
      expect(f.sourceUrl.startsWith("http")).toBe(true);
    }
  });

  it("ISM has mapped technical controls", () => {
    const ism = mappingsForFramework("ism");
    expect(ism.length).toBeGreaterThan(5);
  });

  it("index is non-empty", () => {
    expect(buildFrameworkIndex().length).toBeGreaterThan(20);
  });
});
