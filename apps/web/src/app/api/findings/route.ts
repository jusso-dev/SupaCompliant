import { NextResponse } from "next/server";
import { z } from "zod";
import {
  acceptRisk,
  confirmResolution,
  listFindings,
  onControlPassed,
  updateFindingStatus,
} from "@/lib/findings/store";

export async function GET() {
  return NextResponse.json({ findings: listFindings() });
}

const patchSchema = z.object({
  id: z.string(),
  action: z.enum([
    "set_status",
    "propose_from_pass",
    "confirm_resolution",
    "accept_risk",
  ]),
  status: z
    .enum([
      "open",
      "acknowledged",
      "in_progress",
      "ready_for_verification",
      "resolved",
      "risk_accepted",
      "false_positive",
      "duplicate",
    ])
    .optional(),
  controlId: z.string().optional(),
  rationale: z.string().optional(),
});

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  const { action, id } = parsed.data;

  if (action === "set_status" && parsed.data.status) {
    const f = updateFindingStatus(id, parsed.data.status);
    if (!f) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ finding: f });
  }
  if (action === "propose_from_pass" && parsed.data.controlId) {
    return NextResponse.json({
      findings: onControlPassed(parsed.data.controlId),
      note: "Later pass does not silently close findings.",
    });
  }
  if (action === "confirm_resolution") {
    const f = confirmResolution(id);
    if (!f)
      return NextResponse.json(
        { error: "No proposed resolution to confirm" },
        { status: 400 },
      );
    return NextResponse.json({ finding: f });
  }
  if (action === "accept_risk") {
    const f = acceptRisk(id, parsed.data.rationale ?? "Accepted");
    if (!f) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ finding: f });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
