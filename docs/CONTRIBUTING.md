# Contributing

## Principles

1. Prefer depth and correctness over control count inflation.
2. Never map errors / unknowns to pass.
3. Do not copy copyrighted framework text in bulk — summarise + link.
4. Keep changes surgical (Karpathy guidelines).
5. Every new evaluator needs fixture tests.

## Development

```bash
pnpm install
pnpm test
```

## Adding a control

1. Implement in `packages/control-library/src/<category>/controls.ts`
2. Separable `collect` + pure `evaluate`
3. Add mappings with version, relationship, rationale, source URL
4. Add unit tests for the evaluator
5. Document if the control cannot be fully automated

See [guides/control-authoring.md](guides/control-authoring.md).

## RLS

App tables must have an explicit RLS decision. `pnpm check:rls` fails CI if a tenant table is missing from the migration policy set.

## Code of conduct

Be respectful. No harassment. Assume good faith in security discussions.
