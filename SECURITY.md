# Security policy

## Reporting a vulnerability

Email security reports privately to the maintainers (open a GitHub Security Advisory when the repository is published). Do not file public issues for active exploitation risks.

Include:

- Affected component / version
- Reproduction steps
- Impact assessment
- Whether you plan a coordinated disclosure timeline

We aim to acknowledge within 5 business days.

## Scope highlights

- Cross-tenant data access
- Secret leakage (connection credentials, API keys, evidence)
- Authentication / authorisation bypass
- Assessment engine treating errors as pass
- RCE or SQL injection in app or collectors
- SSRF via connection configuration

## Out of scope (examples)

- Denial of service against public demo without data impact
- Issues requiring physical access or already-compromised KEK
- Vulnerabilities only in third-party frameworks with no SupaCompliant exposure path

## Handling secrets

- Set `SUPACOMPLIANT_KEK` (32-byte base64) in all environments that encrypt connections
- Never commit `.env` files
- Rotate assessor credentials after staff changes
- Prefer ephemeral credentials in CI

See [docs/security/threat-model.md](docs/security/threat-model.md).
