import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const live = isSupabaseConfigured();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organisation policy, MFA, API keys, webhooks
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              Live Supabase Auth:{" "}
              <Badge variant={live ? "pass" : "outline"}>
                {live ? "Configured" : "Not configured (demo mode)"}
              </Badge>
            </p>
            <p>
              Privileged roles (owner, administrator, assessment lead) can be
              required to use MFA when{" "}
              <code className="text-xs">require_mfa_privileged</code> is enabled
              on the organisation. Session AAL is checked server-side (
              <code className="text-xs">privilegedMfaSatisfied</code>).
            </p>
            <p className="text-xs">
              Independent project — not affiliated with Supabase, Inc. Supabase
              Auth is an optional hosting backend.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Security policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Require MFA for privileged roles: supported via org flag</p>
            <p>Assessment credentials: envelope-encrypted at rest</p>
            <p>Secrets never returned to browser clients</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>API keys & webhooks</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Scoped API keys are stored hashed with prefix, expiry, last-used
              and revocation. Webhooks are HMAC-signed with replay protection.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
