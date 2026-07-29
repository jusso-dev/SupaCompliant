import { describe, expect, it } from "vitest";
import {
  confirmResolution,
  listFindings,
  onControlPassed,
  updateFindingStatus,
} from "./store";

describe("findings lifecycle", () => {
  it("does not auto-close when control passes", () => {
    const before = listFindings().find(
      (f) => f.controlId === "pg.rls.tables_without_rls",
    );
    expect(before?.status).not.toBe("resolved");
    const updated = onControlPassed("pg.rls.tables_without_rls");
    expect(updated.length).toBeGreaterThan(0);
    expect(updated[0]?.proposedResolution).toBe(true);
    expect(updated[0]?.status).not.toBe("resolved");
  });

  it("requires explicit confirmation to resolve", () => {
    onControlPassed("pg.rls.tables_without_rls");
    const f = listFindings().find(
      (x) => x.controlId === "pg.rls.tables_without_rls",
    )!;
    const resolved = confirmResolution(f.id);
    expect(resolved?.status).toBe("resolved");
  });

  it("supports status transitions", () => {
    const f = listFindings()[0]!;
    const u = updateFindingStatus(f.id, "acknowledged");
    expect(u?.status).toBe("acknowledged");
  });
});
