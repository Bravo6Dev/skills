---
name: react-structural-migration
description: Restructures an existing React codebase toward the react-architecture model while preserving behavior. Use when moving or regrouping several feature files, screens, contexts, or public barrels, including large convention migrations and fixes that follow a react-architecture-audit report; not for defining the architecture, auditing without changes, or placing a single file during a feature change (react-architecture).
---

# React Structural Migration

Move existing React code toward the architecture defined by `react-architecture` while preserving runtime behavior. This skill performs structural migration; it does not redefine the target architecture. For a read-only findings report, use `react-architecture-audit` first when useful.

Both sibling skills are optional. If `react-architecture` is not installed, take the target structure from the audit report or from the user and confirm it with the user before planning; do not invent a target. If `react-architecture-audit` is not installed, build the inventory below directly.

## Non-negotiable invariant

A structural-only migration preserves behavior and public contracts unless the user explicitly requests semantic change. Do not bundle in opportunistic cleanup, logic or UI changes, API changes, dependency changes, performance work, or unrelated refactoring. If a required move exposes a semantic issue, stop and explain the needed separate change rather than silently making it. The reason is reviewability: a diff that only moves files and rewrites paths can be checked mechanically, and one that also changes behavior cannot.

Public contracts include import paths used by code outside this repository. Before removing an old path, ask the user whether anything outside the repository imports it (consumers of a published package, another repository, a host application). If so, keep a re-export at the old path and list it in the report.

Adding or changing a barrel is not automatically behavior-neutral. It can change module evaluation order, pull in side-effect imports, and change which chunk a module lands in. Keep each barrel's export list as it was unless the approved plan says otherwise.

## Preflight

Before any file is moved:

1. Confirm the directory is a git repository. If it is not, say that there is no rollback path and ask before continuing; steps 2 and 3 and the git instructions below then do not apply.
2. Confirm the working tree is clean: `git status --porcelain` prints nothing. If it prints anything, stop and ask the user to commit or stash; do not stash or discard for them.
3. Work on a dedicated branch created for the migration, not on the default branch. Ask before creating it if the user has not said where the work should go.
4. Record a baseline: run the repository's typecheck, lint, tests, and build, and keep the results. A failure that already exists is reported as pre-existing; it is not fixed here and not attributed to the migration. If the baseline cannot run, say so and ask whether to proceed.

## Plan before editing

Build a migration inventory before changing paths. Identify:

1. affected feature folders and modules;
2. the desired target structure;
3. shared or high-contention files, including route tables, app/root composition, central registries, shared barrels, build/lint/TypeScript configuration, and global import sites;
4. each feature's barrel/public entry and its exported surface;
5. features that can be migrated independently; and
6. path-sensitive references that are not imports (the checklist under "Sequence safely").

Present the plan before moving anything: the moves per feature (old path to new path), the shared files that will be touched, the order, and what will be verified. Wait for the user's approval. This list is the dry run; nothing is moved to produce it.

As a default, treat a migration as small when it stays inside one feature or moves about twenty files or fewer, and as large otherwise, or whenever a route table, shared barrel, or configuration file has to change.

Treat route-level lazy imports separately from ordinary feature imports. Preserve intentional code-splitting boundaries even when the feature's public barrel changes. A direct route-to-screen import is acceptable only as that narrowly reasoned exception.

## Sequence safely

For a small migration, move one coherent feature at a time, update its imports and public entry, then verify that unit (typecheck, lint, and the tests that cover it) before proceeding. Commit each migrated feature separately so one feature can be reverted without the others; if the user does not want commits made for them, stop after each feature so they can commit.

Move files with `git mv`, which stages the move in one step. Git does not record renames; it detects them afterwards by content similarity, and `git log --follow` and blame follow a file only while that detection succeeds. So do not combine a move with content changes beyond the import paths the move itself forces; larger edits to the same file go in a separate commit. Where the project does not require every commit to build, prefer a move-only commit followed by an import-update commit. A rename that changes only letter case is not picked up reliably on case-insensitive filesystems (the macOS and Windows defaults): rename through a temporary name with two `git mv` calls and confirm `git status` shows a rename.

To undo a feature, revert its commits; to abandon the migration, drop the branch. Do not use `git reset --hard`, `git checkout -- .`, or `git clean` to recover unless the user asks for it.

For a large migration using parallel agents, first identify and freeze shared files. Give every agent its own git worktree and branch; agents must not share one working tree. If separate worktrees are not available, migrate the partitions sequentially instead. Partition independent feature folders into disjoint ownership sets; every agent owns only its assigned paths and must not edit route tables, shared barrels, configuration, or other shared touch points. After those partitions finish, merge them and perform one centralized reconciliation pass for shared files. Never have multiple agents independently edit a route table or another high-contention file unless that coordination is explicitly necessary.

A partition cannot pass the full verification while shared files are frozen, so there are two levels of check. The per-partition check: every moved file exists only at its new path, imports inside the owned paths resolve, and typecheck and lint report no new errors inside the owned paths. Errors in frozen shared files that still point at old paths are expected; list them for reconciliation. The final check runs once on the merged result after reconciliation and is the full verification below.

After each move, update imports without changing symbols or module behavior. Keep a record of old paths/names so they can be searched globally at the end. Avoid leaving compatibility copies unless the user explicitly requests them or an external consumer needs the old path (see the invariant above).

Imports are not the only place a path appears. After each move, also search for the old path in:

- test mocks (`jest.mock`, `vi.mock`, `require` strings) and snapshot files;
- Storybook `stories` globs;
- `tsconfig.json` `paths` and `include`, bundler aliases, and ESLint overrides or boundary rules keyed by path;
- Tailwind `content` globs and other tooling globs;
- `CODEOWNERS`, CI path filters, and coverage or test include/exclude patterns; and
- dynamic `import()` strings, lazy route definitions, and relative asset or CSS URLs.

Stop and report instead of continuing when a check that passed in the baseline now fails for a reason other than a stale path, when a move would require changing a symbol name, export shape, or runtime behavior, when a file to be moved has unexpected changes, when two partitions need the same file, or when the repository no longer matches the approved plan.

## Complete only after structural verification

Building is necessary but insufficient. At minimum, run the repository's:

- production build;
- typecheck;
- full lint command;
- full test suite, because a move can break a test anywhere that mocks or imports the old path (if the full suite cannot run, say which part did); and
- repository-wide searches for old import paths and, where applicable, old filenames.

Also exercise every route whose screen or lazy import moved: run the existing end-to-end or smoke tests, or start the app and load those routes. A broken lazy chunk fails only at runtime. If the app cannot be started here, report this check as not run.

Compare each result with the baseline recorded in preflight. Only differences from the baseline are attributed to the migration.

Also verify that no old files are orphaned, no old/new duplicates remain, route tables and central registries resolve to the intended modules, public exports remain available, and the final diff contains no accidental business-logic or behavior edits. Compare the public/exported symbol surface before and after the migration: list each public barrel's exported names before the first move and again at the end (from the barrel's `export` statements, or by diffing declaration output from `tsc --declaration --emitDeclarationOnly` written to a scratch directory outside the repository), and report any name added, removed, or renamed.

Report any verification that could not run, why, and the remaining risk. Keep structural verification distinct from a general clean-code review.
