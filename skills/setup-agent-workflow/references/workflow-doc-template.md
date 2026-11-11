# `docs/agents/workflow.md` template

The long-form workflow that `AGENTS.md` routes to. It describes **steps**, not tools: an agent without any skill can follow it. Claude Code's skill choices for each step stay in `CLAUDE.md`.

If the repo already has an equivalent document (see **Workflow doc** under Classify in `SKILL.md`), don't write this file. Link to the existing one from `AGENTS.md` and `CLAUDE.md`, and propose as additions only the sections below that it lacks. Use its own section numbers in every link.

**Budget:** about 150–250 lines. Step procedures from [step-procedures.md](step-procedures.md) add to that.

## Template

```markdown
# <Project> — Agent workflow

> **Version:** 0.1 · **As of:** <YYYY-MM-DD>
> **Status:** Engineering workflow and guardrails. Describes what exists only where marked as verified.

This document controls **how agents work**; `<business reference>` controls **what the business means**; `<architecture doc>` controls **how code is shaped**.

## 1. Sources of truth

| Content | Location | Authority |
|---|---|---|
| Product boundaries, business rules, decisions, glossary | `<business reference>` | Approved business intent, subject to each decision's status |
| Engineering workflow | `<this file's path>` (this file) | Approved technical workflow |
| Code conventions | `<architecture doc>` | Rules every change follows |
| Technical decisions | `<ADR directory>` | Accepted ADRs |
| Specs, tickets, progress | <tracker> | Scope of one change and its status |
| Commands | <`README.md` when it records the gates, otherwise the gate table in §2 C> | Each command marked verified (with its date) or not run, in §2 C |
| Agent routing | `AGENTS.md` (all agents)<, `CLAUDE.md` (Claude Code only), when Claude Code is used> | Short pointers; never duplicate these docs |

**When sources disagree:** approved business decisions govern intended behavior; code and tests show actual behavior; the tracker shows planned progress. Surface the disagreement with evidence. Neither an old plan nor a test count silently overrides a current decision.

## 2. Phases

### A. Repository setup

<What is configured and when: tracker, labels, domain docs, templates. "Done <date>" or "To do".>

### B. Clarify and specify

1. Read `AGENTS.md`, the business reference, this file, the architecture doc and the ADRs touching the area.
2. Separate **Agreed**, **Open** and **Deferred** requirements for the request. Never implement an Open or Deferred item by assumption.
3. **Ambiguous request:** clarify it against the docs, updating the glossary and proposing ADRs as decisions settle. <When no clarify skill is installed: "See §8.<n> Clarify.">
4. **Agreed request:** write the spec (outcome, scope, out of scope, decision IDs, acceptance cases, test seams, data/migration impact). Review it with the user. <§8.<n> when no spec skill is installed.>
5. **Multi-slice work:** split the approved spec into tickets with explicit blockers; a docs/ADR ticket comes first when the change records decisions; then one ticket per vertical slice, each with its own tests. <§8.<n> when no ticket skill is installed.>
6. **Explicit user approval is required before creating any issue or ticket**, not only before coding.

### C. Implement and verify

- Implement one ticket at a time, test-first at the agreed seams, following the architecture doc. <§8.<n> when no implement skill is installed.>
- **Gates** before review. <When `README.md` holds the commands: "the format, build and test commands in `README.md` (format: <verified YYYY-MM-DD / not run>; build: <…>; test: <…>)." Otherwise this table:>

  | Gate | Command | Needs | Status |
  |---|---|---|---|
  | Format | `<command>` | <tool, e.g. .NET SDK> | <verified YYYY-MM-DD / not run> |
  | Build | `<command>` | <…> | <…> |
  | Test | `<command>` | <…, e.g. Docker for Testcontainers> | <…> |

  Report each as **run and passed / run and failed / not run**. A gate whose tool is missing on a machine is **not run** there, never passed.
- **Optional diagnostics** <only those the team uses, e.g. "React Doctor: `npx react-doctor@latest` (downloads and runs the latest release; ask before running). When it isn't run, say 'React Doctor diagnostics were not run'.">.
- <Optional review label line.>
- Update the architecture doc, README and ADRs in the same change when a convention, command or decision changes.

### D. Delegation

Delegation is defined per agent: <when Claude Code is in use: "Claude Code's procedure is in `CLAUDE.md`."; otherwise the host's mode, e.g. "Codex implements directly."> An implementer or subagent executes its brief directly and never re-scopes, creates tracker items, commits or delegates further. Agents without a delegation procedure perform these steps directly. Another agent's CLI is used only when the user explicitly asks for it.

### E. Review and land

Review each change as §4 describes. Land it as §3 describes: commit, push, open or update the pull request and merge only with explicit approval, then report what landed and what is still open.

## 3. Issues, branches and pull requests

<Write the model the repo actually uses. Default for a repo with a `dev` branch:>

One feature, fix or refactor gets **one parent issue, one branch and one pull request**. Sub-issues split the work; they don't get their own branches or PRs.

