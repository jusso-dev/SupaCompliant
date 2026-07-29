import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
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
            <CardTitle>Security policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Require MFA for privileged roles: recommended on</p>
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
