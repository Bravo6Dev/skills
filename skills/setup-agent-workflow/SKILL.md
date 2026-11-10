---
name: setup-agent-workflow
description: Generate, refresh or audit a repository's AGENTS.md, CLAUDE.md and agent workflow doc so coding agents follow one engineering workflow (clarify, spec, tickets, implement, verify, review, land). Detects the stack, the host agent, installed skills, plugins and CLIs; recommends relevant missing dependencies with official links and verified install commands; installs only what the user approves; and falls back to written procedures for the rest. Works for new and existing projects. Use when the user asks to set up, bootstrap, refresh or audit agent instructions, AGENTS.md, CLAUDE.md, an AI or agent workflow, or the skills, plugins and delegation for a repo. Not for adding a feature, configuring delegation lanes (delegate-setup) or setting up only the issue tracker (setup-matt-pocock-skills).
argument-hint: "[optional: new | existing | refresh | audit, or what to change]"
---

# Set up the agent workflow

Give a repository a layered set of agent instructions that match the tools actually available:

| File | Read by | Holds |
|---|---|---|
| `AGENTS.md` | every coding agent | What the repo is, what to read first, ground rules, judgment-only conventions, review and tracker pointers |
| `CLAUDE.md` | Claude Code (`@AGENTS.md` import + extras) | Which skill runs each step, and implementation delegation |
| **the workflow doc**: `docs/agents/workflow.md`, or an equivalent the repo already has | every agent, on demand | The full workflow: phases, gates, issues/branches/PRs, review procedure, definition of done, safety, step procedures |

Optional, with approval:

- `docs/agents/workflow-config.json`: the team's dependency and delegation decisions.
- `docs/agents/issue-tracker.md` and `domain.md`, when Matt Pocock's setup skill isn't used.
- Skeletons for a business reference, architecture doc and first ADR, when the repo has none.

**Modes:** `new` and `existing` (setup), `refresh` (update in place), `audit` (read-only report, writes nothing).

`<skill-dir>` below is the folder containing this `SKILL.md`.

## Hard rules

1. **Read-only until approved.** Write nothing before an explicit "yes" to the drafts. Never commit, push, open PRs, create issues or labels, or add remotes. Installing a dependency, running a gate, running a networked tool (`npx <package>`) and signing in each need their own approval.
2. **Never install silently.** Recommend, explain and link first; install only what the user selected, one at a time. A missing optional dependency never stops the setup. Use its fallback and continue.
3. **Name only what is available.** A skill is named for an agent only if the inventory shows it available to that agent (`skills[name].agents`), or it is a Claude Code built-in listed in the catalog (Claude Code only). A path is named only if it exists or is created in this run. A command is named only if it comes from the README, CI or a task runner, or is proposed and marked **not run**. Never report an unexecuted check as passed.
4. **Respect who can start a skill.** Skills the inventory marks `userOnly` are written as `/name` *(user runs)*. Agents suggest them; they never invoke them. Agent-invocable skills are written by bare name. Claude Code built-in commands keep their slash form (`/security-review`). This skill itself counts as available, since it is running.
5. **Derive, don't impose.** Conventions, architecture, commands, branch model and commit style come from the code, docs and git history in an existing project, and from the user in a new one. Never recommend a skill that would change an established architecture. Never copy another project's business rules.
6. **Preserve user work.** Never overwrite an instruction file, including one that git tracks but that is deleted or modified in the working tree (inventory `tracked: true` with `gitStatus` other than `clean`).
   - When the file is missing, restore the committed version (`git show HEAD:<file>`) and treat the run as a refresh of it.
   - When it is modified, build on the working-tree version, because it holds the user's latest edits.
   - "Build on" means keep that content and apply only the changes this flow calls for, never a regeneration from the template.
   - Update sections in place by heading, keep every other section, and show a diff. Moving or removing content needs approval.
7. **One home per fact.** `AGENTS.md` and `CLAUDE.md` route; details live in one doc, and others link to it. **Gate commands** live in exactly one place: the README when it records them, otherwise the workflow doc. Two derived forms may sit next to the rule they serve: the auto-fix command beside a conventions rule, and the quiet variants in `CLAUDE.md`'s delegation section.
8. **Portable output.** No absolute paths from this machine, no usernames, tokens or credentials, and no installed versions in generated files or the workflow config.

