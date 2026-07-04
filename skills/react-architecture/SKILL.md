---
name: react-architecture
description: >-
  Use this skill whenever writing, generating, scaffolding, or refactoring
  React or Next.js code (components, pages, hooks, features, or full apps)
  in TypeScript or JavaScript. It enforces production-grade architecture
  instead of monolithic files - one component per file, feature-based
  folder structure, barrel exports, business logic pulled into hooks,
  prop-drilling avoidance, memoization and lazy-loading judgment, and
  modern data-fetching patterns. Consult this any time the request
  involves more than a trivial one-off snippet, including "build a page",
  "add a feature", "create a component", "make a dashboard", working
  inside an existing React codebase, or starting a new React project.
---
 
# React Architecture & Code Generation
 
The point of this skill is to stop React code from collapsing into 500-line
files that mix fetching, state, formatting, and JSX together. Every rule
below exists to keep a codebase navigable by someone who didn't write it,
including a future instance of Claude. Apply judgment about scale rather
than mechanically maximizing structure — the goal is maintainability, not
ceremony.
 
## Scale the structure to the task
 
Before generating anything, decide how much architecture the request
actually needs:
 
- **Trivial edit** (fix a prop type, rename a variable, adjust a class name,
  one-line bug fix): make the smallest correct change. Don't restructure a
  file just because you're touching it.
- **New component, hook, or small feature**: apply the structure below from
  the start. Retrofitting architecture onto code later is far more expensive
  than starting with it, and the patterns here cost little extra effort once
  practiced.
- **New page or feature of real size**: apply everything — folder structure,
  barrel exports, hook extraction, the works.
## Match what's already there first
 
Before introducing a pattern, look at the existing project: `package.json`
for installed libraries, the current `src/` layout, whether it's
feature-folders or type-folders, what data-fetching and state libraries are
already wired up. Consistency with the existing codebase beats textbook
purity — dropping Zustand into a Redux Toolkit app, or TanStack Query next
to an existing SWR setup, makes the codebase harder to reason about even
though each piece is individually "correct." Reach for a new dependency only
when there's a genuine gap (see "Prop drilling" below), and say so to the
user rather than adding it silently.
 
If the project has no established conventions yet (a fresh app, or this is
the first feature), the patterns in this skill are good defaults.
 
## 1. One component per file
 
A file that exports several components invites them to quietly start
sharing internal state and assumptions, which is how a 40-line file becomes
a 400-line file. One component per file forces each one to have an explicit,
typed interface with its siblings.
 
- One reusable component, one file, named after the component.
- A large page becomes a thin composition of section components
  (`ProfileHeader`, `ProfileStats`, `ProfileActivity`), not a single render
  method with five logical chunks inside it.
- If a section itself has distinct sub-parts (a stat card repeated three
  times, a form with its own validation), split those out too.
- Small private presentational pieces used only by one parent (e.g. a single
  `<Row>` inside a table) can live in the same file as that parent — the
  rule is about *reusable* components, not literally every JSX-returning
  function.
## 2. Organize by feature, not by technical type
 
A `components/`, `hooks/`, `services/` split *at the app root* scales badly:
working on "user profile" means jumping between four unrelated top-level
folders. Group by feature instead, and use the technical split *within* each
feature:
 
```
features/
└── user-profile/
    ├── components/
    ├── hooks/
    ├── services/
    ├── types/
    ├── utils/
    └── index.ts
```
 
Cross-feature primitives (a `Button`, a `Modal`, a generic `useDebounce`)
belong in a shared location (`components/ui/`, `hooks/shared/`) — feature
folders are for things that genuinely belong to one feature. See
`references/feature-example.md` for a complete worked example with real
file contents.
 
## 3. Barrel exports define the public API
 
Each feature's `index.ts` is the only thing other features should import
from. This makes it possible to refactor everything *inside* a feature
without breaking anyone who depends on it.
 
```ts
// features/user-profile/index.ts
export { ProfileHeader } from './components/ProfileHeader';
export { useUserProfile } from './hooks/useUserProfile';
export type { UserProfile } from './types/userProfile.types';
```
 
Prefer `import { useUserProfile } from '@/features/user-profile'` over
reaching into `@/features/user-profile/hooks/useUserProfile` from outside
the feature. Internal files within the same feature can import directly
from each other — the barrel is a boundary between features, not a rule for
every import everywhere.
 
## 4. Separate concerns deliberately
 
Each of these is a different kind of code and deserves a different kind of
file:
 
- **Rendering** — components. They receive data and callbacks, return JSX.
- **Business logic** — what to do with data, derived values, orchestration.
  Lives in hooks, not inline in the component body.
- **API communication** — fetch/axios calls, request shaping, response
  parsing. Lives in a `services/` file, called from hooks, never called
  directly from a component.
- **Utilities** — pure functions with no React dependency (formatting,
  calculations, validation). Lives in `utils/`, easy to unit test in
  isolation.
- **Types** — shared interfaces and types, especially ones used across
  components/hooks/services in the same feature.
A component that does `useEffect(() => { fetch(...) })` directly has fused
two of these together. A component is doing its job when reading it tells
you what's on screen, not how the data got there.
 
## 5. Extract helper functions, don't nest them in components
 
If a function doesn't reference component state or props directly, it
doesn't need to live inside the component. Move it to `utils/`. This makes
the function independently testable and stops component files from growing
with logic that has nothing to do with rendering.
 
## 6. Push reusable logic into custom hooks
 
