# CLI

```bash
pnpm --filter @supacompliant/cli build
node apps/cli/dist/index.js version
```

Publish path (when ready):

```json
// apps/cli/package.json
"name": "supacompliant",
"bin": { "supacompliant": "./dist/index.js" }
```

```bash
# from apps/cli after build
npm publish --access public
```

## CI mode

```bash
export SUPACOMPLIANT_DATABASE_URL='postgres://supacompliant_assessor:***@host:5432/db'
export SUPACOMPLIANT_ALLOW_PRIVATE=0
pnpm --filter @supacompliant/cli exec node dist/index.js assess \
  --fail-on critical \
  --output sarif \
  --out results.sarif.json
```

Secrets are never printed. Connection strings in errors are redacted.
