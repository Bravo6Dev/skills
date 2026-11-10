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
| [`add-feature`](#add-feature)               | Scaffold a feature in the older Carter/MediatR template. |
| [`vertical-slice-architecture`](#vertical-slice-architecture) | Set up a complete .NET vertical-slice architecture and reference template. |
| [`vertical-slice-feature`](#vertical-slice-feature) | Add or audit a use case in an existing co-located vertical-slice project. |
| [`setup-agent-workflow`](#setup-agent-workflow) | Generate `AGENTS.md`, `CLAUDE.md` and a workflow doc from the tools you actually have; recommend and install missing ones with approval. |

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

### `vertical-slice-architecture`

**Description:** Establishes a .NET vertical-slice API architecture, infrastructure, persistence, tests, and setup in a new or existing solution.

**The point:** Provide a working template with one reference operation that proves route discovery, binding, dispatch, validation, result mapping, database access, and tests. The default pattern uses co-located FastEndpoints, MediatR, ErrorOr, EF Core, and Domain/Application/Infrastructure boundaries; user choices and existing project constraints take precedence.

**Covers:** project graph and dependency injection, configuration and secrets, persistence and migrations, auth and API documentation, a working reference slice, test hosts, CI, and an acceptance guard.

**Install:** `npx skills add Bravo6Dev/skills --skill vertical-slice-architecture`

**Example:**
```
User: "set up a vertical-slice .NET API with PostgreSQL"
→ Creates the layered solution, infrastructure and API setup, one executable
  reference slice, database migration, tests, and build/test instructions.
```

---

### `vertical-slice-feature`

**Description:** Adds a complete HTTP use case to an existing co-located vertical-slice .NET project, or audits an existing feature against its local architecture.

**The point:** Follow the project's established pattern rather than assuming a fixed repository name, paths, database, or test framework. Complete the applicable flow from HTTP contract through domain behavior, persistence and external effects to tested responses. The audit guard is read-only unless fixes are requested.

Use `add-feature` for the older template where HTTP endpoints and Application command/query slices are separate.

**Covers:** request/endpoint/handler and applicable validator, response and binder; authorization and ownership; errors and localization; schema and integrations when needed; behavior, database, and HTTP tests; a file-specific audit with pass/fail/unverified status.

**Install:** `npx skills add Bravo6Dev/skills --skill vertical-slice-feature`

**Examples:**
```
User: "add an archive-todo use case to this vertical-slice API"
→ Inspects a neighboring feature, implements the complete use case in the
  project's structure, updates affected contracts and tests, then verifies it.

User: "audit the wallet transactions feature"
→ Traces the route through binding, policy, handler, persistence and responses;
  reports evidence and verification status without changing files.
```

---

### `setup-agent-workflow`

**Description:** Generates, refreshes or audits a repository's `AGENTS.md`, `CLAUDE.md` and agent workflow doc, so every coding agent follows one workflow (clarify, spec, tickets, implement, verify, review, land). It detects the stack, the host agent, and the installed skills, plugins and CLIs. It recommends the relevant missing ones with official links, installs only what you approve, and falls back to written procedures for the rest. Works for new and existing projects.

**The point:** Agent instructions written by hand drift. They name skills that aren't installed, commands that were never run, and tools one agent has but another doesn't. This skill builds the instructions from what is actually available, for each agent, and records what you chose not to install, so it doesn't ask again.

**Covers:**
- A read-only, offline inventory (`scripts/inventory.mjs`), covered by automated tests:
  - git, stack and architecture markers, CI, existing instruction files (including committed ones deleted from the working tree);
  - skills per agent, user-only skills and Claude Code plugins;
  - CLI versions;
  - delegation readiness;
  - the status of every catalog dependency.
- New projects: a short interview and, with approval, skeletons for the business reference, architecture doc and first ADR.
- Existing projects: conventions, gates, branch model and commit style taken from the code and git history. Instruction files are updated in place, never overwritten.
- Refresh (in-place updates for drift only) and audit (a read-only report).
- Stack references for .NET and React, plus a generic one for other stacks.

#### Recommended toolchain

Everything here is optional. The skill recommends only what matches the detected stack, architecture and host agent.

| Dependency | For | Agents |
|---|---|---|
| [mattpocock/skills](https://github.com/mattpocock/skills) | Clarify, spec, tickets, implement, TDD; then run `/setup-matt-pocock-skills` once per repo | Claude Code, Codex, Copilot CLI, Gemini CLI, any skills CLI agent |
| [amElnagdy/guard-skills](https://github.com/amElnagdy/guard-skills) | Code, test and docs review guards | Any skills CLI agent |
| [Bravo6Dev/skills](https://github.com/Bravo6Dev/skills) | Git conventions; React and vertical-slice skills only when the project uses that architecture | Any skills CLI agent |
| [amElnagdy/delegate-skills](https://github.com/amElnagdy/delegate-skills) | Brief → Implement → Review → Rework → Land with an external implementer, only if you choose it | Any skills CLI agent; proven on Claude Code |
| [dotnet/skills](https://github.com/dotnet/skills) | Microsoft's .NET plugins, only the relevant ones (tests, ASP.NET Core, EF Core, …) | Claude Code, Copilot CLI, Codex 0.121.0+ |
| [codewithmukesh/dotnet-claude-kit](https://github.com/codewithmukesh/dotnet-claude-kit) | .NET skills, agents and a Roslyn MCP server | Claude Code only |
| [millionco/react-doctor](https://github.com/millionco/react-doctor) | React diagnostics (`npx react-doctor@latest`) and an optional agent integration | Claude Code, Cursor, Codex, OpenCode |

#### How installation works

1. The inventory reports what is installed, and for which agent.
2. For each relevant missing dependency, the skill shows its purpose, official repository, why it applies, its status, the exact install command for your agent, whether a restart is needed, and its fallback.
3. You choose: install all, install some, or continue with the fallbacks.
4. Approved items are installed one at a time. A failure stops only that item, which switches to its fallback.
5. The inventory runs again. An item counts as installed only when your agent can see it. Plugins that need a restart are reported as such.
6. With your approval, the decisions are saved to `docs/agents/workflow-config.json`, so a later refresh doesn't ask again about what you declined. It stores no paths, versions or credentials.

#### Fallbacks

Missing, declined, failed or unsupported dependencies are replaced by written step procedures that the agent follows with the tools it already has:

- planning, spec, ticket and implementation steps;
- a manual review checklist;
- the project's own lint, type, test and build gates instead of React Doctor;
- the .NET SDK commands instead of the .NET plugins;
- manual GitHub steps without `gh`;
- native subagents or direct work instead of external delegation.

Fallbacks are never described as equivalent to the tool they replace, and a check that didn't run is reported as **not run**.

#### Agents, stacks and CLIs

- **Agents:** `AGENTS.md` is for every agent; `CLAUDE.md` is written only when the team uses Claude Code. The skill works best when run from Claude Code. Other agents that load skills (Codex, Copilot CLI, Gemini CLI, Cursor, OpenCode) follow the same steps; only the install commands differ.
- **Stacks:** .NET and React have dedicated references. Other stacks (Flutter, Python, Go, Rust, JVM, Node) use the generic reference, which finds commands in the README, CI and task runners.
- **CLIs:**
  - Required: `git`; `dotnet` for .NET; `node`/`npm` when the gates use package scripts.
  - Recommended: Node.js 22.20+ (for `npx skills`); `gh` or `glab` for GitHub or GitLab.
  - Optional: coding-agent CLIs (`claude`, `codex`, `copilot`, `gemini`, `opencode`). They are used only when you ask for external delegation, and never installed by default.

#### Security and approval guarantees

- The inventory never writes, installs, signs in, uses the network or runs project scripts. Its only processes are read-only git queries and `--version` probes of tools on `PATH` outside the repository.
- Nothing is installed, committed, pushed, or created on your tracker without an explicit yes for that action.
- Being installed is not the same as being usable. Tools that need an account are reported as "auth not checked" until a real command succeeds.
- Another agent's CLI is never used just because it is installed. Implementers and subagents never delegate further.
- Generated files contain no machine paths, usernames, tokens or secrets.

**Install:** `npx skills add Bravo6Dev/skills --skill setup-agent-workflow`. The skills CLI needs Node.js 22.20+; the inventory script itself runs on Node 18+.

**Tests:** `node --test skills/setup-agent-workflow/scripts/inventory.test.mjs`

**Examples:**
```
User: "/setup-agent-workflow"   (in an existing .NET repo, from Claude Code)
→ Inventories the repo, recommends dotnet-test, dotnet-aspnetcore and dotnet-data
  (because the project uses them) and the guard skills, asks which to install,
  installs only those, then drafts AGENTS.md, CLAUDE.md and the workflow doc.

User: "/setup-agent-workflow refresh"
→ Reports drift (a skill that was uninstalled, a changed test command) and proposes
  in-place fixes only. Dependencies declined earlier are not offered again.

User: "/setup-agent-workflow audit"
→ The same report, with nothing written or installed.
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
├── react-structural-migration/
│   └── SKILL.md
├── add-feature/
│   ├── SKILL.md
│   └── references/
├── vertical-slice-architecture/
│   ├── SKILL.md
│   └── references/
├── vertical-slice-feature/
│   ├── SKILL.md
│   └── references/
└── setup-agent-workflow/
    ├── SKILL.md
    ├── scripts/
    ├── references/
    └── evals/
```

Each skill contains:

* `SKILL.md` — Main instructions and behavior.
* `references/` — Additional examples, documentation, and supporting material.
* `scripts/` (optional) — Deterministic helpers the skill runs.
* `evals/` (optional) — Test scenarios for the skill.

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
* .NET vertical-slice architecture setup and feature work (`vertical-slice-architecture` and `vertical-slice-feature`).
* Agent instruction and workflow setup for new and existing repositories (`setup-agent-workflow`).

More skills will be added over time, including code review, backend development, and other engineering workflows.