Anything stateful or effectful that more than one component might need —
data fetching, filtering, sorting, pagination, derived state, form
handling — belongs in a hook, not copy-pasted across components or buried
in one component's body.
 
```ts
// hooks/useUserProfile.ts
export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => fetchUserProfile(userId),
  });
}
```
 
The component that uses it just calls `const { data, isLoading } =
useUserProfile(userId)` — it doesn't know or care that React Query is
involved.
 
## 7. Prop drilling: pick the tool that matches the actual problem
 
Passing a prop down isn't inherently bad — it's explicit and easy to trace.
It becomes a problem when a prop passes through two or three components that
don't use it themselves, just to reach a fourth that does. When that
happens, match the fix to the scope of the problem rather than reaching for
the heaviest tool by default:
 
- **One or two levels, used along the way**: just pass the prop. This is
  normal React, not a smell.
- **Several levels, scoped to one subtree** (e.g. a multi-step form, a
  themed widget): React Context. No new dependency, scoped blast radius.
- **App-wide or cross-feature state with non-trivial update logic**: check
  what the project already uses first. If something is already in place
  (Redux Toolkit, Zustand, Jotai, etc.), use it — introducing a second
  state library for the same kind of problem is worse than living with the
  first one's quirks. If nothing is in place, weigh the options with the
  user in mind: Context is zero-dependency but can cause broad re-renders
  if not split carefully; Zustand is minimal boilerplate for small-to-medium
  global state; Redux Toolkit pays off on larger teams that want enforced
  patterns, devtools, and middleware. There's no universal default here —
  state it as a trade-off rather than silently picking one.
## 8. Memoize where it solves a real problem, not reflexively
 
`React.memo`, `useMemo`, and `useCallback` aren't free — they add a
dependency array to maintain and a small amount of overhead themselves.
Reach for them when there's an actual cost being avoided:
 
- An expensive computation (sorting/filtering a large array, heavy
  formatting) → `useMemo`.
- A large list where item identity matters for re-render avoidance →
  `React.memo` on the row component.
- A callback passed to a memoized child, where a new function identity on
  every render would defeat that memoization → `useCallback`.
Wrapping every component in `memo` and every function in `useCallback`
"just in case" adds noise without the payoff — it only pays off when
something downstream actually depends on referential stability or avoiding
recomputation.
 
## 9. Lazy-load what isn't needed immediately
 
Route-level pages and large, rarely-used feature modules (a settings panel,
a complex modal, an admin section) shouldn't be in the initial bundle.
 
```tsx
const UserProfilePage = lazy(() => import('@/features/user-profile'));
 
<Suspense fallback={<PageSkeleton />}>
  <UserProfilePage />
</Suspense>
```
 
In Next.js App Router, route-level code splitting is already handled by the
file system — apply this skill's lazy-loading judgment to heavy
*components within* a route instead (a chart library, a rich text editor,
anything large that isn't needed on first paint).
 
## 10. Treat file size as a signal, not a hard limit
 
There's no magic line count. The signal that a file should split is
qualitative: you have to scroll to find the part you're looking for, the
file would be hard to name in one short phrase, or it mixes more than one
of the concerns from section 4. When that happens, split along those
concern or responsibility boundaries — not arbitrarily in half.
 
## 11. Prefer modern data-fetching over hand-rolled state
 
Manually managing loading/error/data state with `useState` +
`useEffect` recreates caching, deduplication, and invalidation badly. If
the project already has TanStack Query (or SWR, or similar) installed, use
it. If data fetching is currently hand-rolled and there's enough of it to
matter, mention to the user that adopting one would remove a lot of
boilerplate — but don't add a new dependency uninvited for a single fetch.
 
## 12. Check before you build
 
Before writing a new component, hook, or utility, look for one that already
does the job: search the relevant feature folder and shared
`components/`/`hooks/`/`utils/` directories. Duplicated logic that drifts
apart over time is a common source of bugs that are confusing to track down
("why does this list sort differently here than over there?").
 
## 13. Carry performance posture through the design, not after
 
Rendering cost, bundle size, and re-render scope are easier to get right
while choosing where state lives and how components are composed than to
fix afterward. Default to: state owned as close as possible to where it's
used (not hoisted to a shared parent "just in case"), lists keyed properly,
and heavy work kept out of the render path. This is a mindset while writing
the code, not a separate optimization pass at the end.
 
## 14. Before presenting the final code, review it
 
Run through this before showing the result:
 
- [ ] No component file defines more than one reusable component.
- [ ] No file mixes rendering with fetching/business logic that should be in
      a hook or service.
- [ ] Helper functions that don't touch component state live in `utils/`.
- [ ] Reusable stateful logic is in a custom hook, not copy-pasted.
- [ ] Feature folder structure and barrel exports are in place for
      non-trivial features.
- [ ] Any prop drilling beyond a couple of levels has a deliberate
      justification or a chosen fix (Context/store), not just default props.
- [ ] Lazy-loading and memoization were considered for the genuinely heavy
      parts, not blanket-applied everywhere.
- [ ] No new dependency was introduced without checking what's already in
      the project, and without flagging it to the user.
If something on this list was skipped, it should be because the task was
genuinely trivial (see "Scale the structure to the task"), not because it
was overlooked.
 
## Reference
 
`references/feature-example.md` has a full worked example — a "user
profile" feature built from scratch with real file contents for every layer
(component, hook, service, types, barrel) — useful when generating a new
feature folder and a single template would help more than the rules above.