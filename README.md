# AI Skills Collection

A collection of reusable AI agent skills for tools such as Claude Code and Cursor.

These skills provide structured instructions, conventions, workflows, and best practices that can be installed into your AI coding environment and reused across projects.

---

## Installation

Install all skills from this repository:

```bash
npx skills add Bravo6Dev/skills
```

---

## Install a Specific Skill

Install a single skill:

```bash
npx skills add Bravo6Dev/skills --skill <skill-name>
```

Example:

```bash
npx skills add Bravo6Dev/skills --skill git-conventions
```

---

## Install for a Specific Agent

If multiple agents are supported, specify the target agent explicitly:

```bash
npx skills add Bravo6Dev/skills --skill <skill-name> --agent <agent-name>
```

Example:

```bash
npx skills add Bravo6Dev/skills --skill git-conventions --agent claude-code
```

## Install Globally

Install skills globally for all projects:

```bash
npx skills add Bravo6Dev/skills --global
```

---

## Available Skills

| Skill                                       | Point                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`git-conventions`](#git-conventions)       | Keep `main` deployable and history readable via consistent branches, commits, PRs. |
| [`react-architecture`](#react-architecture) | Define React feature structure for screens, responsive composition, contexts, and public entries. |
| [`react-architecture-audit`](#react-architecture-audit) | Read-only audit of React feature structure and public-entry boundaries. |
| [`react-structural-migration`](#react-structural-migration) | Safely move an existing React codebase to the target structure without behavior changes. |
| [`add-feature`](#add-feature)               | Scaffold a full MediatR + ErrorOr Clean Architecture feature slice in one shot.    |

---

### `git-conventions`

**Description:** Applies a team's Git branching, commit-message, and pull-request conventions whenever writing a commit message, naming/creating a branch, opening a PR, or giving git workflow advice.

**The point:** `main` should always be safe to deploy, and history should be easy for a reviewer (or future you) to read and undo. This skill encodes the branching model, commit format, and PR checklist so those rules get applied consistently instead of re-decided every time.

**Covers:**
- Branching model — feature branches off `dev`, `dev` as the tested integration branch, `main` always deployable and PR-only, rebase before merging.
- Commit format — `<type>(<scope>): <subject>` with types `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.
- Pull requests — every merge goes through a PR with a "what and why" description, rebased onto the target first.

**Example:**
```
User: "write a commit message for this auth timeout fix"
→ fix(auth): handle token refresh timeout gracefully
```

---

### `react-architecture`

**Description:** Defines React feature structure while designing, creating, or modifying React code. It makes generation-time decisions about feature folders, screens, responsive composition, contexts, and public entry points.

**The point:** Keep feature structure explicit and predictable without turning normal implementation work into a migration or generic code-quality review.

**Covers:**
- Feature roots, `screens/`, optional feature-owned `context/`, and barrel/public-entry organization.
- A thin responsive screen dispatcher (`XScreen`) between desktop and mobile sibling screens.
- The decision between whole-screen responsive splits and isolated component swaps.
- The difference between a feature public API boundary and a route-level lazy-loading boundary.
- Lint verification after changing barrels or their file extensions.

**Example:**
```
User: "add a responsive calendar screen"
→ Chooses a thin CalendarScreen dispatcher with DesktopCalendarScreen and
  MobileCalendarScreen only when the page composition genuinely differs.
```

---

### `react-architecture-audit`

**Description:** Read-only audit of an existing React codebase against the `react-architecture` structure model.

**The point:** Identify structural inconsistencies without conflating them with lint, accessibility, performance, React Doctor, or clean-code review.

**Covers:**
- Loose feature-root implementation files and screens outside `screens/`.
- Misplaced feature components, hooks, contexts/providers, types, and utilities.
- Public barrels, cross-feature deep imports, and deliberate route-level lazy-import exceptions.
- Inconsistent responsive-screen and feature-provider organization.

**Example:**
```
User: "audit our React feature folders"
→ Reports grouped, file-specific structural violations and expected paths;
  makes no repository changes.
```

---

### `react-structural-migration`

**Description:** Safely restructures an existing working React codebase while preserving behavior.

**The point:** Move files, create structure, and update imports without slipping unrelated refactors or semantic changes into a structural migration.

**Covers:**
- Migration inventory, shared/high-contention planning, and target layout.
- Parallel-agent partitioning with frozen routes, registries, shared barrels, and configuration.
- Central reconciliation after independent feature moves.
- Typecheck, full lint, relevant tests, old-path searches, export-surface checks, and final semantic-diff inspection.

**Example:**
```
User: "move all loose feature screens into screens/"
→ Inventories routes and public entries first, migrates disjoint features,
  reconciles shared routes once, and verifies old paths are gone.
```

---

### `add-feature`

**Description:** Scaffolds a complete Clean Architecture feature slice — command or query, MediatR handler, FluentValidation validator, Carter minimal-API endpoint, and tests — for a **MediatR + ErrorOr** `.NET` Clean Architecture template (not the custom `ICommand`/`IQuery`/`Result` style some starters use).

**The point:** Adding a use case touches five-plus files across three layers in a specific, repeatable pattern. This skill runs that whole workflow — classify command vs. query, scaffold the Application slice, wire the endpoint, write handler/validator/integration tests — so nothing gets skipped or placed in the wrong layer, and nothing gets "fixed" to match a different template than the one actually in use.

**Covers:**
- Command vs. query classification and naming conventions (`ArchiveTodoCommand`, `GetOverdueTodosQuery`, etc.).
- Non-negotiable conventions: one folder per use case, `public sealed` MediatR handlers (`IRequestHandler<TRequest, ErrorOr<TResponse>>`), no manual DI registration for handlers/validators (assembly-scanned), `ErrorOr<T>` instead of throwing, validation via a MediatR `ValidationBehavior` pipeline behavior, user identity resolved from claims in the endpoint rather than injected into the handler.
- Explicit route wiring into Carter modules (the one piece of an endpoint that isn't auto-discovered) and the `ApiResponse<T>`/`MatchResult` error-to-HTTP-status mapping.
- Reference templates for command slices, query slices, endpoints, and MSTest unit/validator/integration tests.
- Optional, opt-in notes on `HybridCache` for hot reads and MediatR's commercial licensing above its free tier — flagged, not applied by default.
- A verification step (`dotnet build` && `dotnet test`).

**Example:**
```
User: "add a feature to archive a todo item"
→ Creates Application/Features/Todos/Archive/ (command, handler, validator),
  WebApi/Endpoints/Todos/Archive.cs, wires the route into TodosModule.cs,
  and adds matching handler/validator/integration tests — then runs
  dotnet build && dotnet test.
```

---

## Repository Structure

```text
skills/
├── git-conventions/
│   ├── SKILL.md
│   └── references/
├── react-architecture/
│   └── SKILL.md
├── react-architecture-audit/
│   └── SKILL.md
└── react-structural-migration/
    └── SKILL.md
```

Each skill contains:

* `SKILL.md` — Main instructions and behavior.
* `references/` — Additional examples, documentation, and supporting material.

---

## Updating Skills

After updating a skill, users can reinstall it using:

```bash
npx skills add Bravo6Dev/skills --skill git-conventions --force
```

---

## Contributing

Contributions are welcome.

When adding a new skill:

1. Create a new folder under `skills/`.
2. Add a `SKILL.md` file.
3. Add a `references/` folder if supporting documentation is needed.
4. Update the Available Skills table in this README.

---

## Current Focus

This repository currently contains:

* Git workflow and commit conventions (`git-conventions`).
* React feature architecture, structural audits, and safe migrations (`react-architecture`, `react-architecture-audit`, and `react-structural-migration`).
* Clean Architecture feature scaffolding for .NET (`add-feature`).

More skills will be added over time, including code review, backend development, and other engineering workflows.
