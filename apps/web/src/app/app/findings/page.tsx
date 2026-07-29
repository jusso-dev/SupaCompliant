"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Finding = {
  id: string;
  title: string;
  severity: string;
  status: string;
  controlId: string;
  owner?: string;
  environment?: string;
  proposedResolution?: boolean;
};

export default function FindingsPage() {
  const [findings, setFindings] = useState<Finding[]>([]);

  async function load() {
    const res = await fetch("/api/findings");
    const data = await res.json();
    setFindings(data.findings ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function patch(body: Record<string, unknown>) {
    await fetch("/api/findings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Findings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Failed controls promoted to tracked findings. Passing later does not
          auto-close without confirmation.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tracked findings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {findings.map((f) => (
            <div
              key={f.id}
              className="space-y-2 rounded-md border border-border p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{f.title}</p>
                <div className="flex gap-2">
                  <Badge variant="outline" className="capitalize">
                    {f.severity}
                  </Badge>
                  <Badge variant="secondary" className="capitalize">
                    {f.status.replaceAll("_", " ")}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                <code>{f.controlId}</code>
                {f.owner ? ` · ${f.owner}` : ""}
                {f.environment ? ` · ${f.environment}` : ""}
              </p>
              {f.proposedResolution && (
                <div className="flex flex-wrap items-center gap-2 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-950">
                  Control later passed — proposed resolution pending confirmation
                  <Button
                    size="sm"
                    onClick={() =>
                      patch({ id: f.id, action: "confirm_resolution" })
                    }
                  >
                    Confirm resolved
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    patch({
                      id: f.id,
                      action: "set_status",
                      status: "acknowledged",
                    })
                  }
                >
                  Acknowledge
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    patch({
                      id: f.id,
                      action: "accept_risk",
                      rationale: "Accepted pending redesign",
                    })
                  }
                >
                  Accept risk
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    patch({
                      id: f.id,
                      action: "propose_from_pass",
                      controlId: f.controlId,
                    })
                  }
                >
                  Simulate later pass
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
