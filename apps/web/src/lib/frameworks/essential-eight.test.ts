import { describe, expect, it } from "vitest";
import {
  buildEssentialEightContribution,
  E8_STRATEGIES,
} from "./essential-eight";

describe("Essential Eight contribution", () => {
  it("covers eight strategies", () => {
    expect(E8_STRATEGIES).toHaveLength(8);
  });

  it("never invents a maturity level field", () => {
    const view = buildEssentialEightContribution();
    expect(view.disclaimer.toLowerCase()).toContain("never fabricates");
    expect(JSON.stringify(view)).not.toMatch(/maturityLevel|ml[1-3]/i);
  });

  it("marks application control out of scope", () => {
    const app = E8_STRATEGIES.find((s) => s.id === "application-control");
    expect(app?.inDatabaseScope).toBe(false);
  });
});
