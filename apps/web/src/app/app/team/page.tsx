import { demoOrg } from "@/lib/demo-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organisation memberships and invitations
          </p>
        </div>
        <Button>Invite member</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{demoOrg.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {demoOrg.members.map((m) => (
            <div
              key={m.email}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
            >
              <div>
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </div>
              <Badge variant="secondary" className="capitalize">
                {m.role.replaceAll("_", " ")}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
