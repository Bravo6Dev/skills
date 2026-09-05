---
name: react-structural-migration
description: Safely restructure an existing React codebase while preserving behavior. Use for moving or regrouping feature files, screens, contexts, and public barrels, including large convention migrations; not for defining architecture or auditing without changes.
---

# React Structural Migration

Move existing React code toward the architecture defined by `react-architecture` while preserving runtime behavior. This skill performs structural migration; it does not redefine the target architecture. For a read-only findings report, use `react-architecture-audit` first when useful.

## Non-negotiable invariant

A structural-only migration preserves behavior and public contracts unless the user explicitly requests semantic change. Do not bundle in opportunistic cleanup, logic or UI changes, API changes, dependency changes, performance work, or unrelated refactoring. If a required move exposes a semantic issue, stop and explain the needed separate change rather than silently making it.

## Plan before editing

Build a migration inventory before changing paths. Identify:

1. affected feature folders and modules;
2. the desired target structure;
3. shared or high-contention files, including route tables, app/root composition, central registries, shared barrels, build/lint/TypeScript configuration, and global import sites;
4. each feature's barrel/public entry and its exported surface; and
5. features that can be migrated independently.

Treat route-level lazy imports separately from ordinary feature imports. Preserve intentional code-splitting boundaries even when the feature's public barrel changes. A direct route-to-screen import is acceptable only as that narrowly reasoned exception.

## Sequence safely

For a small migration, move one coherent feature at a time, update its imports and public entry, then verify that unit before proceeding.

For a large migration using parallel agents, first identify and freeze shared files. Partition independent feature folders into disjoint ownership sets; every agent owns only its assigned paths and must not edit route tables, shared barrels, configuration, or other shared touch points. After those partitions finish, perform one centralized reconciliation pass for shared files. Never have multiple agents independently edit a route table or another high-contention file unless that coordination is explicitly necessary.

After each move, update imports without changing symbols or module behavior. Keep a record of old paths/names so they can be searched globally at the end. Avoid leaving compatibility copies unless the user explicitly requests them.

## Complete only after structural verification

Building is necessary but insufficient. At minimum, run the repository's:

- typecheck;
- full lint command;
- relevant tests; and
- repository-wide searches for old import paths and, where applicable, old filenames.

Also verify that no old files are orphaned, no old/new duplicates remain, route tables and central registries resolve to the intended modules, public exports remain available, and the final diff contains no accidental business-logic or behavior edits. Where practical, compare the public/exported symbol surface before and after the migration.

Report any verification that could not run, why, and the remaining risk. Keep structural verification distinct from a general clean-code review.
