import { describe, expect, it } from "vitest";
import { controlCatalogue, demoRuns, latestPosture } from "./demo-data";

describe("demo data", () => {
  it("has six assessment runs", () => {
    expect(demoRuns).toHaveLength(6);
  });

  it("has at least 50 controls", () => {
    expect(controlCatalogue.length).toBeGreaterThanOrEqual(50);
  });

  it("computes posture without treating all as pass", () => {
    const p = latestPosture();
    expect(p.total).toBeGreaterThanOrEqual(50);
    expect(p.pass + p.fail + p.warning + p.manualReview + p.unknown + p.error + p.notApplicable + p.notAssessed).toBe(
      p.total,
    );
  });
});
