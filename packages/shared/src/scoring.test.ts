import { describe, expect, it } from "vitest";
import { computeTechnicalPosture, riskWeightedScore } from "./scoring.js";

describe("computeTechnicalPosture", () => {
  it("never treats unknown or error as pass", () => {
    const posture = computeTechnicalPosture([
      { status: "pass", severity: "low" },
      { status: "fail", severity: "critical" },
      { status: "unknown", severity: "high" },
      { status: "error", severity: "medium" },
    ]);
    expect(posture.pass).toBe(1);
    expect(posture.fail).toBe(1);
    expect(posture.unknown).toBe(1);
    expect(posture.error).toBe(1);
    expect(posture.technicalPassRate).toBe(0.5);
    expect(posture.criticalFindings).toBe(1);
    expect(posture.unknownOrError).toBe(2);
  });

  it("excludes not_applicable from pass rate denominator", () => {
    const posture = computeTechnicalPosture([
      { status: "pass", severity: "low" },
      { status: "not_applicable", severity: "low" },
    ]);
    expect(posture.technicalPassRate).toBe(1);
  });
});

describe("riskWeightedScore", () => {
  it("weights failures by severity", () => {
    const score = riskWeightedScore([
      { status: "pass", severity: "critical" },
      { status: "fail", severity: "critical" },
    ]);
    expect(score).toBe(0.5);
  });
});
