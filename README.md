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
| [`react-architecture`](#react-architecture) | Stop React code from collapsing into monolithic files as features grow.            |
| [`add-feature`](#add-feature)               | Scaffold a full Clean Architecture feature slice in one shot, end to end.          |

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

**Description:** Applies whenever writing, generating, scaffolding, or refactoring React/Next.js code (components, pages, hooks, features, or full apps) in TypeScript or JavaScript.

**The point:** Enforce production-grade architecture instead of letting files collapse into 500-line components that mix fetching, state, formatting, and JSX together — while scaling the amount of structure to the size of the task (a one-line fix doesn't need a folder restructure).

**Covers:**
- One component per file; feature-based folder structure (`features/user-profile/{components,hooks,services,types,utils}`) over a root-level technical split.
- Barrel exports (`index.ts`) as the public API boundary between features.
- Business logic pulled into hooks, API calls isolated in `services/`, pure helpers in `utils/`.
- Judgment calls on prop drilling (Context vs. Zustand vs. Redux Toolkit), memoization, and lazy-loading — applied only where they solve a real problem.
- A pre-submit checklist to self-review generated code before presenting it.

**Example:**
```
User: "build a user profile page with stats and recent activity"
→ Splits into ProfileHeader / ProfileStats / ProfileActivity components,
  a useUserProfile hook for data fetching, a feature folder with a
  barrel export, instead of one large ProfilePage.tsx file.
```

---

### `add-feature`

**Description:** Scaffolds a complete Clean Architecture feature slice — command or query, handler, FluentValidation validator, minimal API endpoint, and tests — for this repo's `.NET` Clean Architecture template (no MediatR; custom `ICommand`/`IQuery` abstractions).

**The point:** Adding a use case touches five-plus files across three layers in a specific, repeatable pattern. This skill runs that whole workflow — classify command vs. query, scaffold the Application slice, wire the endpoint, write handler/validator/integration tests — so nothing gets skipped or placed in the wrong layer.

**Covers:**
- Command vs. query classification and naming conventions (`ArchiveTodoCommand`, `GetOverdueTodosQuery`, etc.).
- Non-negotiable conventions: one folder per use case, `internal sealed` handlers, no manual DI registration, `Result`/`Result<T>` instead of throwing, validation via `FluentValidation` decorators, authorization checks against `IUserContext`.
- Reference templates for command slices, query slices, endpoints, and tests.
- A verification step (`dotnet build` && `dotnet test`, including `ArchitectureTests`).

**Example:**
```
User: "add a feature to archive a todo item"
→ Creates src/Application/Todos/Archive/ (command, handler, validator),
  src/Web.Api/Endpoints/Todos/Archive.cs, and matching handler/validator/
  integration tests — then runs dotnet build && dotnet test.
```

---

## Repository Structure

```text
skills/
├── git-conventions/
│   ├── SKILL.md
│   └── references/
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
* React/Next.js project architecture conventions (`react-architecture`).
* Clean Architecture feature scaffolding for .NET (`add-feature`).

More skills will be added over time, including code review, backend development, and other engineering workflows.
