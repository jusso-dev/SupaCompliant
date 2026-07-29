"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PreflightOk = {
  ok: true;
  targetType: string;
  postgresVersion: string;
  capabilities: string[];
  fingerprint: string;
  unavailableReasons: Record<string, string>;
  controlSummary: { total: number; available: number; unavailable: number };
  unavailableControls: Array<{ id: string; title: string; reasons: string[] }>;
};

export function ConnectionWizard() {
  const [targetType, setTargetType] = useState<"supabase" | "postgresql">(
    "postgresql",
  );
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState(5432);
  const [database, setDatabase] = useState("postgres");
  const [username, setUsername] = useState("supacompliant_assessor");
  const [password, setPassword] = useState("");
  const [sslMode, setSslMode] = useState<"disable" | "require" | "verify-full">(
    "require",
  );
  const [projectRef, setProjectRef] = useState("");
  const [managementToken, setManagementToken] = useState("");
  const [allowPrivate, setAllowPrivate] = useState(true);
  const [persistSecrets, setPersistSecrets] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreflightOk | null>(null);
  const [encryptNote, setEncryptNote] = useState<string | null>(null);

  async function runPreflight() {
    setBusy(true);
    setError(null);
    setResult(null);
    setEncryptNote(null);
    try {
      const res = await fetch("/api/connections/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          host,
          port,
          database,
          username,
          password: password || undefined,
          sslMode,
          projectRef: projectRef || undefined,
          managementToken: managementToken || undefined,
          allowPrivateNetwork: allowPrivate,
          persistSecrets,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Preflight failed");
        return;
      }
      setResult(data as PreflightOk);

      // Exercise encryption path without returning plaintext
      if (password || managementToken) {
        const enc = await fetch("/api/connections/encrypt-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password: password || undefined,
            managementToken: managementToken || undefined,
          }),
        });
        const encData = await enc.json();
        if (enc.ok) {
          setEncryptNote(
            persistSecrets
              ? `Secrets envelope-encrypted for storage (ciphertext length ${encData.ciphertextLength}). Plaintext never returned.`
              : "Ephemeral mode: secrets will be used for one run only and not persisted.",
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Target type">
          <select
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={targetType}
            onChange={(e) =>
              setTargetType(e.target.value as "supabase" | "postgresql")
            }
          >
            <option value="postgresql">Generic PostgreSQL</option>
            <option value="supabase">Supabase project</option>
          </select>
        </Field>
        <Field label="Name (optional)">
          <input
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            placeholder="Production assessor"
            disabled
            value=""
          />
        </Field>
        <Field label="Host">
          <input
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={host}
            onChange={(e) => setHost(e.target.value)}
          />
        </Field>
        <Field label="Port">
          <input
            type="number"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
          />
        </Field>
        <Field label="Database">
          <input
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
          />
        </Field>
        <Field label="Username">
          <input
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            autoComplete="off"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Never shown in responses"
          />
        </Field>
        <Field label="SSL mode">
          <select
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={sslMode}
            onChange={(e) =>
              setSslMode(e.target.value as typeof sslMode)
            }
          >
            <option value="require">require</option>
            <option value="verify-full">verify-full</option>
            <option value="disable">disable (local only)</option>
          </select>
        </Field>
        {targetType === "supabase" && (
          <>
            <Field label="Project ref">
              <input
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={projectRef}
                onChange={(e) => setProjectRef(e.target.value)}
              />
            </Field>
            <Field label="Management token">
              <input
                type="password"
                autoComplete="off"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={managementToken}
                onChange={(e) => setManagementToken(e.target.value)}
              />
            </Field>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allowPrivate}
            onChange={(e) => setAllowPrivate(e.target.checked)}
          />
          Allow private network (local diagnostic)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={persistSecrets}
            onChange={(e) => setPersistSecrets(e.target.checked)}
          />
          Persist secrets (envelope-encrypted)
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        Prefer the{" "}
        <code className="text-[11px]">supacompliant_assessor</code> role — see{" "}
        <code className="text-[11px]">docs/guides/assessor-role.sql</code>.
        Superuser usernames are blocked unless advanced diagnostic mode is used.
      </p>

      <Button type="button" onClick={runPreflight} disabled={busy}>
        {busy ? "Testing…" : "Test connection & preflight"}
      </Button>

      {error && (
        <p className="text-sm text-status-fail" role="alert">
          {error}
        </p>
      )}

      {encryptNote && (
        <p className="text-sm text-muted-foreground" role="status">
          {encryptNote}
        </p>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Capability matrix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{result.targetType}</Badge>
              <Badge variant="outline">
                {result.controlSummary.available}/{result.controlSummary.total}{" "}
                controls available
              </Badge>
            </div>
            <p>
              <span className="text-muted-foreground">Version:</span>{" "}
              {result.postgresVersion}
            </p>
            <p>
              <span className="text-muted-foreground">Fingerprint:</span>{" "}
              <code className="text-xs">{result.fingerprint}</code>
            </p>
            <p>
              <span className="text-muted-foreground">Capabilities:</span>{" "}
              {result.capabilities.join(", ")}
            </p>
            {Object.keys(result.unavailableReasons).length > 0 && (
              <div>
                <p className="font-medium">Capability gaps</p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {Object.entries(result.unavailableReasons).map(([k, v]) => (
                    <li key={k}>
                      <strong>{k}</strong>: {v}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.unavailableControls.length > 0 && (
              <div>
                <p className="font-medium">
                  Unavailable checks ({result.controlSummary.unavailable})
                </p>
                <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                  {result.unavailableControls.map((c) => (
                    <li key={c.id}>
                      <code>{c.id}</code> — {c.reasons.join("; ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
