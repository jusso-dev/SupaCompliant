"use client";

import { useActionState } from "react";
import { inviteTeammate, type AuthActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

const initial: AuthActionState = {};

export function InviteForm({
  organisationId,
  enabled,
}: {
  organisationId: string;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(inviteTeammate, initial);

  if (!enabled) {
    return (
      <p className="text-sm text-muted-foreground">
        Configure live Supabase Auth to invite teammates into a real
        organisation.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="organisationId" value={organisationId} />
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="invite-email">
          Email
        </label>
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="invite-role">
          Role
        </label>
        <select
          id="invite-role"
          name="role"
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          defaultValue="assessor"
        >
          <option value="administrator">Administrator</option>
          <option value="assessment_lead">Assessment lead</option>
          <option value="assessor">Assessor</option>
          <option value="engineer">Engineer</option>
          <option value="reviewer">Reviewer</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>
      {state.error && (
        <p className="text-sm text-status-fail" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-status-pass" role="status">
          {state.success}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Inviting…" : "Invite member"}
      </Button>
    </form>
  );
}
