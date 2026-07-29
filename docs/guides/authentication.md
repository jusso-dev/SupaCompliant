# Authentication

SupaCompliant supports two modes:

## Demo mode (default without env)

- No Supabase credentials required
- **Continue to demo workspace** uses in-memory seeded data
- No secrets leave the browser because none are loaded

## Live Supabase Auth

Set:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Optional:

```bash
SUPACOMPLIANT_DISABLE_DEMO_AUTH=1   # hide demo shortcut if desired
```

### Flows

| Flow | Implementation |
|------|----------------|
| Sign in | Server action `signInWithPassword` via `@supabase/ssr` cookies |
| Sign up | Server action `signUpWithPassword` |
| Sign out | Server action `signOut` |
| Session refresh | `middleware.ts` → `updateSession` |
| Create org | RPC `create_organisation` (SECURITY DEFINER) |
| Invite | Insert into `invitations` + `audit_events` |

### MFA for privileged roles

Helper: `privilegedMfaSatisfied` in `apps/web/src/lib/auth/mfa.ts`.

When organisation `require_mfa_privileged` is true and membership role is
owner / administrator / assessment_lead, session AAL must be `aal2`+.

### Security notes

- Never put service-role key in `NEXT_PUBLIC_*`
- Browser only receives anon key + user session cookies
- Independent open-source project — **not affiliated with Supabase, Inc.**
