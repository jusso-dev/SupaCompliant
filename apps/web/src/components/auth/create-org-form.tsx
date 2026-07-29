"use client";

import { useActionState } from "react";
import {
  createOrganisation,
  type AuthActionState,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

const initial: AuthActionState = {};

export function CreateOrgForm() {
  const [state, action, pending] = useActionState(createOrganisation, initial);

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="org-name">
          Organisation name
        </label>
        <input
          id="org-name"
          name="name"
          required
          minLength={2}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          placeholder="Acme Security"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="org-slug">
          Slug
        </label>
        <input
          id="org-slug"
          name="slug"
          required
          pattern="[a-z0-9-]+"
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          placeholder="acme-security"
        />
      </div>
      {state.error && (
        <p className="text-sm text-status-fail" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create organisation"}
      </Button>
    </form>
  );
}
