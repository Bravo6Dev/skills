---
name: react-architecture-audit
description: Read-only audit of an existing React codebase against the react-architecture feature-structure model. Use to report misplaced files, screen organization, feature public entries, contexts, and improper deep imports; not for generic React quality checks or fixing findings.
---

# React Architecture Audit

Audit the existing repository's structural conformance to `react-architecture`. This is read-only by default: inspect, search, and report; do not move files, edit imports, create barrels, or run automated fixes unless the user explicitly asks to fix the findings.

This skill is about feature structure only. Do not turn it into lint, accessibility, performance, test, clean-code, React Doctor, or generic code-quality audit. Report those only when they directly prevent determining the requested structural fact.

## Establish the applicable model

First identify the application's feature roots, route/composition layer, configured import aliases, and any documented local convention that intentionally differs from the default. Use the `react-architecture` model as the reference:

- Feature implementation is grouped by concern, with screens under `screens/`.
- A feature root normally contains its public entry point (`index.ts`) rather than loose implementation files.
- `components/`, `hooks/`, `context/`, `types/`, and `utils/` are feature-scoped when they belong to one feature. `context/` is for feature-owned Context/Provider pairs.
- Cross-feature consumers ordinarily use a feature's public barrel rather than implementation-path imports.
- A thin `XScreen` dispatcher may select desktop and mobile sibling screens when the whole screen differs; isolated responsive variation should remain at component level.

Do not assume every optional folder must exist, or flag shared/app-level code as feature code. Respect deliberate, documented route-level direct imports that preserve lazy-loading boundaries; report unexplained deep imports rather than treating the exception as a general rule.

## Audit method

Map the feature folders and their public entries, then search imports across the repository. Inspect routes and central composition files separately because they may be legitimate exceptions. Compare similarly sized features to reveal inconsistent application of the same convention.

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

Group results by feature. For every finding, name the exact file or import, the violated rule, the expected structure, and an importance level (`high`, `medium`, or `low`) when it helps prioritization. Include a compact summary of intentional exceptions and assumptions. For example:

```yaml
Feature: Calendar
- file: features/calendar/CalendarScreen.tsx
  violation: Screen implementation is loose at the feature root.
  expected: features/calendar/screens/CalendarScreen.tsx
  rule: Feature roots expose public entries; screens are grouped under screens/.
  severity: medium
```

If no violations are found, state the scanned scope and the conventions verified. Do not change the repository. If the user wants remediation, hand the findings to `react-structural-migration` and preserve the distinction between the audit and the migration.
