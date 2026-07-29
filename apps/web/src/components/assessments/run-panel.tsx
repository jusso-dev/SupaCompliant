"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import type { ControlResultStatus, Severity } from "@supacompliant/shared";

type RunStatus = {
  id: string;
  status: string;
  progress: number;
  errorMessage?: string;
  digest?: string;
  posture?: {
    technicalPassRate: number | null;
    fail: number;
    unknownOrError: number;
    criticalFindings: number;
  };
  results?: Array<{
    controlId: string;
    status: ControlResultStatus;
    severity: Severity;
    summary: string;
  }>;
};

export function RunPanel() {
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState(5432);
  const [database, setDatabase] = useState("postgres");
  const [username, setUsername] = useState("supacompliant_assessor");
  const [password, setPassword] = useState("");
  const [allowPrivate, setAllowPrivate] = useState(true);
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<RunStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!runId) return;
    let alive = true;
    const tick = async () => {
      const res = await fetch(`/api/assessments/${runId}`);
      if (!res.ok) return;
      const data = (await res.json()) as RunStatus;
      if (alive) setRun(data);
    };
    void tick();
    const id = setInterval(() => void tick(), 1500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [runId]);

  async function start() {
    setStarting(true);
    setError(null);
    setRun(null);
    try {
      const res = await fetch("/api/assessments/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host,
          port,
          database,
          username,
          password: password || undefined,
          allowPrivateNetwork: allowPrivate,
          sslMode: allowPrivate ? "disable" : "require",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start");
        return;
      }
      setRunId(data.runId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setStarting(false);
    }
  }

  async function cancel() {
    if (!runId) return;
    await fetch(`/api/assessments/${runId}`, { method: "DELETE" });
  }

  const running =
    run &&
    !["completed", "failed", "cancelled"].includes(run.status);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Host
          <input
            className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={host}
            onChange={(e) => setHost(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Port
          <input
            type="number"
            className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          Database
          <input
            className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Username
          <input
            className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          Password
          <input
            type="password"
            autoComplete="off"
            className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={allowPrivate}
          onChange={(e) => setAllowPrivate(e.target.checked)}
        />
        Allow private network (local)
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={start} disabled={starting || !!running}>
          {starting ? "Starting…" : "Start assessment"}
        </Button>
        {running && (
          <Button type="button" variant="outline" onClick={cancel}>
            Cancel
          </Button>
        )}
      </div>
      {error && (
        <p className="text-sm text-status-fail" role="alert">
          {error}
        </p>
      )}
      {run && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Run {run.id.slice(0, 8)}… · {run.status}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="h-2 overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${run.progress}%` }}
              />
            </div>
            <p className="text-muted-foreground">Progress: {run.progress}%</p>
            {run.errorMessage && (
              <p className="text-status-fail">{run.errorMessage}</p>
            )}
            {run.digest && (
              <p className="break-all">
                <span className="text-muted-foreground">Digest:</span>{" "}
                <code className="text-xs">{run.digest}</code>
              </p>
            )}
            {run.posture && (
              <p>
                Pass rate:{" "}
                {run.posture.technicalPassRate == null
                  ? "n/a"
                  : `${(run.posture.technicalPassRate * 100).toFixed(1)}%`}{" "}
                · fails {run.posture.fail} · unknown/error{" "}
                {run.posture.unknownOrError} · critical{" "}
                {run.posture.criticalFindings}
              </p>
            )}
            {run.results && (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {run.results
                  .filter((r) => r.status === "fail" || r.status === "error")
                  .slice(0, 20)
                  .map((r) => (
                    <div
                      key={r.controlId}
                      className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2"
                    >
                      <StatusBadge status={r.status} />
                      <code className="text-xs">{r.controlId}</code>
                      <span className="text-muted-foreground">{r.summary}</span>
                    </div>
                  ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Completed runs are immutable. Technical results are not edited
              after completion.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
