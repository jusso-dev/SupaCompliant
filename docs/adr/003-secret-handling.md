# ADR-003: Connection secret handling

## Status

Accepted

## Context

Assessment credentials (DB passwords, PATs, certs) are highly sensitive. Browser and logs must never receive them. Some users want ephemeral credentials for a single run.

## Decision

1. Secrets encrypted at rest with **envelope encryption**:
   - Random DEK (AES-256-GCM) per secret blob
   - DEK wrapped with server KEK from `SUPACOMPLIANT_KEK` (32-byte base64)
   - Ciphertext + nonce + wrapped DEK stored in `connection_secrets`
2. Application columns store only non-secret metadata (host, port, SSL mode, project ref, capability flags).
3. Decryption only in worker and server-side preflight routes — never in client bundles.
4. Structured logs use redaction for password/token patterns; connection strings are never logged.
5. **Ephemeral mode**: credentials accepted for one run via one-time encrypted job payload; no `connection_secrets` row.
6. Browser never receives service-role keys, DB passwords, access tokens, or raw evidence secrets.

## Consequences

- Rotating KEK requires a re-wrap job.
- Loss of KEK = permanent loss of stored connection secrets (by design).
- SSRF controls still required on host resolution in the worker.
