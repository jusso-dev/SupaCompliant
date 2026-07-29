import Link from "next/link";
import { buildEssentialEightContribution } from "@/lib/frameworks/essential-eight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";

export default function EssentialEightPage() {
  const { strategies, disclaimer } = buildEssentialEightContribution();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/app/frameworks" className="hover:underline">
            Frameworks
          </Link>
          <span className="mx-1.5">/</span>
          Essential Eight
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Essential Eight — database contribution
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ASD Essential Eight strategies with honest scope boundaries
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        {disclaimer}
      </div>

      <div className="grid gap-4">
        {strategies.map((s) => (
          <Card key={s.strategy.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{s.strategy.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {s.strategy.notes}
                </p>
              </div>
              <Badge variant={s.strategy.inDatabaseScope ? "secondary" : "outline"}>
                {s.strategy.inDatabaseScope ? "DB-adjacent" : "Out of scope"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {!s.strategy.inDatabaseScope && s.technicalControls.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No database controls claim this strategy. Collect endpoint
                  evidence outside SupaCompliant.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Pass {s.technicalPass}</span>
                    <span>Fail/warn {s.technicalFail}</span>
                    <span>Manual {s.manualReview}</span>
                    <span>N/A {s.notApplicable}</span>
                    <span>Not assessed {s.notAssessed}</span>
                    <span>Unknown/error {s.unknownOrError}</span>
                  </div>
                  <ul className="space-y-2">
                    {s.technicalControls.map((c) => (
                      <li
                        key={c.controlId}
                        className="flex flex-wrap items-center gap-2 text-sm"
                      >
                        <StatusBadge status={c.status} />
                        <span className="font-medium">{c.title}</span>
                        <code className="text-[11px] text-muted-foreground">
                          {c.controlId}
                        </code>
                        <span className="text-xs text-muted-foreground">
                          ({c.relationship.replaceAll("_", " ")})
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
