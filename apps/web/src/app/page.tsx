import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
            SC
          </div>
          <span className="font-semibold">SupaCompliant</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/app">
              Open demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <div className="border-y border-amber-200 bg-amber-50">
        <p className="mx-auto max-w-6xl px-6 py-2.5 text-center text-xs font-medium leading-relaxed text-amber-950 sm:text-sm">
          Not affiliated with Supabase. Independent open-source project — not an
          official Supabase product, and not endorsed or sponsored by Supabase,
          Inc. Supabase is a trademark of Supabase, Inc.
        </p>
      </div>

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-10">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-medium text-muted-foreground">
            Open source · PostgreSQL-first · Australian assurance focus ·
            Independent (not Supabase)
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Continuous database assurance for Supabase and PostgreSQL
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Connect with a read-only assessor role. Run deterministic technical
            controls. Preserve immutable evidence. Map findings to ISM, Essential
            Eight, NIST, OWASP, CIS and more — without fake compliance scores.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/app">Explore seeded demo</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Know what changed. Preserve the evidence. Fix what matters.
          </p>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Technical, not questionnaires",
              body: "Real PostgreSQL catalogue checks for RLS, privileges, extensions, logging and more.",
            },
            {
              title: "Immutable reports",
              body: "SHA-256 digests over frozen run manifests. Historical comparisons stay honest.",
            },
            {
              title: "Transparent mappings",
              body: "Versioned framework links with rationale. Never implies certification.",
            },
          ].map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 max-w-3xl space-y-2 rounded-lg border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">
            Trademark and affiliation notice
          </p>
          <p>
            SupaCompliant is an <strong>independent open-source project</strong>.
            It is <strong>not affiliated with, endorsed by, sponsored by,
            partnered with, or officially connected to Supabase, Inc.</strong> in
            any way. It is <strong>not</strong> an official Supabase product.
          </p>
          <p>
            Supabase is a trademark of Supabase, Inc. Framework names remain the
            property of their respective owners. Passing a technical check does
            not prove whole-of-organisation compliance or any formal
            certification.
          </p>
        </div>
      </main>
    </div>
  );
}
