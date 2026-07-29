import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to SupaCompliant</CardTitle>
          <CardDescription>
            Local demo uses the seeded organisation without live Auth. Connect
            Supabase Auth for production deployments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              defaultValue="alex@aurora.demo"
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              defaultValue="demo-only"
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            />
          </div>
          <Button className="w-full" asChild>
            <Link href="/app">Continue to demo workspace</Link>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/" className="underline-offset-2 hover:underline">
              Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
