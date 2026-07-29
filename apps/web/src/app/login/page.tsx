import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function LoginPage() {
  const live = isSupabaseConfigured();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to SupaCompliant</CardTitle>
          <CardDescription>
            {live
              ? "Use your organisation credentials. Privileged roles may require MFA when enabled by policy."
              : "Demo mode: open the seeded workspace without live Auth, or configure Supabase env vars for production."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm liveAuthEnabled={live} />
          <p className="text-center text-xs text-muted-foreground">
            Independent open-source project — not affiliated with Supabase, Inc.{" "}
            <Link href="/" className="underline-offset-2 hover:underline">
              Home
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
