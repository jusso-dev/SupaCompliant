import { FRAMEWORK_DISCLAIMER } from "@supacompliant/shared";
import { mappingsForFramework } from "@supacompliant/framework-mappings";
import { demoFrameworks } from "@/lib/demo-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function FrameworksPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Frameworks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Transparent, versioned mappings. Contribution only — not certification.
          </p>
        </div>
        <a
          href="/app/frameworks/essential-eight"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Essential Eight contribution view →
        </a>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        {FRAMEWORK_DISCLAIMER}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {demoFrameworks.map((f) => {
          const maps = mappingsForFramework(f.id);
          return (
            <Card key={f.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{f.name}</CardTitle>
                  {f.australianFocus && (
                    <Badge variant="outline">AU focus</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {f.publisher} · v{f.version}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{f.description}</p>
                <p className="text-xs text-muted-foreground">{f.disclaimer}</p>
                <p className="text-sm">
                  <span className="font-medium">{maps.length}</span>{" "}
                  <span className="text-muted-foreground">
                    framework control identifiers mapped to technical checks
                  </span>
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {maps.slice(0, 5).map((m) => (
                    <li key={`${m.frameworkId}-${m.controlIdentifier}`}>
                      <span className="font-medium text-foreground">
                        {m.controlIdentifier}
                      </span>
                      {" → "}
                      {m.technicalControlIds.slice(0, 2).join(", ")}
                      {m.technicalControlIds.length > 2 ? "…" : ""}
                    </li>
                  ))}
                </ul>
                <a
                  href={f.sourceUrl}
                  className="text-xs font-medium underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Authoritative source
                </a>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
