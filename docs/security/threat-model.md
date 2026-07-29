# Threat model

## Assets

| Asset | Sensitivity |
|-------|-------------|
| Connection secrets (DB password, PAT, certs) | Critical |
| Assessment evidence (schema metadata, role lists) | High |
| Report digests and snapshots | High |
| Organisation membership / roles | High |
| User session tokens | High |
| API keys | High |
| Webhook signing secrets | High |

## Actors

- External attacker
- Malicious organisation member
- Compromised assessor credential on target
- Malicious target database
- Compromised worker process
- Dependency supply-chain attacker

## Threats and mitigations

| Threat | Mitigation |
|--------|------------|
| Cross-tenant data access | Forced RLS; API org checks; isolation tests |
| Secret leakage to browser | Secrets never in API responses; KEK only server-side |
| Secret leakage in logs | Redaction middleware; no connection strings in log fields |
| SSRF via connection host | Deny private/link-local/metadata IPs unless allowlist; DNS rebinding checks |
| SQL injection on target | Parameterised queries only; no dynamic untrusted identifiers |
| Malicious target response | Treat as hostile; schema-validate evidence; no object deserialisation |
| Report tampering | Immutable rows; SHA-256 digest; append-only audit |
| Evidence tampering | Content hash; access audit; private storage |
| Privilege escalation in app | Server-side role matrix; RLS; no UI-only authz |
| Stored XSS (comments/evidence) | Sanitise markdown; CSP; escape structured evidence render |
| Job worker compromise | Minimal IAM; secrets in memory only for job duration |
| Webhook replay | HMAC signature + timestamp window + event id |
| Unauthorised export | Role check + audit event on every export |
| Superuser assessment | Blocked unless explicit local diagnostic mode |
| Collection failure → false pass | Never map error/unknown to pass |

## Assessment SQL posture

```sql
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
```

Assessor role: `supacompliant_assessor` with minimum grants (see `docs/guides/assessor-role.sql`).

## Residual risk

- Highly privileged target roles can still observe connection attempts.
- Metadata-only sampling of sensitive columns can still surface classification signals.
- KEK compromise decrypts all stored connection secrets.
