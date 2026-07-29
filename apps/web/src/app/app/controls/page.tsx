import { controlCatalogue } from "@/lib/demo-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ControlsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Controls</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Versioned technical control library ({controlCatalogue.length}{" "}
          controls). Collectors and evaluators are separable for fixture tests.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Catalogue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">ID</th>
                  <th className="pb-2 font-medium">Title</th>
                  <th className="pb-2 font-medium">Severity</th>
                  <th className="pb-2 font-medium">Categories</th>
                  <th className="pb-2 font-medium">Targets</th>
                  <th className="pb-2 font-medium">Mappings</th>
                </tr>
              </thead>
              <tbody>
                {controlCatalogue.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 align-top">
                    <td className="py-2.5">
                      <code className="text-xs">{c.id}</code>
                      <div className="text-[11px] text-muted-foreground">
                        v{c.version}
                      </div>
                    </td>
                    <td className="py-2.5">
                      <div className="font-medium">{c.title}</div>
                      <div className="mt-0.5 max-w-md text-xs text-muted-foreground">
                        {c.description}
                      </div>
                    </td>
                    <td className="py-2.5 capitalize">{c.severity}</td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {c.categories.map((cat) => (
                          <Badge key={cat} variant="secondary">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {c.targets.join(", ")}
                    </td>
                    <td className="py-2.5 tabular-nums">{c.mappingCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
