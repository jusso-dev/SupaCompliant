import { demoComments, demoRuns } from "@/lib/demo-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CommentPanel } from "@/components/collaboration/comment-panel";

export default function ActivityPage() {
  const events = [
    ...demoRuns.map((r) => ({
      id: r.id,
      title: `${r.label} ${r.status}`,
      at: r.completedAt,
      detail: `Digest ${r.digest.slice(0, 12)}…`,
    })),
    ...demoComments.map((c) => ({
      id: c.id,
      title: `${c.author} commented`,
      at: c.at,
      detail: c.body,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Auditable organisation events and control discussions
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {events.map((e) => (
            <div key={e.id} className="border-b border-border/70 pb-3 last:border-0">
              <p className="text-sm font-medium">{e.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{e.detail}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(e.at).toLocaleString()}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Discussion</CardTitle>
        </CardHeader>
        <CardContent>
          <CommentPanel controlId="pg.rls.tables_without_rls" />
        </CardContent>
      </Card>
    </div>
  );
}
