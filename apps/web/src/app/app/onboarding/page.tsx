import { CreateOrgForm } from "@/components/auth/create-org-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function OnboardingPage() {
  const live = isSupabaseConfigured();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Create organisation
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          First step after sign-up. You become the organisation owner.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Organisation</CardTitle>
          <CardDescription>
            Creates membership as owner and writes an audit event via{" "}
            <code className="text-xs">create_organisation</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {live ? (
            <CreateOrgForm />
          ) : (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Live Auth is not configured. Use the demo workspace, or set
                Supabase public env vars.
              </p>
              <Button asChild>
                <Link href="/app">Open demo workspace</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
