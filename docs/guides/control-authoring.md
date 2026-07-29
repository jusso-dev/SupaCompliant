# Control authoring guide

## Shape

```ts
defineControl({
  id: "pg.category.name",
  version: "1.0.0",
  title: "...",
  description: "...",
  rationale: "...",
  severity: "high",
  categories: ["rls"],
  targets: ["postgresql", "supabase"],
  requiredCapabilities: ["basic_catalogue"],
  collect: async (ctx) => { /* read-only SQL */ },
  evaluate: (input) => evalResult("pass"|"fail"|..., { ... }),
  remediation: rem("...", ["step"]),
  mappings: [map("ism", "2025", "...", "partially_supports", "...", url)],
});
```

## Rules

- Collectors: parameterised SQL only; `BEGIN READ ONLY` via engine client
- Evaluators: pure; no network; fixture-testable
- Missing privilege → `unknown` or `not_assessed`, never `pass`
- Manual organisational evidence → `manual_review`
- Out of scope → `not_applicable` with honest messaging

## Versioning

Bump `version` on behaviour changes that affect historical comparison semantics.