## Process

### 1. Inventory

```bash
node "<skill-dir>/scripts/inventory.mjs" --cwd "<repo root>"
```

It is read-only and offline. It prints JSON:

- `git`: remotes, branches, recent commit subjects, dirty tree
- `project` mode, `stacks`, `dotnetProject` markers (ASP.NET Core, EF Core, tests, Blazor, MAUI, WinForms), `package.json` scripts, CI files
- existing agent files with headings and git status; docs, ADRs, `trackerConfigured`
- `workflowConfig`: earlier decisions
- `skills`, with `userOnly` and the `agents` that can see each one; `claudePlugins`
- `tools`: role, status, version and auth state per CLI (see [references/cli-tools.md](references/cli-tools.md))
- `delegation`: delegate skills, and whether their CLIs are on `PATH`
- `dependencies`: each catalog dependency with `relevant`, `reason`, `supportedAgents`, per-component `installedFor`, and `previousDecision`
- `hostHints`: a guess at the host agent

If Node isn't available, collect the same facts by listing those paths and running nothing else. Say the inventory ran manually and that the skills CLI can't be used until Node 22.20+ is installed.

If `git.dirty` is true for anything other than a deleted instruction file, tell the user, and recommend committing or stashing first so the generated changes can be reviewed on their own. If they go ahead and a file to edit has uncommitted changes, build on the working-tree version and keep those changes intact in the diff.

### 2. Read

Read every existing agent file (`AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.cursor/rules`, …), the README, everything under `docs/`, the ADR index, CI workflows and formatter/linter configs. In an existing project, also read two or three comparable features end to end (see the stack reference). Search the docs for links into `AGENTS.md`, `CLAUDE.md` and the workflow doc ("see `AGENTS.md`", "§4"); those links must still hold after the change.

### 3. Classify

- **Host agent:** state which agent you are (Claude Code, Codex, Copilot CLI, Gemini CLI, Cursor, OpenCode…) and whether you can spawn subagents with a tool you have right now. `hostHints` only confirms. The host decides which install commands apply and which capabilities the generated files may claim.
- **Mode:** `new` or `existing` from the inventory. If `ambiguous` (a little code, three commits or fewer), ask, recommending `existing` because code already exists. A **refresh** is an existing project whose `AGENTS.md`/`CLAUDE.md` already follow this layout. An **audit** is a refresh that writes nothing.
- **Architecture:** from the code and ADRs (existing project) or the user (new). This decides which architecture skills are relevant.
- **Workflow doc:** an existing doc counts as the workflow doc when it covers the phases (specify, implement, verify) **and** the issue/branch/PR or review procedure, as an engineering overview usually does. Then `AGENTS.md` and `CLAUDE.md` link to it, `docs/agents/workflow.md` is not written, and gaps are proposed as additions to that doc. A CONTRIBUTING guide that covers only setup doesn't count.
- **Stacks:** load `references/stacks/<id>.md` for each detected stack (`dotnet`, `react`), or in a new project for each stack the user names. Use `references/stacks/generic.md` for any other stack and for the parts those references don't cover.
- **Agents in use:** which agents read this repo (Claude Code, Codex, Copilot, Cursor…). This decides what `AGENTS.md` may name. `AGENTS.md` is shared by the team, so a skill installed only in this user's home folder may not exist for teammates. Name it there only in a "run, when installed" list, or recommend a project-scoped install (no `-g`) when the team should share it.
- **Domain sources:** a glossary, decision register, ADRs, architecture doc. Note which are missing.

### 4. Present the findings

One short summary:

- mode, host agent, stacks and architecture, tracker, branch model and commit style;
- existing instruction files and the workflow doc;
- the CLI table (required / recommended / optional, with status and auth state);
- anything that will make a gate fail (a lint script with no linter config, a missing entry file).

### 5. Recommend dependencies

Follow [references/skill-catalog.md](references/skill-catalog.md). For every dependency with `relevant: true` and a relevant component missing for the host agent:

