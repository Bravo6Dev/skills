---
name: react-architecture
description: Defines the target React feature structure (feature folders, screens, responsive composition, contexts, public entry points) and applies it at generation time. Use when adding or materially expanding a feature folder, screen, feature-owned context, or feature barrel, or when placing or moving a single file as part of a feature change; not for repository-wide audits (react-architecture-audit) or multi-file structural migrations (react-structural-migration).
---

# React Architecture

Use this skill to choose a clear, proportionate structure for React features. It defines the target architecture while code is being designed or changed. It does not audit an existing repository, perform a broad migration, replace project conventions, or duplicate lint, React Doctor (the `react-doctor` diagnostics CLI), accessibility, performance, or clean-code review.

Rules marked MUST are requirements. The import-boundary rules (cross-feature imports go through the public entry, a file never imports its own feature's barrel, no dependency cycle between features) apply to all code, existing or new. The placement rules (no loose implementation files at the feature root, screens under `screens/`) are a MUST for new or changed features and SHOULD-level for existing code that the change in hand does not touch. `react-architecture-audit` reports a breach of a structural MUST as a violation; the runtime MUSTs under "Responsive screens" are outside its scope. Statements worded with *prefer*, *normally* or *when practical* are SHOULD-level defaults: deviate when the feature has a reason, and treat a deviation as low severity at most.

## Start from the local codebase

Inspect the relevant feature and nearby routes before introducing a pattern. Preserve established project conventions when they are compatible with this model. When a local convention conflicts with it (a different features root, type-based folders, another barrel policy), follow the local convention for the change in hand and tell the user where it differs. Do not restructure toward this model unless the user asks.

Before choosing a structure, detect:

* the framework and rendering model: a client-side SPA (Vite, CRA or similar) or Next.js App Router with Server Components. Read `package.json` and look for an `app/` or `pages/` router directory. If it cannot be determined, ask the user.
* the import alias configuration (`compilerOptions.paths` in `tsconfig.json` and the bundler's alias settings). Use the alias form the project already uses; do not introduce one.
* the file-naming convention already in use for component, hook, context and type files. Follow it; the file names in this skill are examples, not a required convention.
* existing import-boundary lint rules (`no-restricted-imports`, `import/no-restricted-paths`, `eslint-plugin-boundaries`, dependency-cruiser).

For a new or materially expanded feature, prefer a feature-owned structure such as:

```text
features/calendar/
├── index.ts
├── screens/
│   ├── CalendarScreen.tsx
│   ├── DesktopCalendarScreen.tsx
│   └── MobileCalendarScreen.tsx
├── components/
├── hooks/
├── context/                 # optional; feature-owned Context/Provider pairs
├── services/                # optional; feature-owned data access (API calls)
├── types/
└── utils/
```

Folders are optional when the feature has no corresponding concern.

For a complete worked feature with file contents (types, service, hooks, components, screen, barrel, route), read [references/feature-example.md](references/feature-example.md) when scaffolding a new feature or when unsure how the pieces connect.

Use `context/` when a React Context and its Provider are owned by the feature. Keep the Context definition and Provider together there when practical.

Example:

```text
features/auth/
├── context/
│   ├── AuthProvider.tsx
│   └── auth-context.ts
```

App-wide providers belong with the application's composition conventions instead.

Keep implementation files in their appropriate subfolder. The feature root exposes the public entry point (`index.ts`) rather than becoming a second implementation directory. For new or changed features this is a MUST: no loose screen, component, hook, context, service, type or utility files at the feature root, and screens go under `screens/`. Existing features that the change does not touch are left as they are.

Where other code goes:

* Data access owned by one feature (HTTP calls, query functions) lives in that feature's `services/` folder, or under the project's existing name for it such as `api/`. Screens and components reach it through hooks.
* Tests, stories and style modules follow the project's existing placement. If there is none, co-locate each next to the file it covers; a co-located test or story is not a loose implementation file.
* Code used by more than one feature lives outside `features/`, in the project's existing shared location (for example `shared/`, `components/` or `lib/`). Do not reach it through another feature's internals.
* A feature may depend on another feature only through that feature's public entry point, and dependencies between features MUST NOT form a cycle. If two features need each other, move the shared part to the shared location.

## Responsive screens

When a screen has substantially different desktop and mobile composition, use the **responsive screen dispatcher** pattern:

```tsx
// screens/CalendarScreen.tsx
import { DesktopCalendarScreen } from './DesktopCalendarScreen';
import { MobileCalendarScreen } from './MobileCalendarScreen';
// useIsMobile: the project's existing breakpoint hook (see below).

export function CalendarScreen() {
  const isMobile = useIsMobile();

  return isMobile
    ? <MobileCalendarScreen />
    : <DesktopCalendarScreen />;
}
```

`CalendarScreen` is intentionally thin. `DesktopCalendarScreen` and `MobileCalendarScreen` own their respective layouts and interaction composition.

`useIsMobile` stands for the project's existing breakpoint hook; reuse it rather than adding a second one. If the project has none, add one in the shared hooks location, not inside a single feature. Where the app is server-rendered the hook MUST be SSR-safe (for example `useSyncExternalStore` over `matchMedia` with a server snapshot), so the first client render matches the server HTML.

Switching variants unmounts the other subtree. Local state, scroll position and unsaved form input held inside a variant are lost when the breakpoint is crossed (resize, rotation), so state that has to survive the switch MUST live above the variants: in the dispatcher, a feature context, or the data layer. The sample imports both variants statically, so every device downloads both; lazy-load the variants when they are large.

Keep shared data fetching, mutations, domain state, and reusable behavior outside responsive sibling screens when practical. Responsive variants should primarily differ in layout and interaction composition, not duplicate feature logic.

Prefer the smallest responsive mechanism that fits the difference:

* Use CSS or responsive layout primitives when the DOM and interaction model remain substantially the same.
* Swap a responsive sub-component when only an isolated region differs.
* Split into sibling desktop/mobile screens when most page structure, composition, navigation, or interaction differs.

Do not create sibling screens merely to vary spacing, styling, or a small presentational fragment.

## Public entry points and imports

Treat a feature's barrel as its public API for ordinary cross-feature consumers:

```ts
// features/calendar/index.ts
export { CalendarScreen } from './screens/CalendarScreen';
export type { CalendarEvent } from './types/calendar.types';
```

External feature code MUST import from the feature entry point; the route-level lazy import described below is the only exception. Implementation files inside the same feature MUST use direct relative imports and MUST NOT import the feature's own `index.ts`, which creates a circular import through the barrel.

Feature-owned contexts, hooks, components, or types that are intentionally public should normally be exposed through the feature's public entry point rather than deep-imported by external consumers.

A barrel with no JSX should normally remain `index.ts`. Re-exporting React components does not itself require `.tsx`.

The public API boundary and a lazy-loading/code-splitting boundary serve different purposes and need not be the same module.

Route or composition code may deliberately lazy-import a specific screen file when importing the feature barrel would combine unrelated screens into the same chunk.

Treat this as a narrow architectural exception at the route/composition layer. It is not permission for arbitrary deep imports throughout the application.

Example:

```tsx
const CalendarScreen = lazy(() =>
  import('../features/calendar/screens/CalendarScreen').then((m) => ({
    default: m.CalendarScreen,
  })),
);
```

`React.lazy` needs a module with a default export. Screens in this skill use named exports, so the sample maps the named export; if the project default-exports its screens, follow that instead. Write the import path in the alias or relative form the project already uses.

Use direct route-level imports only when they serve an intentional code-splitting boundary.

These import rules hold only where a linter enforces them. If the detection step found boundary rules, keep new code within them. If there are none, do not install or configure anything unasked: tell the user the boundary is unenforced and propose a rule, such as ESLint `no-restricted-imports` with a pattern that blocks paths below a feature's root from outside that feature, or `eslint-plugin-boundaries`, with an exception for the route/composition layer if it lazy-imports screens.

## Next.js App Router

When the project uses the App Router with Server Components:

* Files under `app/` (`page.tsx`, `layout.tsx`) are routes owned by the framework. Keep them thin and have them render a feature screen; `screens/` holds screen components, not route files.
* A file that uses state, effects, context or browser APIs must be a Client Component: it carries `'use client'` at its top itself, or it is imported only from Client Components. The directive is needed on the file at the server/client boundary, not on every file below it. A screen dispatcher that calls a breakpoint hook is a Client Component.
* Do not re-export server-only modules and Client Components from the same barrel. A Client Component importing that barrel pulls the server-only module into the client module graph. Split the public entry (for example a separate server entry) or import the server module directly from the route.
* Routes are already split per segment, so the route-level lazy-import exception above is rarely needed.

## Verification

After adding or changing feature structure, public barrels, or relevant file extensions:

* run the repository's applicable typecheck
* run the repository's actual lint command
* run relevant tests when behavior-bearing code was changed

Do not rely on typechecking alone after barrel or file-extension changes. Framework or plugin rules can fail independently of TypeScript.

A common React/Vite example is Fast Refresh linting around mixed exports in `.tsx` files, but the rule here is broader: use the repository's real validation commands rather than assuming a successful typecheck proves the structure is valid.

## Scope and handoff

Make the smallest structural choice that suits the feature. Do not turn a normal feature change into a repository-wide reorganization.

Use:

* `react-architecture-audit` for a read-only inventory of structural deviations across an existing React repository.
* `react-structural-migration` for behavior-preserving moves, renames, regrouping, or architecture migration across existing React code.

Placing or moving a single file as part of the feature change in hand stays with this skill. Regrouping several existing files is a migration. A request to "audit and fix" starts with `react-architecture-audit`; the fixes then go to `react-structural-migration` once the user approves its plan. If either skill is not installed, say so rather than doing its work under this one.

This skill defines the target structure. It does not own broad auditing or migration orchestration.
