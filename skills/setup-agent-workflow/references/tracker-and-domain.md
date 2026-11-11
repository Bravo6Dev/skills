# Tracker and domain files (fallback)

Use these only when `setup-matt-pocock-skills` is **not** installed, or the user declined to run it. When it is installed and `docs/agents/issue-tracker.md` doesn't exist, ask the user to run `/setup-matt-pocock-skills` first (only they can start it), then continue. Its files have the same names and roles, so both paths leave the repo in the same shape.

Never overwrite an existing `docs/agents/issue-tracker.md`, `domain.md` or `triage-labels.md`. Read it and link to it. (`docs/agents/workflow.md` is the workflow doc; a refresh updates it in place under rule 6 in `SKILL.md`.)

## `docs/agents/issue-tracker.md`

Pick the variant from the git remote (`git.remotes[].host` in the inventory) and confirm it with the user.

### GitHub (`gh`)

```markdown
# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues in `<owner>/<repo>`. Use the `gh` CLI.

- **Create:** `gh issue create --title "..." --body "..."` (for a multi-line body, write it to a file and pass `--body-file <file>`; that works in every shell, PowerShell included).
- **Read:** `gh issue view <n> --json number,title,body,labels,comments`.
- **List:** `gh issue list --state open --json number,title,labels`.
- **Sub-issue:** `gh issue create --parent <parent> ...` (gh 2.94+); with an older `gh` or without sub-issues, start the child body with `Part of #<parent>`.
- **Comment / label / close:** `gh issue comment`, `gh issue edit --add-label`, `gh issue close`.
- **Approval gate:** never create, edit, label or close an issue or PR without explicit user approval of that write.

When a skill or procedure says "publish to the tracker", create a GitHub issue. "Fetch the ticket" means read it as above.
```

These are tracker usage, not gates, so they need no verification mark. The file is shared by the team, so it states the requirement, not this machine's state: add the line "Requires the GitHub CLI (`gh`), signed in with `gh auth login`. Without it, follow `<workflow doc>` §8.<n>." The workflow doc carries the tracker-without-CLI procedure (F11) whenever the tracker is GitHub or GitLab, whether or not the CLI is installed on this machine, because a teammate's machine may lack it. (If the repo keeps its own workflow doc and the user declined adding that procedure to it, drop the second sentence instead of pointing at a missing section.) Whether `gh` is missing on this machine goes in the report, never in the file. Do the same with `glab` for GitLab.

### GitLab (`glab`)

Same shape with `glab issue create|view|list|note|update|close`, and `glab mr` for merge requests.

### Local markdown

```markdown
# Issue tracker: local markdown

Issues and specs live as files under `.scratch/`.

- One feature per directory: `.scratch/<feature>/`; the spec is `spec.md`.
- One file per ticket: `.scratch/<feature>/issues/<NN>-<slug>.md`, numbered from `01`.
- A `Status:` line near the top records state; a `Blocked by: NN, NN` line records blockers.
- Discussion is appended under `## Comments`.
```

### Other (Jira, Linear, Azure Boards, …)

Ask the user for one paragraph on how they create, read, link and close items. Write it as prose under `# Issue tracker: <name>`, followed by the same approval-gate line.

## `docs/agents/domain.md`

```markdown
# Domain docs

How agents read and update this repo's domain documentation.

## Before exploring, read these

- **<glossary location>:** the canonical business vocabulary.
- **<decision register location>:** agreed, open and deferred decisions. Don't implement around Open or Deferred items by assumption.
- **<ADR directory>:** technical decisions for the area you're working in.
- **<architecture doc>:** the code conventions every change follows.

## Updating vocabulary and decisions

- When a term is resolved, update the glossary.
- When a business question is answered, update its decision row (status and date) and the section it affects.
- Write ADRs in the format of `<ADR directory>/README.md`, with `status: proposed` until the user approves them.

## Use the glossary's vocabulary

Use glossary terms in issue titles, test names and proposals. Don't drift to synonyms the glossary lists under "Avoid". If a concept isn't in the glossary, either it isn't the project's language (reconsider) or there's a real gap (note it).

## Flag conflicts

If your output contradicts an ADR or an approved decision, say so explicitly instead of silently overriding it.
```

Fill the placeholders with paths that exist, or with the skeleton paths from [greenfield-docs.md](greenfield-docs.md) when the user approved creating them. Drop the bullets for sources that don't exist. If none of the four exists and the user declined the skeletons, don't write `domain.md`, and leave the **Domain docs** block out of `AGENTS.md`.

## `docs/agents/triage-labels.md`

Only when the team uses triage labels. A table mapping the five roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) to the label strings the tracker actually uses. Keep the defaults unless the tracker already uses other names.
