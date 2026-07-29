import { NextResponse } from "next/server";
import { controlCount } from "@supacompliant/control-library";
import { frameworks } from "@supacompliant/framework-mappings";

/** API root / discovery */
export async function GET() {
  return NextResponse.json({
    name: "SupaCompliant REST API",
    version: "v1",
    disclaimer:
      "Independent open-source project — not affiliated with Supabase, Inc.",
    resources: [
      "/api/v1/organisations",
      "/api/v1/projects",
      "/api/v1/assessments",
      "/api/v1/findings",
      "/api/v1/api-keys",
      "/api/v1/webhooks",
      "/api/controls",
      "/api/health",
    ],
    controlCount: controlCount(),
    frameworkCount: frameworks.length,
  });
}
