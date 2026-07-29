import { NextResponse } from "next/server";
import { allControls, CONTROL_LIBRARY_VERSION } from "@supacompliant/control-library";

export async function GET() {
  return NextResponse.json({
    version: CONTROL_LIBRARY_VERSION,
    count: allControls.length,
    controls: allControls.map((c) => ({
      id: c.id,
      version: c.version,
      title: c.title,
      severity: c.severity,
      categories: c.categories,
      targets: c.targets,
      requiredCapabilities: c.requiredCapabilities,
      mappingCount: c.mappings.length,
    })),
  });
}
