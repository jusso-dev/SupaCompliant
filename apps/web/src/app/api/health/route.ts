import { NextResponse } from "next/server";
import { controlCount } from "@supacompliant/control-library";
import { frameworks } from "@supacompliant/framework-mappings";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "supacompliant-web",
    controlCount: controlCount(),
    frameworkCount: frameworks.length,
  });
}
