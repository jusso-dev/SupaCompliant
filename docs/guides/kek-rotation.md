# KEK rotation runbook

Connection secrets use envelope encryption. The server KEK is
`SUPACOMPLIANT_KEK` (32-byte base64).

## Dual-KEK window

1. Generate new KEK: `openssl rand -base64 32`
2. Set both env vars on workers temporarily:
   - `SUPACOMPLIANT_KEK` = new
   - `SUPACOMPLIANT_KEK_PREVIOUS` = old
3. Run re-wrap job over `connection_secrets` (see `rewrapSecret` in
   `@supacompliant/database`).
4. Verify a sample connection preflight succeeds.
5. Remove `SUPACOMPLIANT_KEK_PREVIOUS`.

## Failure handling

- Failed re-wrap must not write partial plaintext columns (only replace
  ciphertext + wrapped_dek + kek_version atomically).
- Keep old KEK until 100% of rows report the new `kek_version`.

## Local test

```bash
pnpm --filter @supacompliant/database test
```
