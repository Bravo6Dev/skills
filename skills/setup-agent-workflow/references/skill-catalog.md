# Dependency and skill catalog

The external skills, plugins and tools this workflow can use, where each one comes from, how to install it for each agent, and what to do without it. Every dependency here is **optional**. A missing one never stops the setup; it changes which procedure the generated files point at.

The inventory (`scripts/inventory.mjs`) is the source of truth for what is installed, for which agent, and whether a skill is user-only. This file says what to look for and how to get it. Install commands below were taken from each project's README (checked 2026-11-10) or, for the `claude` and `skills` CLIs, from their `--help` output. Before running one, check the linked README if it may have changed.

## Rules

1. **Recommend, then ask.** On a new setup, present every relevant missing dependency before falling back. Never install without an explicit yes for that dependency.
2. **Relevant only.** Recommend a dependency or component only when the inventory marks it `relevant` and the host agent is in its supported agents. Never impose an architecture: architecture skills are recommended only when the code (or the user's choice) already uses that architecture.
3. **One at a time.** Run each approved install separately, show its output, and stop that dependency on the first error. Then use its fallback and continue with the rest.
4. **Verify availability.** After installing, run the inventory again. A component counts as available only when it appears for the host agent (`installedFor` / `skills[name].agents`). If it needs a restart, say so, and mark it "installed, available after restart" until the next session.
5. **No side effects beyond the install.** Never run an installer that changes CI, project scripts or another agent's configuration unless the user asked for exactly that.
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

Then ask: install all recommended, choose some, or continue with the fallbacks for all.

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

The skills CLI requires **Node.js 22.20 or later** (its README). It also writes `skills-lock.json` in the project for project-scoped installs.

**When the host's own CLI isn't on `PATH`** (for example, Claude Code running in an IDE), the `claude plugin …` shell commands can't run. Give the in-session form instead (`/plugin marketplace add …`, `/plugin install …`), which the user types (**pending user action**), or the skills CLI route where the dependency offers one. When an agent runs it, pass the agent and `-y` so it doesn't stop at a prompt: `npx skills add <owner/repo> --skill <name> -a <agent> -y`. Add `-g` to install for every project instead of this one. Run one command per skill unless the user prefers the whole package.

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
- **Fallback:** the written procedures in [step-procedures.md](step-procedures.md) (F1–F5, F8) and the tracker/domain files in [tracker-and-domain.md](tracker-and-domain.md).

### Guard skills

- **Repository:** https://github.com/amElnagdy/guard-skills
- **Purpose:** review gates after implementation and before landing. `clean-code-guard` (production code), `test-guard` (tests), `docs-guard` (documentation); `wp-guard` and `woo-guard` only for WordPress/WooCommerce code.
- **Relevant:** every project with code; pick the guards that match what changes.
- **Install:** `npx skills add amElnagdy/guard-skills --skill <guard> -a <agent> -y` per guard.
- **Fallback:** the review checklist F6 in [step-procedures.md](step-procedures.md). It covers the same areas by hand, without the guards' specific failure-mode lists, so report it as "manual review", not as the guard.

### Bravo6Dev skills

- **Repository:** https://github.com/Bravo6Dev/skills
- **Purpose and components:**
  - `git-conventions`: branch names, commit messages, PR text. Every project.
  - `react-architecture`, `react-architecture-audit`, `react-structural-migration`: React feature structure, a read-only audit, and an approved migration. React projects.
  - `vertical-slice-architecture`: set up a new .NET vertical-slice foundation. Only a new .NET project where the user chose vertical slices.
  - `vertical-slice-feature`: add or audit a use case in a project that already uses co-located slice folders.
  - `add-feature`: a MediatR + ErrorOr + Carter Clean Architecture project.
- **Never** recommend a vertical-slice or React-structure skill for a project whose established architecture differs. Read the code first (see the stack references).
- **Install:** `npx skills add Bravo6Dev/skills --skill <name> -a <agent> -y`.
- **Fallback:** F5 and F7 in [step-procedures.md](step-procedures.md), with the conventions the code shows.

### Delegate skills

- **Repository:** https://github.com/amElnagdy/delegate-skills
- **Purpose:** Brief → Implement → Review → Rework → Land with an external implementer CLI (`codex-delegate`, `claude-delegate`, `copilot-delegate`, `opencode-delegate`, … one per CLI), plus `delegate-setup` for lanes.
- **Relevant:** only when the user chooses external delegation. Recommend only the `*-delegate` skill for a CLI the inventory found on `PATH`.
- **Prerequisites (README):** Node 18+ and git; the implementer CLI installed and authenticated; a shell (Git Bash or WSL on Windows). The full loop is proven on Claude Code; other orchestrators are designed-for but unproven.
- **Install:** `npx skills add amElnagdy/delegate-skills --skill <x>-delegate -a <agent> -y`.
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
- **Purpose:** a **Claude Code** plugin with .NET skills, agents, hooks and a Roslyn MCP server. Recommend it only when the host is Claude Code and the project is .NET. It is not a dependency for other agents (the repo documents a separate APM route for Copilot; offer it only if the user asks).
- **Install (Claude Code):**
  1. Prerequisite: `dotnet tool install -g CWM.RoslynNavigator` (on macOS/Linux, set `DOTNET_ROOT` if the server reports "No .NET SDKs were found").
  2. `claude plugin marketplace add codewithmukesh/dotnet-claude-kit`
  3. `claude plugin install dotnet-claude-kit`
- **Restart:** start a new session so the plugin loads.
- **Note:** the plugin adds hooks that run on tool calls. Mention this when recommending it.
- **Fallback:** F10.

### React Doctor

- **Repository:** https://github.com/millionco/react-doctor
- **Purpose:** React diagnostics. Two separate things:
  - **Scan (CLI):** `npx react-doctor@latest` from the project root. It installs nothing, but it downloads and runs the latest release, so ask before the first run.
  - **Agent integration:** `npx react-doctor@latest install` (Claude Code, Cursor, Codex, OpenCode) writes the integration for the agents.
  - **CI:** `npx react-doctor@latest ci install` changes CI. Never run it unless the user asks for exactly that.
- **Relevant:** React projects (Next.js, Vite, Astro, TanStack, React Native, Expo per its README).
- **Fallback:** F9: the project's lint, type-check, test and build gates, reported with "React Doctor diagnostics not run".

## Workflow steps and their skills

**Who starts it:** *user* skills have `disable-model-invocation: true`, so only a person typing `/<name>` can start them; write them as `/<name>` *(user runs)*. *Agent* skills may be loaded by the agent; write them by bare name. The inventory reads the real flag; trust it over this table.

**Claude Code built-ins.** `security-review` ships with Claude Code as a slash command, so the inventory never lists it. It is written `/security-review`, may be run by the user or the agent, and counts as available for Claude Code only.

| Step | Skill | Source | Who starts it | Procedure without it |
|---|---|---|---|---|
| Repository setup | `setup-matt-pocock-skills` | Matt Pocock | user | F1 |
| Clarify | `grill-with-docs` (user), `grilling` (agent), `grill-me` (user), `domain-modeling` (agent) | Matt Pocock | — | F2 |
| Specify | `to-spec` | Matt Pocock | user | F3 |
| Split work | `to-tickets` | Matt Pocock | user | F4 |
| Triage | `triage` | Matt Pocock | user | F4 |
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
- .NET, existing code: `vertical-slice-feature` for co-located slice folders (`Features/<Area>/<UseCase>/`); `add-feature` for a split Application + Carter Web API; neither for another pattern (use F5 plus the conventions the code shows).
- .NET, new project with a vertical-slice stack the user chose: `vertical-slice-architecture` for the foundation ticket, then `vertical-slice-feature`.
- Review: list every available review skill under **PR review skills**, each with the part of the change it covers.

## Where a skill may be named

- **`AGENTS.md`** is read by every agent the team uses, and not every agent has every skill. Name skills there in two ways only:
  - in a list introduced with "run, when installed:" (the **PR review skills** block), which may include Claude Code built-ins such as `/security-review`, because each agent runs only the ones it has;
  - as the skill for a step, only when `skills[name].agents` covers every agent the team uses, or the user confirms the others have it.
  Plugin skills (`<plugin>:<skill>`) never go in `AGENTS.md`.
- **`CLAUDE.md`** may name any skill available to `claude-code`, plus Claude Code built-ins.
- **The workflow doc** describes steps, not skills. If an existing workflow doc already names skills, leave that alone unless the user asks.
