# Dependency and skill catalog

The external skills, plugins and tools this workflow can use, where each one comes from, how to install it for each agent, and what to do without it. Every dependency here is **optional**. A missing one never stops the setup; it changes which procedure the generated files point at.

The inventory (`scripts/inventory.mjs`) is the source of truth for what is installed, for which agent, and whether a skill is user-only. This file says what to look for and how to get it. Install commands below were taken from each project's README (checked 2026-11-10) or, for the `claude` and `skills` CLIs, from their `--help` output. The agent can't know whether a README changed since then, so when recommending a command, say that the catalog was checked on that date and may be stale, and that the linked README is the authority. If a command fails or the README at hand differs, use the README's form, say so, and ask again before running it: a changed command is not the one the user approved.

Every install in this file takes the repository's current default branch (or `@latest`). None is pinned to a release or commit; say so in the recommendation.

## Rules

1. **Recommend, then ask.** On a new setup, present every relevant missing dependency before falling back. Never install without an explicit yes that covers that dependency: its own, or one "install all" given after every command it covers was listed (Hard rule 1 in `SKILL.md`). The side effects in rule 5 always need their own yes.
2. **Relevant only.** Recommend a dependency or component only when the inventory marks it `relevant` and its `supportedAgents` cover the host agent (the literal entry `any skills CLI agent` covers every agent in the table under **Agent identifiers**). Never impose an architecture: architecture skills are recommended only when the code (or the user's choice) already uses that architecture.
3. **One at a time.** Run each approved install separately, show its output, and stop that dependency on the first error. Then use its fallback and continue with the rest.
4. **Verify availability.** After installing, run the inventory again. A component counts as available only when it appears for the host agent (`installedFor` / `skills[name].agents`). If it needs a restart, say so, and mark it "installed, available after restart" until the next session.
5. **No side effects beyond the install.** Never run an installer that changes CI, project scripts or another agent's configuration unless the user asked for exactly that. When an install does more than add skills (hooks, a global tool, an MCP server, files for several agents), name each effect and get a separate yes for it.
6. **Record decisions** in the project workflow config (see [workflow-config.md](workflow-config.md)) only with approval, so later runs don't ask again.

## Presenting a recommendation

One row per dependency (components listed inside), in this order: required for the chosen workflow, then recommended, then optional.

| Field | Content |
|---|---|
| Name | Dependency and the components that apply here |
| Purpose | One line |
| Repository | The official GitHub link below |
| Why here | The inventory `reason` (stack, markers, remote) |
| Status | Installed for <agents> / missing / partly installed / unsupported for this agent / previously declined (date) |
| Install | The exact command(s) for the host agent, from this file |
| Restart | Whether the agent session must restart |
| Fallback | The procedure used if it is skipped or fails |

Then list every command that "install all" would run, and ask: install all recommended, choose some, or continue with the fallbacks for all. What rule 5 says needs its own yes is asked about separately, whatever the answer.

## Agent identifiers

The skills CLI (`npx skills add`, from `vercel-labs/skills`) installs for these `-a` values; the inventory uses the same names. Project-level skills for Codex, Cursor, OpenCode, GitHub Copilot and Gemini CLI share `.agents/skills/`; Claude Code uses `.claude/skills/`.

| Agent | `-a` value |
|---|---|
| Claude Code | `claude-code` |
| Codex | `codex` |
| Cursor | `cursor` |
| OpenCode | `opencode` |
| GitHub Copilot | `github-copilot` |
| Gemini CLI | `gemini-cli` |

The skills CLI requires **Node.js 22.20 or later** (its README). It also writes `skills-lock.json` in the project for project-scoped installs; recommend committing it, so the team shares one recorded set of skills.

**When the host's own CLI isn't on `PATH`** (for example, Claude Code running in an IDE), the `claude plugin …` shell commands can't run. Give the in-session form instead (`/plugin marketplace add …`, `/plugin install …`), which the user types (**pending user action**), or the skills CLI route where the dependency offers one. When an agent runs it, pass the agent so the CLI doesn't ask which one: `npx skills add <owner/repo> --skill <name> -a <agent>`. Add `-y` (skip the CLI's confirmation prompts) only when the user asked for an unattended install after seeing the exact command. If the CLI stops at a prompt the agent can't answer, give the user the command to run (**pending user action**) instead of retrying with `-y`, as in `SKILL.md` step 6. Add `-g` to install for every project instead of this one. Run one command per skill unless the user prefers the whole package.

## Sources

### Matt Pocock skills

- **Repository:** https://github.com/mattpocock/skills
- **Purpose:** clarify, spec, ticket, implement, TDD, triage and review procedures for engineering work.
- **Relevant:** every project.
- **Install:**

  | Agent | Commands |
  |---|---|
  | Claude Code | `claude plugin install mattpocock-skills@claude-plugins-official` |
  | Codex | `codex plugin marketplace add mattpocock/skills`, then `codex plugin add mattpocock-skills@mattpocock` |
  | GitHub Copilot CLI | `copilot plugin marketplace add mattpocock/skills`, then `copilot plugin install mattpocock-skills@mattpocock`; the README also asks for an `extraKnownMarketplaces` entry in `~/.copilot/settings.json`, which the user adds |
  | Gemini CLI | `gemini skills install https://github.com/mattpocock/skills.git --path skills/engineering` (and `--path skills/productivity`) |
  | Any skills CLI agent | `npx skills@latest add mattpocock/skills -a <agent>`; include `setup-matt-pocock-skills` when choosing skills |

- **After install:** if `docs/agents/issue-tracker.md` doesn't exist (inventory `docs.trackerConfigured: false`), tell the user to run `/setup-matt-pocock-skills` once. It is user-invoked: no agent or skill can start it. When it has already run, don't recommend it again and never overwrite its files.
- **Restart:** plugin installs load in a new session.
- **Fallback:** the written procedures in [step-procedures.md](step-procedures.md) (F1–F6, F8) and the tracker/domain files in [tracker-and-domain.md](tracker-and-domain.md).

### Guard skills

- **Repository:** https://github.com/amElnagdy/guard-skills
- **Purpose:** review gates after implementation and before landing. `clean-code-guard` (production code), `test-guard` (tests), `docs-guard` (documentation); `wp-guard` and `woo-guard` only for WordPress/WooCommerce code.
- **Relevant:** every project with code; pick the guards that match what changes.
- **Install:** `npx skills add amElnagdy/guard-skills --skill <guard> -a <agent>` per guard.
- **Fallback:** the review checklist F6 in [step-procedures.md](step-procedures.md). It covers the same areas by hand, without the guards' specific failure-mode lists, so report it as "manual review", not as the guard.

### Bravo6Dev skills

- **Repository:** https://github.com/Bravo6Dev/skills
- **Purpose and components:**
  - `git-conventions`: branch names, commit messages, PR text. It checks the repository first and follows what the repository documents. Where nothing is documented it defaults to `main` plus a `dev` integration branch (work branches come from the default branch when there is no `dev`; it doesn't create one) and to Conventional Commits subjects such as `<type>(<scope>): <subject>`. Recommend it in a new project, and in an existing one whose history already uses that commit format or documents no convention. When an existing project documents or clearly follows another commit format, the skill adds little: use F7 with what git shows, unless the user wants to adopt it.
  - `react-architecture`, `react-architecture-audit`, `react-structural-migration`: React feature structure, a read-only audit, and an approved migration. React projects.
  - `vertical-slice-architecture`: set up a new .NET vertical-slice foundation. Only a new .NET project where the user chose vertical slices.
  - `vertical-slice-feature`: add or audit a use case in a project that keeps endpoint, request, handler and validator together in one folder per use case inside the API project (`Api/Features/<Area>/<UseCase>/`, typically FastEndpoints).
  - `add-feature`: a split-layer Clean Architecture solution with separate Application and Web API projects: MediatR handlers under `Application/Features/<Feature>/<UseCase>/`, ErrorOr results, and Carter endpoint modules in the Web API project.
- **Never** recommend a vertical-slice or React-structure skill for a project whose established architecture differs. Read the code first (see the stack references).
- **Install:** `npx skills add Bravo6Dev/skills --skill <name> -a <agent>`.
- **Fallback:** F5 and F7 in [step-procedures.md](step-procedures.md), with the conventions the code shows.

### Delegate skills

- **Repository:** https://github.com/amElnagdy/delegate-skills
- **Purpose:** Brief → Implement → Review → Rework → Land with an external implementer CLI (`codex-delegate`, `claude-delegate`, `copilot-delegate`, `opencode-delegate`, … one per CLI), plus `delegate-setup` for lanes.
- **Relevant:** only when the user chooses external delegation. Recommend only the `*-delegate` skill for a CLI the inventory found on `PATH`.
- **Prerequisites (README):** Node 18+ and git; the implementer CLI installed and authenticated; a shell (Git Bash or WSL on Windows). The full loop is proven on Claude Code; other orchestrators are designed-for but unproven.
- **Install:** `npx skills add amElnagdy/delegate-skills --skill <x>-delegate -a <agent>`.
- **Fallback:** native subagents, or direct implementation ([delegation.md](delegation.md)).

### Microsoft .NET skills

- **Repository:** https://github.com/dotnet/skills (marketplace name `dotnet-agent-skills`)
- **Purpose:** a set of plugins, not one skill. Recommend only those the inventory marks relevant: `dotnet` (always, for .NET), `dotnet-test` (test projects), `dotnet-aspnetcore` (ASP.NET Core), `dotnet-data` (EF Core), `dotnet-blazor`, `dotnet-maui`, `dotnet-winforms`. Others (`dotnet-msbuild`, `dotnet-nuget`, `dotnet-upgrade`, `dotnet-diag`, `dotnet-test-migration`, `dotnet-template-engine`, `dotnet-ai`, `dotnet-advanced`, `dotnet11`) only for a matching task the user names.
- **Install:**

  | Agent | Commands | Restart |
  |---|---|---|
  | Claude Code | `claude plugin marketplace add dotnet/skills`, then `claude plugin install <plugin>@dotnet-agent-skills` per plugin (the shell form of the README's `/plugin` commands) | Yes |
  | GitHub Copilot CLI | In a Copilot session, the user runs `/plugin marketplace add dotnet/skills`, then `/plugin install <plugin>@dotnet-agent-skills` | Yes |
  | Codex (CLI 0.121.0+) | `codex plugin marketplace add dotnet/skills`, then the user installs plugins from the `dotnet-agent-skills` tab in `/plugins` | Not stated |

- **Verify:** Claude Code plugins appear in the inventory's `claudePlugins`. For Codex and Copilot the inventory can't see plugins (`notCheckedFor`); ask the user to confirm in the agent's `/plugins` or `/skills` view.
- **Fallback:** F10 in [step-procedures.md](step-procedures.md): the .NET SDK commands and the project's own conventions.

### dotnet-claude-kit

- **Repository:** https://github.com/codewithmukesh/dotnet-claude-kit
- **Purpose:** a **Claude Code** plugin with .NET skills, agents, hooks and a Roslyn MCP server. Recommend it only when the host is Claude Code and the project is .NET. It is not a dependency this workflow installs for other agents: the README lists configuration files inside the repository for Cursor, Codex CLI and OpenCode, with no install command, so mention them only if the user asks and point to the README.
- **Install (Claude Code):**
  1. Prerequisite: `dotnet tool install -g CWM.RoslynNavigator` (on macOS/Linux, set `DOTNET_ROOT` if the server reports "No .NET SDKs were found").
  2. `claude plugin marketplace add codewithmukesh/dotnet-claude-kit`
  3. `claude plugin install dotnet-claude-kit` (steps 2 and 3 are the shell form of the README's `/plugin` commands)
- **Restart:** start a new session so the plugin loads.
- **Side effects (per its README):** three hooks run automatically in Claude Code: one blocks destructive git commands (force push, `reset --hard`) before Bash calls, one formats every `.cs` file after an edit, and one runs `dotnet restore` (network) after a `.csproj` change. The prerequisite installs a global .NET tool, and the plugin starts the Roslyn MCP server. List these when recommending it, and get a separate yes for the hooks and for the global tool (rule 5). The user runs the global tool install.
- **Fallback:** F10.

### React Doctor

- **Repository:** https://github.com/millionco/react-doctor
- **Purpose:** React diagnostics. Two separate things:
  - **Scan (CLI):** `npx react-doctor@latest` from the project root. It installs nothing, but it downloads and runs the latest release, so ask before the first run.
  - **Agent integration:** `npx react-doctor@latest install` (Claude Code, Cursor, Codex, OpenCode) writes the integration for the agents. It can write files for several agents, not only the host: name the agents it will write for and ask before running it (rule 5).
  - **CI:** `npx react-doctor@latest ci install` changes CI. Never run it unless the user asks for exactly that.
- **Relevant:** React projects (Next.js, Vite, Astro, TanStack, React Native, Expo per its README).
- **Fallback:** F9: the project's lint, type-check, test and build gates, reported with "React Doctor diagnostics not run".

## Workflow steps and their skills

**Who starts it:** *user* skills have `disable-model-invocation: true`, so only a person typing `/<name>` can start them; write them as `/<name>` *(user runs)*. *Agent* skills may be loaded by the agent; write them by bare name. The inventory reads the real flag; trust it over this table.

**Names.** A skill installed directly (the skills CLI, a skills folder) is written by its bare name. A skill delivered by a plugin is written with the name the inventory lists, `<plugin>:<skill>`: with the Claude Code plugin route for Matt Pocock's skills, `mattpocock-skills:tdd`, and for a user-only skill `/mattpocock-skills:to-spec` *(user runs)*. The table below shows bare names; add the prefix whenever the inventory shows one. To check availability, look up both `skills["<name>"]` and `skills["<plugin>:<name>"]`, or read the dependency component's `installedFor`, which covers both.

**Claude Code built-ins.** `security-review` ships with Claude Code as a slash command, so the inventory never lists it. It is written `/security-review`, may be run by the user or the agent, and counts as available for Claude Code only.

| Step | Skill | Source | Who starts it | Procedure without it |
|---|---|---|---|---|
| Repository setup | `setup-matt-pocock-skills` | Matt Pocock | user | F1 |
| Clarify | `grill-with-docs` (user), `grilling` (agent), `grill-me` (user), `domain-modeling` (agent) | Matt Pocock | — | F2 |
| Specify | `to-spec` | Matt Pocock | user | F3 |
| Split into tickets | `to-tickets` | Matt Pocock | user | F4 |
| Triage | `triage` | Matt Pocock | user | none; leave the step out |
| Implement | `implement`, `implement-spec` | Matt Pocock | user | F5 |
| Test-first | `tdd` | Matt Pocock | agent | F5 |
| Stack work | `vertical-slice-feature`, `add-feature`, `react-architecture`, … | Bravo6Dev | agent | F5 + stack conventions |
| .NET reference | `dotnet-*` plugins, `dotnet-claude-kit` | Microsoft, codewithmukesh | agent | F10 |
| React diagnostics | React Doctor | millionco | agent or user | F9 |
| Review | `code-review` (Matt Pocock), `clean-code-guard`, `test-guard`, `docs-guard` (Guard), `/security-review` (Claude Code built-in) | — | agent | F6 |
| Git | `git-conventions` | Bravo6Dev | agent | F7 |
| Tracker CLI | `gh` / `glab` | GitHub / GitLab | — | F11 |
| Delegate | `<x>-delegate`, `delegate-setup` | Delegate | agent | [delegation.md](delegation.md) |
| Large uncertain work | `wayfinder` | Matt Pocock | user | F8 |

**Other installed skills.** A skill not listed here may be named when its description clearly fits a step and the inventory shows it installed for the agent. Say why in the findings.

## Choosing between skills for a step

- Clarify: prefer `grill-with-docs` when the repo has a glossary or ADRs, because it keeps them current; otherwise `grilling`.
- Implement: name `implement`. When `to-spec` and `to-tickets` are both available, name `implement-spec` beside it for work that came through them.
- Triage: add a Triage row only when `triage` is available **and** `docs/agents/triage-labels.md` exists or is being written.
- .NET, existing code: a `Features/` folder alone doesn't decide, because both layouts have one. Look at where the endpoint lives and which libraries the projects reference. `vertical-slice-feature` when one API project holds endpoint, request and handler together under `Features/<Area>/<UseCase>/` (typically FastEndpoints); `add-feature` when handlers sit in a separate Application project (`Application/Features/<Feature>/<UseCase>/`, MediatR + ErrorOr) and Carter modules in the Web API project expose them; neither for another pattern (use F5 plus the conventions the code shows).
- .NET, new project with a vertical-slice stack the user chose: `vertical-slice-architecture` for the foundation ticket, then `vertical-slice-feature`.
- Review: list every available review skill under **PR review skills**, each with the part of the change it covers.

## Where a skill may be named

- **`AGENTS.md`** is read by every agent the team uses, and not every agent has every skill. Name skills there in two ways only:
  - in a list introduced with "run, when installed:" (the **PR review skills** block), which may include Claude Code built-ins such as `/security-review`, because each agent runs only the ones it has;
  - as the skill for a step, only when `skills[name].agents` covers every agent the team uses, or the user confirms the others have it.
  Plugin skills (`<plugin>:<skill>`) go in `AGENTS.md` in one case only: there is no separate `CLAUDE.md` (Claude Code isn't among the agents in use, or `CLAUDE.md` is a link to `AGENTS.md` that the user kept as one shared file), so the step table lives in `AGENTS.md` **Skills by step**, and the user confirmed that every agent in use has the plugin (the inventory can't see Codex or Copilot plugins; it marks that with `notCheckedFor` on the .NET plugin components only).
- **`CLAUDE.md`** may name any skill available to `claude-code`, plus Claude Code built-ins.
- **The workflow doc** describes steps, not skills. If an existing workflow doc already names skills, leave that alone unless the user asks.
