import { demoOrg } from "@/lib/demo-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InviteForm } from "@/components/auth/invite-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import Link from "next/link";

export default function TeamPage() {
  const live = isSupabaseConfigured();
  // Demo org id placeholder — live invites require a real organisation UUID
  const demoOrgId = "00000000-0000-4000-8000-000000000001";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organisation memberships and invitations
          </p>
        </div>
        <Link
          href="/app/onboarding"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Create organisation
        </Link>
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

      <Card>
        <CardHeader>
          <CardTitle>Invite member</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteForm organisationId={demoOrgId} enabled={live} />
        </CardContent>
      </Card>
    </div>
  );
}
