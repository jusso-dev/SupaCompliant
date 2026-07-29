import { demoFindings } from "@/lib/demo-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function FindingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Findings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Failed controls promoted to tracked findings. Passing later does not
          auto-close without confirmation.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Open and in-progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Title</th>
                  <th className="pb-2 font-medium">Severity</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Owner</th>
                  <th className="pb-2 font-medium">Environment</th>
                  <th className="pb-2 font-medium">Control</th>
                </tr>
              </thead>
              <tbody>
                {demoFindings.map((f) => (
                  <tr key={f.id} className="border-b border-border/70">
                    <td className="py-3 font-medium">{f.title}</td>
                    <td className="py-3">
                      <Badge variant="outline" className="capitalize">
                        {f.severity}
                      </Badge>
                    </td>
                    <td className="py-3 capitalize">
                      {f.status.replaceAll("_", " ")}
                    </td>
                    <td className="py-3 text-muted-foreground">{f.owner}</td>
                    <td className="py-3 capitalize text-muted-foreground">
                      {f.environment}
                    </td>
                    <td className="py-3">
                      <code className="text-xs">{f.controlId}</code>
                    </td>
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
