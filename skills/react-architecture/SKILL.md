---
name: react-architecture
description: Define and apply React feature structure while designing, creating, or modifying React code. Use for generation-time decisions about feature folders, screens, responsive composition, contexts, and public entry points; not for repository-wide audits or structural migrations.
---

# React Architecture

Use this skill to choose a clear, proportionate structure for React features. It defines the target architecture while code is being designed or changed. It does not audit an existing repository, perform a broad migration, replace project conventions, or duplicate lint, React Doctor, accessibility, performance, or clean-code review.

## Start from the local codebase

Inspect the relevant feature and nearby routes before introducing a pattern. Preserve established project conventions when they are compatible with this model.

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
├── types/
└── utils/
```

Folders are optional when the feature has no corresponding concern.

Use `context/` when a React Context and its Provider are owned by the feature. Keep the Context definition and Provider together there when practical.

Example:

```text
features/auth/
├── context/
│   ├── AuthProvider.tsx
│   └── auth-context.ts
```

App-wide providers belong with the application's composition conventions instead.

Keep implementation files in their appropriate subfolder. The feature root normally exposes the public entry point (`index.ts`) rather than becoming a second implementation directory.

## Responsive screens

When a screen has substantially different desktop and mobile composition, use the **responsive screen dispatcher** pattern:

```tsx
// screens/CalendarScreen.tsx
export function CalendarScreen() {
  const isMobile = useIsMobile();

  return isMobile
    ? <MobileCalendarScreen />
    : <DesktopCalendarScreen />;
}
```

`CalendarScreen` is intentionally thin. `DesktopCalendarScreen` and `MobileCalendarScreen` own their respective layouts and interaction composition.

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

External feature code should import from the feature entry point. Implementation files inside the same feature may use direct relative imports.

Feature-owned contexts, hooks, components, or types that are intentionally public should normally be exposed through the feature's public entry point rather than deep-imported by external consumers.

A barrel with no JSX should normally remain `index.ts`. Re-exporting React components does not itself require `.tsx`.

The public API boundary and a lazy-loading/code-splitting boundary serve different purposes and need not be the same module.

Route or composition code may deliberately lazy-import a specific screen file when importing the feature barrel would combine unrelated screens into the same chunk.

Treat this as a narrow architectural exception at the route/composition layer. It is not permission for arbitrary deep imports throughout the application.

Example:

```tsx
const CalendarScreen = lazy(
  () => import('../features/calendar/screens/CalendarScreen'),
);
```

Use direct route-level imports only when they serve an intentional code-splitting boundary.

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

This skill defines the target structure. It does not own broad auditing or migration orchestration.
