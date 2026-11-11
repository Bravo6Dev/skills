# `CLAUDE.md` template

`CLAUDE.md` imports `AGENTS.md` and adds only what is specific to Claude Code: which skill runs each step, and how delegation works. Shared rules never move here.

**Budget:** about 50 lines, plus the delegation section in modes A and B.

## Template

```markdown
@AGENTS.md

# Claude Code-specific workflow

These instructions apply only to Claude Code. Shared repository policies remain in `AGENTS.md` and `<workflow doc>`.

## Skills

Use the installed skills as each step needs them, following each skill's own instructions. Check a skill is installed before naming it; never invent one. <If any user-only skill is listed:> Skills written as `/name` with *(user runs)* start only when the user types them; suggest them, don't invoke them.

<With no skill installed, replace that paragraph with: "No skills are installed for this repository yet. Each step follows its procedure in `<workflow doc>` §8; when a skill is installed later, update this table (the `setup-agent-workflow` skill's `refresh` does that, for those who have the skill).">

| Step | Skills |
| --- | --- |
| Repository setup <(done)> | `/setup-matt-pocock-skills` *(user runs)* |
| Clarify a feature or user story | `/grill-with-docs` *(user runs)*, `domain-modeling` (<glossary location> and ADRs) |
| Specify | `/to-spec` *(user runs)*, then `/to-tickets` *(user runs)* for multi-slice work |
| Triage | `/triage` *(user runs)* with the labels in `docs/agents/triage-labels.md` |
| Implement | `/implement` *(user runs)* with `tdd`; `<stack skill>` for every <unit of work> |
| <Stack> reference | <plugin skills found>, applied inside <ADR/architecture doc> |
| React diagnostics | <React projects only: "React Doctor (`npx react-doctor@latest`, ask before running)" or "Not installed: follow `<workflow doc>` §8.<n>"> |
| Review | the PR review skills in `AGENTS.md`<, plus Claude-only ones it doesn't list> |
| Git | `git-conventions` for branch names, commits and PR text |
| Large uncertain work | `/wayfinder` *(user runs)* (rarely) |

Never treat this workflow as permission to create issues, labels, commits, pushes, PRs, remotes or deployments without explicit approval.

<Delegation section from delegation.md, modes A/B. Mode C: "Claude implements directly; no delegation is configured for this repository.">
```

## Filling the table

- One row per step the team uses; drop rows for steps the team doesn't do (for example, no triage).
- A step with no installed skill and a written procedure: `No skill installed — follow <workflow doc> §8.<n>`.
- A step the user chose to skip: drop the row. Triage appears only under the condition in the catalog.
- Review: point at the **PR review skills** block in `AGENTS.md` rather than repeating it. List skills here only when `AGENTS.md` has no such block.
- Mark every user-only skill (inventory `userOnly: true`) with `/` and *(user runs)*. Agent-invocable skills appear by bare name.
- The rows above show bare names, which is how skills installed through the skills CLI are listed. When the inventory lists a skill under a plugin (`mattpocock-skills:to-spec`, the result of the Claude Code plugin install), write that full name in the row: `/mattpocock-skills:to-spec` *(user runs)*, `mattpocock-skills:tdd`.
- Mark "Repository setup (done)" only when `docs/agents/issue-tracker.md` exists.
- A plugin installed in this run that needs a restart may be named. The report, not the file, says to restart.
- Name only skills whose `agents` include `claude-code`. A skill installed only for another agent doesn't count here.
- Reference plugins (the `<Stack> reference` row) also use the full `<plugin>:<skill>` name, a few representative ones followed by "…". Name only those that match libraries the project uses or has chosen. Leave out `ef-core` while the data-access library is still Open.

## Existing `CLAUDE.md`

- If it lacks `@AGENTS.md` and holds shared rules, propose moving the shared rules to `AGENTS.md` and show the move. Do it only after approval.
- If it already has a `## Skills` or delegation section, update that section in place. Keep every other section the user wrote.
- Never add `@AGENTS.md` twice.
