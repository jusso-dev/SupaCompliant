import { describe, expect, it } from "vitest";
import { createRun, getRun, updateRun } from "./run-store";

describe("run-store", () => {
  it("creates and updates runs immutably by id", () => {
    const r = createRun("test-run-1");
    expect(r.status).toBe("queued");
    updateRun("test-run-1", { status: "evaluating", progress: 40 });
    expect(getRun("test-run-1")?.progress).toBe(40);
    updateRun("test-run-1", { status: "completed", progress: 100 });
    expect(getRun("test-run-1")?.status).toBe("completed");
  });
});
