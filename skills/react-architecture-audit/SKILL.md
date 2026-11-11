---
name: react-architecture-audit
description: Audits an existing React codebase, read-only, against the react-architecture feature-structure model and reports misplaced files, screen organization, feature public entries, contexts, and improper deep imports. Use when asked to check, review, or inventory React feature structure, including an "audit and fix" request (audit first; fixes then go to react-structural-migration); not for generic React quality checks, and it never changes files.
---

# React Architecture Audit

Audit the existing repository's structural conformance to `react-architecture`. This skill is always read-only: inspect, search, and report; do not move files, edit imports, create barrels, or run automated fixes. If the user asks to fix the findings, finish the report first, then hand it to `react-structural-migration`, which changes files only after the user approves its plan.

This skill is about feature structure only. Do not turn it into lint, accessibility, performance, test, clean-code, React Doctor, or generic code-quality audit. Report those only when they directly prevent determining the requested structural fact.

## Establish the applicable model

Load the model first. If the `react-architecture` skill is installed, read its `SKILL.md` and use it as the reference. If it is not available, use the summary below as the reference. State in the report which of the two was used.

Then identify the application's feature roots, route/composition layer, configured import aliases, and any documented local convention that intentionally differs from the default. "Documented" means a comment at the import or file, an ADR, or the project's contributor or agent instructions. The `react-architecture` model, in summary:

- Feature implementation is grouped by concern, with screens under `screens/`.
- A feature root normally contains its public entry point (`index.ts`) rather than loose implementation files.
- `components/`, `hooks/`, `context/`, `services/`, `types/`, and `utils/` are feature-scoped when they belong to one feature. `context/` is for feature-owned Context/Provider pairs; `services/` is for feature-owned data access.
- The import-boundary rules below apply to all code. The placement rules above are required for new or changed features and are SHOULD-level for existing code.
- Cross-feature consumers ordinarily use a feature's public barrel rather than implementation-path imports.
- A thin `XScreen` dispatcher may select desktop and mobile sibling screens when the whole screen differs; isolated responsive variation should remain at component level.
- Files inside a feature import each other by relative path, never through the feature's own barrel. Dependencies between features go through public entries and do not form a cycle.

A loose feature-root implementation file is a screen, component, hook, context, service, type, or utility file placed directly in the feature root. Tests (`*.test.*`, `*.spec.*`), stories (`*.stories.*`), and style modules co-located beside the file they cover are not findings. Feature-root files such as `routes.*` or `constants.*` are findings at `low` severity unless a documented local convention places them there.

If the repository has no identifiable feature root (for example a type-based layout with top-level `components/`, `hooks/`, and `pages/`, or a `modules/` tree with a different contract), do not force the model onto it. Report that the model does not apply as it stands, describe the layout found, and ask the user whether to audit against the local convention or against this model.

Do not assume every optional folder must exist, or flag shared/app-level code as feature code. Respect deliberate, documented route-level direct imports that preserve lazy-loading boundaries; report unexplained deep imports rather than treating the exception as a general rule.

## Audit method

Map the feature folders and their public entries, then search imports across the repository. Inspect routes and central composition files separately because they may be legitimate exceptions. Compare features against each other: the same kind of file (screens, contexts, barrels) should be placed the same way in every feature, so report the outliers.

Search so that the result can be reproduced:

- Read `tsconfig.json` (`compilerOptions.baseUrl` and `paths`) and the bundler's alias settings first, so alias imports and relative imports of the same module are both matched.
- Search static `import` and `export ... from` statements, `export *` re-exports, dynamic `import()`, and `require()`.
- Exclude `node_modules`, build output, and generated code. In a monorepo, state which packages were scanned.
- Use ripgrep or the search tool available. If the repository already has a dependency tool configured (dependency-cruiser, madge, an ESLint boundaries rule), run its existing read-only report and cite it; do not install one.
- If the repository is too large to scan completely, say what was sampled. Never present a partial scan as complete.

Report concrete evidence, not style preferences. Useful findings include:

- loose feature-root implementation files;
- screen files outside `screens/`;
- components, hooks, contexts/providers, types, or utilities placed outside their feature concern folder;
- cross-feature deep imports that bypass a public entry;
- missing or inconsistent public barrels;
- responsive screen siblings/dispatchers arranged inconsistently with the responsive split decision;
- feature-owned providers or contexts placed outside the feature structure; and
- inconsistencies repeated across feature folders.

Do not declare a route-level lazy import invalid solely because it targets a screen instead of the barrel. Determine whether it is a narrow code-splitting exception before reporting it.

## Report format

Every report, including a clean one, starts with a coverage summary: the model source used, the feature roots and the number of features scanned, the number of files scanned, and what was excluded or not scanned.

Group results by feature. Every finding carries the exact file and line (`file:line`) or import statement, the violated rule, the expected structure, a `severity`, a `confidence`, and the search pattern or command that found it. Include a compact summary of intentional exceptions and assumptions.

`severity` is mandatory:

- `high`: the public boundary is broken or a cycle exists. A cross-feature deep import that bypasses a public entry, a circular dependency between features, a file importing its own feature's barrel.
- `medium`: feature code sits outside its feature, or the feature has no usable public entry. A feature-owned provider or data-access module outside the feature, a missing public barrel that other features need. Also a placement breach (a loose feature-root implementation file, a screen outside `screens/`) when the audit scope is new or changed code, such as a branch or a pull request, where placement is a MUST.
- `low`: an inconsistency or a SHOULD-level deviation. A placement breach in existing code, the same convention applied unevenly between features, optional structure used inconsistently.

`confidence` is `confirmed` when the file or import was read, and `inferred` when it was deduced from names or from a partial scan.

For example:

```yaml
coverage:
  model: react-architecture skill
  feature_roots: [src/features]
  features_scanned: 12
  files_scanned: 418
  excluded: [node_modules, dist, src/generated]
features:
  - feature: calendar
    findings:
      - file: src/features/calendar/CalendarScreen.tsx:1
        violation: Screen implementation is loose at the feature root.
        expected: src/features/calendar/screens/CalendarScreen.tsx
        rule: Feature roots expose public entries; screens are grouped under screens/.
        severity: low
        confidence: confirmed
        found_by: "rg --files --max-depth 1 src/features/calendar"
exceptions:
  - src/routes/index.tsx lazy-imports calendar/screens/CalendarScreen (documented code-splitting boundary)
```

If no violations are found, state the scanned scope and the conventions verified. Do not change the repository. If the user wants remediation, hand the findings to `react-structural-migration` and preserve the distinction between the audit and the migration. If that skill is not installed, say so and leave the report as the deliverable; do not start moving files under this skill.
