"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  signInWithPassword,
  signUpWithPassword,
  type AuthActionState,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

const initial: AuthActionState = {};

export function LoginForm({ liveAuthEnabled }: { liveAuthEnabled: boolean }) {
  const [signInState, signInAction, signInPending] = useActionState(
    signInWithPassword,
    initial,
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUpWithPassword,
    initial,
  );

  return (
    <div className="space-y-6">
      {liveAuthEnabled ? (
        <>
          <form action={signInAction} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="current-password"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              />
            </div>
            {signInState.error && (
              <p className="text-sm text-status-fail" role="alert">
                {signInState.error}
              </p>
            )}
            <Button className="w-full" type="submit" disabled={signInPending}>
              {signInPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <form action={signUpAction} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Create an account (same email/password fields as above — use the
              form below after filling them, or use dedicated fields).
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="signup-email">
                Email
              </label>
              <input
                id="signup-email"
                name="email"
                type="email"
                required
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="signup-password">
                Password
              </label>
              <input
                id="signup-password"
                name="password"
                type="password"
                required
                minLength={8}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              />
            </div>
            {signUpState.error && (
              <p className="text-sm text-status-fail" role="alert">
                {signUpState.error}
              </p>
            )}
            {signUpState.success && (
              <p className="text-sm text-status-pass" role="status">
                {signUpState.success}
              </p>
            )}
            <Button
              className="w-full"
              type="submit"
              variant="outline"
              disabled={signUpPending}
            >
              {signUpPending ? "Creating…" : "Create account"}
            </Button>
          </form>
        </>
      ) : (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Live Supabase Auth is not configured. Set{" "}
          <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> for
          production sign-in. Demo workspace remains available.
        </p>
      )}

      <Button className="w-full" variant={liveAuthEnabled ? "outline" : "default"} asChild>
        <Link href="/app">Continue to demo workspace</Link>
      </Button>
    </div>
  );
}
