import { demoProject, demoOrg } from "@/lib/demo-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {demoOrg.name} · environments and connections
          </p>
        </div>
        <Button>New project</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{demoProject.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Slug: <code>{demoProject.slug}</code>
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {demoProject.environments.map((env) => (
              <div
                key={env}
                className="rounded-md border border-border bg-background p-4"
              >
                <p className="text-sm font-medium capitalize">{env}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Connection: read-only assessor role
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