- **Skip it** if `previousDecision` is `declined`, unless something it depends on changed. Mention it once as previously declined.
- **Skip it unless asked** if it is `onRequestOnly` (delegate skills; a structural migration). Mention it as available on request. Never offer a delegate skill for the host's own CLI.
- **Skip it unless the architecture matches** if it is `requiresArchitectureMatch` (vertical-slice and `add-feature` skills): recommend it only when step 3 found that architecture, or the user chose it for a new project.
- **Mark it unsupported** if the host isn't in `supportedAgents`, or a version minimum fails, and say why.
- **Otherwise recommend it** with the fields from the catalog: name, purpose, official repository, why it applies here, status, exact install command for the host, restart needed, and fallback.

Include the required and recommended CLI tools that are missing, with the platform's install line from [references/cli-tools.md](references/cli-tools.md). Never propose installing coding-agent CLIs unless the user asked for external delegation with that agent.

Then ask one question: **install all recommended, choose some, or continue with the fallbacks for all.** Skip this step in a refresh when nothing relevant changed, and in an audit, which only reports.

### 6. Install what was approved

For each approved item, in order:

1. Show the exact command.
2. Run it. Use non-interactive flags only where the catalog gives them (`-a <agent> -y` for the skills CLI).
3. On failure (non-zero exit, network error, prompt it can't answer, unsupported platform): stop that item, show the error, and switch it to its fallback. Continue with the others.
4. Steps only the user can do, such as a slash command inside another agent, signing in or editing their global settings: give the instruction and record the item as **pending user action**.

The skills CLI also writes `skills-lock.json` in the project when it installs project-scoped skills. Mention it in the report; whether to commit it is the user's call.

Afterwards, run the inventory again. An item counts as installed only when it appears for the host agent. Plugins that need a restart are **installed, available after restart**: the generated files may name them, and the report says to restart before using them.

If Matt Pocock's skills are now available and `docs/agents/issue-tracker.md` doesn't exist, ask the user to run `/setup-matt-pocock-skills` and wait (only they can start it). If they decline, use the fallback tracker files.

### 7. Ask the remaining questions

One at a time, recommended answer first; skip anything the inventory, the docs or `workflowConfig` already settled:

1. **New project only:** the product in one or two sentences, users, first workflow, what is outside this repo, and the stack and architecture (if not chosen, they stay Open).
2. **Tracker:** if there is no `docs/agents/issue-tracker.md` after step 6, propose the fallback variant from the git remote ([references/tracker-and-domain.md](references/tracker-and-domain.md)).
3. **Branch model and commit style:** confirm what git shows (a `dev` branch means feature → `dev` → `main`; commit subjects show the format). With little or no history, recommend feature branches from `main` (add `dev` only if the user says a team integrates there), and `<type>(<scope>): <subject>` commits.
4. **Delegation:** the mode per [references/delegation.md](references/delegation.md). The default is native subagents when the host has them, otherwise direct work. An external implementer is used only when the user asks for it.
5. **Other agents:** which agents, other than the host, also work in this repo (default: none). This shapes the guard text and what `AGENTS.md` may name.
6. **Optional steps**, asked only when the skill is available: triage (and its label file), CodeRabbit `autofix` (only if the repo uses CodeRabbit).
7. **Review label:** only with GitHub or GitLab. Whether implemented issues get a label such as `pending-review` (default: no).
8. **Missing domain docs:** whether to create the skeletons ([references/greenfield-docs.md](references/greenfield-docs.md)); recommend yes for a new project and no for an existing one. For a repo with `workspaces` or several apps, single- or multi-context.
9. **Existing project only:** whether to run the gate commands found but not yet recorded as run, to mark them verified.
10. **Record decisions:** whether to save the dependency and delegation decisions in `docs/agents/workflow-config.json` ([references/workflow-config.md](references/workflow-config.md)).

### 8. Draft

Build each file from its template:

- [references/agents-md-template.md](references/agents-md-template.md)
- [references/claude-md-template.md](references/claude-md-template.md)
- [references/workflow-doc-template.md](references/workflow-doc-template.md)
- [references/step-procedures.md](references/step-procedures.md) for every step whose dependency is missing, declined, failed or unsupported
- the delegation text, the tracker/domain files and the workflow config when needed

Generated files must:

- name, for each agent, only capabilities available to it or an executable fallback;
- say which verification steps can actually run here, and mark the rest **not run**;
- preserve the project's instructions and architecture decisions;
- keep every external dependency optional unless the user chose a workflow that needs it.

When Claude Code isn't among the agents in use, don't create `CLAUDE.md` (keep an existing one). Put the step-to-skill table in `AGENTS.md` under **Agent skills**, naming only skills available to every agent in use. When those are user-level installs, introduce the table with "run a named skill when it is installed for you; otherwise follow the procedure". Describe the host's delegation mode in the workflow doc (§2 D).

Show new files in full. For existing files, show a diff, and list anything moved or removed with the reason.

### 9. Write

After an explicit "yes", write exactly what was shown.

### 10. Verify

Check the written files and report each item as pass or fail. In new content, fix any failure. In content the user wrote earlier, propose the fix instead (see Refresh).

- [ ] Every skill named is available to the agent the file addresses, or is a catalog built-in in `CLAUDE.md`. User-only skills are written as `/name` *(user runs)*, agent skills by bare name.
- [ ] Every step whose dependency is missing, declined, failed or unsupported points at a step procedure that exists in the workflow doc.
- [ ] Every linked path and section number exists, including links from other docs into the files just written.
- [ ] Every gate command comes from the README, CI or a task runner, or is marked **not run**. **Verified** means run in this session and passed, or recorded as run by the README or CI, with its date.
- [ ] `CLAUDE.md` starts with `@AGENTS.md` exactly once and restates no `AGENTS.md` rule beyond the one-line approval reminder.
- [ ] `AGENTS.md` carries the delegation guard, the approval rule and the read-first order. It names no file that doesn't exist.
- [ ] No business rule, decision ID or domain term was invented or copied from another project.
- [ ] No absolute path, username, credential or installed version from this machine appears in a generated file.
- [ ] Sections the user wrote earlier are still present, unchanged unless the user approved a change.
- [ ] Nothing was installed that the user didn't approve.

### 11. Report

- Files written or updated.
- Dependencies: installed (and for which agent), available after restart, pending user action, declined, failed (with the error), unsupported, previously declined.
- Skills named, and the step procedures used.
- Each gate command's verification state.
- Repo problems noticed on the way.
- Next steps, for example: restart the agent, run `/setup-matt-pocock-skills`, sign in to `gh`, run the gates, or commit the files (with the user's approval).

## Refresh and audit

On a repo set up earlier, run the same flow, then report drift before drafting anything:

- a skill named but no longer available to that agent, or a newly available skill for a step that still points at a step procedure;
- in `AGENTS.md` or `CLAUDE.md`, a user-only skill not marked *(user runs)* (adding the marks includes the one-sentence explanation from the `CLAUDE.md` template), or an agent skill written with `/`. Skill names in other docs are optional items;
- a gate command that changed in the README or CI;
- a linked path or section number that is gone, or a pointer such as "the review skills below" whose target has moved;
- a branch model or commit style that no longer matches git;
- a **Current state** line that no longer matches the code, docs or branches;
- the environment changed: a dependency the team uses (`previousDecision: installed`) is missing on this machine, or a newly relevant dependency appeared (new stack, new host agent). Offer it per step 5; a declined one stays declined.

An approved fallback is compliant. Report missing optional enhancements as information, separate from drift.

Questions 6–9 of step 7 don't apply in a refresh (ask 9 only when a gate command changed); whatever they would add goes in the optional list. An **audit** stops after the drift report and the optional list. It writes nothing and installs nothing.

Propose fixes for the drift only. List anything else you would change (wording, extra rows, fuller plugin names) as optional, separately, and change it only if the user picks it. Before proposing to remove or move existing content, check why it is there (`git log -S"<text>" -- <file>`). If a commit added it on purpose, ask instead of removing it: a deliberate team choice outranks this skill's defaults.

A refresh of a compliant project, with an unchanged environment, proposes no changes.
