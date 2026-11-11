# `AGENTS.md` template

`AGENTS.md` is the entry point every coding agent reads (Claude Code through the `@AGENTS.md` import in `CLAUDE.md`, Codex and others directly). It routes; it doesn't explain. Long procedures belong in the workflow doc (`docs/agents/workflow.md` or the repo's equivalent), business rules in the business reference, code shape in the architecture doc.

**Budget:** about 60 lines plus the conventions section. If conventions push the file past about 150 lines, move the stable rules into the architecture doc and keep only the judgment calls here.

## Section contract

Keep this order. Leave out a section whose source doesn't exist; never write a section that points at a missing file.

```markdown
# <Project> — Agent Entry Point

<2–4 sentences. What this repository is (back end, mobile app, monorepo…), the product in one line, its first or main workflow, what lives outside this repo (other clients, services), and, when it's easy to confuse, what it is not.>

## Read first (in order)

1. `<business reference>`: product scope, business rules, decision register, glossary. Business authority.
2. `<workflow doc>`: engineering workflow, issues/branches/PRs, review procedure. Technical authority.
3. `<architecture doc>`: <what it fixes: projects, folders, errors, persistence, tests>. Follow it in every change.
4. `<ADR directory>`: recorded technical decisions (index in `<ADR directory>/README.md`).
5. `README.md`: <"build and test commands" only when the README records the gates; otherwise what it does hold, or drop this item. Don't call the commands verified here: each one's verification state is recorded in `<workflow doc>`>.

Don't restate or override those docs here; approved changes go into them.

## Ground rules

- Follow the most recent agreed business rules. Don't implement an **Open** or **Deferred** requirement by assumption; ask.
- <Stack rule: "The stack is fixed by <ADR/doc>: <one-line shape>. No <the tempting alternatives> without an approved ADR or spec." While the ADR is still proposed, write "proposed in <ADR>".>
- <Data rule, when the project handles personal or private data: "Protect personal data and private documents by default: check <who may act: the role or policy> **and** ownership on every sensitive operation; never log secrets, tokens, <project-specific sensitive values>." For a client app that holds no data of its own, keep only the logging half.>
- **Current state:** <one or two sentences on what verifiably exists and what doesn't, on which branch. In a new project: "No application code exists yet.">
- Get explicit approval before creating issues or labels, committing, pushing, opening PRs, adding a remote, or deploying.
- <Optional, only if the user wants a review label: "After implementing and verifying an issue, add the existing `<label>` label to that issue so it is ready for review.">
- Don't edit unrelated files, overwrite user work or introduce secrets. If repository instructions conflict with these documents, explain the conflict and ask.

## <Language> conventions

<One line naming what tooling already enforces and the auto-fix command, e.g. "`.editorconfig` enforces formatting and naming in the format check and the Release build; run `dotnet format <solution>` to fix what has an automatic fix (not naming)". Then only the rules that need judgment, as bullets: **Name.** rule, with a tiny example when the rule is about shape. Source them from the code (see the stack reference); never import another project's rules. When the architecture doc already states a rule, point to it in one line instead of restating it. In a new project with no code, write one line instead: "Conventions are recorded in `<architecture doc>` as the first slices land; until then follow `<ADR-0001>`." Without an architecture doc or ADR: "Conventions are added to this section as the first features land.">

## Agent skills

### Agent-specific workflows

<Guard text from delegation.md.>

### Skills by step

<Only when there is no separate `CLAUDE.md` to hold it (Claude Code isn't among the agents in use, or `CLAUDE.md` is a link to this file that the user kept as one shared file): the step table from the `CLAUDE.md` template, naming only skills available to every agent in use, with "follow `<workflow doc>` §8.<n>" for the rest. Plugin skills follow the rule under **Where a skill may be named** in the catalog.>

### <Stack> work

<Only when a stack skill is installed in a cross-agent location: "New <unit of work> follow the `<skill>` skill and `<architecture doc>`. Other <stack> skills are references inside that architecture, never a reason to change it.">

### Branches and pull requests

<One or two sentences: unit of work (one parent issue, one branch, one PR), base branch, branch naming, commit format. "See `<workflow doc>` §<branches section>.">

### Reviewing a pull request

Review the actual changes against the spec and architecture, covering correctness, security (<authorization and ownership, where the project has callers or data to protect>), maintainability, tests and meaningful duplication without overengineering. Verify findings against code and run the gates. See `<workflow doc>` §<review section>.

### PR review skills

When reviewing a PR, follow `<workflow doc>` §<review section> and run, when installed:

- `<skill>` — <the part of the change it covers>.

<List the installed review skills; each agent runs the ones it has. Include Claude Code built-ins such as `/security-review` only when Claude Code is in use. With no review skill available, drop "and run, when installed:" and the list.>

### Issue tracker

<Tracker in one line, e.g. "GitHub Issues in `<owner>/<repo>` via `gh`">. <Only if `docs/agents/issue-tracker.md` exists or is written in this run; otherwise keep the one line above and drop this link:> See `docs/agents/issue-tracker.md`.

### Triage labels

<Only if docs/agents/triage-labels.md exists.> See `docs/agents/triage-labels.md`.

### Domain docs

<Only if docs/agents/domain.md exists. "Single-context; glossary lives in <location>"> See `docs/agents/domain.md`.
```

## Writing rules

- Every path, command and skill name must exist. Check each one before writing.
- Say "current state" only with evidence; in a new project say what doesn't exist yet.
- Use the project's glossary terms. Don't introduce synonyms.
- If `setup-matt-pocock-skills` wrote an `## Agent skills` block, keep its three sub-blocks (tracker, labels, domain) and add the other sub-blocks around them. Don't create a second block.
- No comments to the reader about how the file was generated.
