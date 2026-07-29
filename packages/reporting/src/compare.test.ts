import { describe, expect, it } from "vitest";
import { compareReports } from "./compare.js";
import type { ControlExecutionResult } from "@supacompliant/assessment-engine";

function r(
  partial: Partial<ControlExecutionResult> &
    Pick<ControlExecutionResult, "controlId" | "status">,
): ControlExecutionResult {
  return {
    controlVersion: "1.0.0",
    severity: "medium",
    summary: "",
    expected: "",
    actual: "",
    evidence: {},
    evidenceSummary: "",
    durationMs: 1,
    categories: [],
    mappings: [],
    remediation: { summary: "", steps: [] },
    ...partial,
  };
}

describe("compareReports", () => {
  it("detects regression vs resolved", () => {
    const base = [
      r({ controlId: "a", status: "pass" }),
      r({ controlId: "b", status: "fail" }),
    ];
    const cand = [
      r({ controlId: "a", status: "fail" }),
      r({ controlId: "b", status: "pass" }),
      r({ controlId: "c", status: "pass" }),
    ];
    const cmp = compareReports("r1", base, "r2", cand);
    expect(cmp.summary.regressions).toBe(1);
    expect(cmp.summary.resolved).toBe(1);
    expect(cmp.summary.newControls).toBe(1);
  });

  it("notes version change on regression", () => {
    const base = [r({ controlId: "a", status: "pass", controlVersion: "1.0.0" })];
    const cand = [
      r({ controlId: "a", status: "fail", controlVersion: "1.1.0" }),
    ];
    const cmp = compareReports("r1", base, "r2", cand);
    const d = cmp.deltas.find((x) => x.controlId === "a");
    expect(d?.kind).toBe("regression");
    expect(d?.notes.some((n) => n.includes("version"))).toBe(true);
  });
});