- **Branches:** `<main>` is always deployable<" and protected", only when the user confirmed that branch protection is on>; `<dev>` is the integration branch. Work branches come from `<dev>`, named `<type>/<feature>`.
- **Commits:** `<type>(<scope>): <subject>` (`feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`), small and focused; scope = feature area (<the project's areas>).
- **Pull request:** one PR from the work branch into `<dev>`, opened as a draft (with approval) once the first sub-issue lands, marked ready when all are done. The body opens with `Part of #<parent>`, keeps a slice table (order, ticket, slice, status) and lists `Closes #<n>` per finished sub-issue.
- `<dev>` → `<main>` is a separate PR when a release is cut.
- A change too small for sub-issues is still one issue, one branch and one PR.

<Trunk-based variant, for a repo with only `main`: work branches come from `main` and merge back by PR; no `dev` line.>

## 4. Reviewing a pull request

1. **Scope.** Read the PR, its diff and the issues it names: they are the spec. Review the head branch in a separate worktree, leaving the user's checkout alone.
2. **Gates.** Run the gates (<`README.md` | the gate table in §2 C>) in that worktree; report each result.
3. **Coverage.** Correctness against the spec, security (<authorization **and ownership**,> validation, secrets, sensitive-data logging), maintainability and tests. <When no review skill is installed: "Use the checklist in §8.<n> Review."; otherwise "The review skills to run are listed under **PR review skills** in `AGENTS.md`.">
4. **Duplication.** Prefer an existing helper. Propose a shared abstraction only when the same logic with the same reason to change exists in at least two places and call sites get simpler.
5. **Verify** each finding against the code; drop what doesn't hold.
6. **Report:** gate results, then findings as must fix / should fix / consider with `file:line`, the check that raised it and the concrete fix.

Don't post comments, approve, push or merge without explicit approval.

## 5. Definition of done

Every work item states: outcome and why; in/out of scope; dependencies and blocking open decisions; acceptance cases (happy path, failure path, <authorization and ownership,> and concurrency/idempotency where relevant); test seams; data/migration impact; security and logging.

A change is done only with source evidence, gates run and reported, docs/ADRs updated, and review completed. A proposal, plan, label or generated test is not evidence of implementation.

## 6. Repository safety

- Inspect the worktree before changing anything; never overwrite user work or edit unrelated files.
- Never commit secrets, `.env` files, credentials or real user data.
- Never run migrations or destructive commands against an unverified database.
- Ask before creating issues, labels, commits, pushes, PRs, merges, remotes, deployments, CI files, or adding a package or technology outside the approved stack.
- Don't infer a remote or account from the project name; check `git remote -v`.

## 7. Maintenance

Update this guide when a workflow step or command changes; the business reference when a business rule changes; the architecture doc when a code convention changes; and add an ADR for hard-to-reverse decisions. Keep `AGENTS.md` <and `CLAUDE.md`> short and pointing here. Preserve the distinction between **approved**, **proposed**, **not run** and **verified**.

## 8. Step procedures

<Only when at least one step has no installed skill, or the tracker is GitHub or GitLab (the tracker-without-CLI procedure is always included then). One subsection per procedure the user chose, from step-procedures.md (F1–F11), adapted to the project's tracker and names. The `F<n>` ids are the skill's own names for the procedures; they never appear in this document, which refers to them by `§8.<n>` and heading:>

### 8.1 <Step>

…
```

## Writing rules

- Phase text is written for an agent with no skills. Skill names appear only in `CLAUDE.md`, or in `AGENTS.md` **Skills by step** when there is no `CLAUDE.md`.
- Step procedures live only in §8, numbered `8.1`, `8.2`, … in the order of the phases they serve (setup, clarify, specify, split, implement, review), followed by the ones tied to no phase (git, large work, stack diagnostics, tracker). The numbers are this document's own and don't match the skill's `F<n>` ids. Phase text and `CLAUDE.md` rows point at `§8.<n>`. Leave out §8 only when every step has a skill and the tracker is neither GitHub nor GitLab.
- Gate commands go in exactly one place: the README when it records them, otherwise the gate table here. The other file links to it. The verification marks always live here, in §2 C: in the gate table's Status column, or, when the README holds the commands, in the status note after the pointer to it. The README is not edited to carry them.
- Mark a command **verified** only if it was run in this session and passed (with the date), or it already carries a **verified <date>** mark from an earlier run (keep that date). A command that the README or CI only lists is **not run**: say where it is recorded, and don't present it as passing.
- Adapt §6 to the project: drop the database line when there is no database, and keep the secrets, approval and remote lines always.
- Adapt the security wording in §4 and §5: keep "authorization and ownership" where the project has callers or data to protect (a service, an app with accounts); drop it for a library or CLI with neither.
- On a refresh, change **Version** and **As of** only when the content changes.
- Drop parts that point at docs the project doesn't have (decision IDs, glossary, ADRs) instead of linking to missing files.
