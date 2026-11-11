# Step procedures (fallbacks)

Written procedures that replace a missing, declined, unsupported or failed dependency. They are steps an agent follows with the tools it already has, not skills, and they are never described as equivalent to the tool they replace when its coverage differs.

When the user chooses one, put it in the workflow doc's **Step procedures** section as `§8.<n> <Step>`, adapted to the project's tracker and names. `<Step>` is the procedure's heading below without its `F<n>.` id (`§8.2 Clarify`, `§8.8 React diagnostics without React Doctor`). `F1`–`F11` are this skill's own ids for the procedures: generated files and the workflow config never use them; they refer to the `§8.<n>` heading. Then point the step's row (in `CLAUDE.md`, or in `AGENTS.md` **Skills by step** when there is no `CLAUDE.md`) and the phase text at that heading. Where a procedure mentions a glossary, decision register or ADRs the project doesn't have, drop that part instead of pointing at a missing file.

**Never report an unexecuted check as passed.** Every gate and diagnostic is reported as **run and passed**, **run and failed** or **not run**, with the reason when it wasn't run.

## F1. Repository setup

Write `docs/agents/issue-tracker.md` and `docs/agents/domain.md` from [tracker-and-domain.md](tracker-and-domain.md). Add `docs/agents/triage-labels.md` only when the team uses triage labels.

## F2. Clarify

Before specifying a feature that isn't fully agreed:

1. Read the business reference, the glossary and the ADRs for the area.
2. List what is **Agreed**, **Open** and **Deferred** for the request.
3. Ask the user one question at a time about each Open item, recommended answer first, until nothing blocks the spec.
4. Record new or changed terms in the glossary and each answered decision in the decision register (status and date). Propose an ADR for a hard-to-reverse technical choice, with `status: proposed`.

## F3. Specify

Write the spec with: outcome and why; in scope and out of scope, with decision IDs; dependencies and blocking open decisions; acceptance cases (happy path, failure path, authorization and ownership, and concurrency or idempotency where relevant); test seams; data and migration impact; security and logging. Review it with the user. Creating the tracker item needs explicit approval.

## F4. Split into tickets

Split an approved spec into vertical slices that each deliver testable behavior end to end and carry their own tests. When the change records decisions, a docs/ADR ticket comes first. Write each ticket's blockers explicitly. Creating tickets needs explicit approval.

## F5. Implement

Work one ticket at a time. Start from the nearest comparable feature in the code. Write the acceptance tests at the agreed seams first when the behavior is clear. Keep the change inside the ticket's scope. Run the gates (format, build, tests) and report each one as run and passed, run and failed, or not run. Update docs, the README and ADRs in the same change when a convention, command or decision changes.

## F6. Review

Review the actual diff against the spec and the architecture:

1. **Gates:** run the format, build and test commands and report each result.
2. **Correctness:** every acceptance case is met; nothing outside the scope changed.
3. **Security:** authorization **and** ownership on every sensitive operation; input validation; no injection; no secrets; nothing sensitive logged.
4. **Production code:** the project's conventions; no duplication with the same reason to change in two places; no speculative abstractions, single-implementation interfaces or dead code.
5. **Tests:** each acceptance case has a test at the right seam; tests assert behavior, not implementation; no test that can't fail.
6. **Docs:** every changed command, path, flag and setting in the docs matches the code.
7. **Verify** each finding against the code and drop what doesn't hold. Report must fix / should fix / consider with `file:line` and the concrete fix.

Report this as a manual review. It doesn't replace the guard skills' failure-mode catalogs or a dedicated security review tool.

## F7. Git

Write the project's actual branch model and commit format into the workflow doc (see [workflow-doc-template.md](workflow-doc-template.md) §3). Base them on what `git log` and the branches show, not on a default.

## F8. Large uncertain work

For a destination too big or uncertain for one session (an unknown external provider, a migration with open questions), keep one parent tracker item listing the open questions as child items. Resolve the questions one at a time and record each answer before implementation tickets are written.

## F9. React diagnostics without React Doctor

Run the gates the project has (`lint`, type-check, `test`, `build` from `package.json`; see [stacks/react.md](stacks/react.md)) and review changed components against the conventions in `AGENTS.md`. Report: "React Doctor diagnostics were not run." Lint and type-check don't cover React Doctor's own checks (for example its architecture and accessibility rules), so never describe the gates as a React Doctor pass.

## F10. .NET without the .NET plugins

Use the .NET SDK commands the project already uses (format, build, test; see [stacks/dotnet.md](stacks/dotnet.md)) and the project's own conventions, ADRs and nearest comparable feature. For EF Core, use `dotnet ef` only when the project has it as a tool (`dotnet-tools.json`) and never against an unverified database. Report which plugin-specific checks (for example test-runner detection or query analysis) were not available.

## F11. Tracker without the GitHub CLI

When `gh` is missing or not signed in:

1. If the agent has an already authorized GitHub integration (an MCP server or connector), use it for reads, and for writes only with the same approval rules.
2. Otherwise, write the issue or PR body to the conversation and give the user the manual steps: open `https://github.com/<owner>/<repo>/issues/new` (or `/compare/<base>...<head>` for a PR) and paste it.
3. Never claim an issue, label or PR was created when it wasn't.

Install guidance for `gh` is in [cli-tools.md](cli-tools.md); signing in (`gh auth login`) is interactive and the user runs it.

The same applies to `glab` for GitLab, with the GitLab web pages.
