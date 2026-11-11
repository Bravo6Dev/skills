---
name: git-conventions
description: Applies a team's Git branching, commit-message, and pull-request conventions — feature branches off an integration branch, Conventional Commits messages, and PR-only merges into protected branches. Use when writing a commit message, naming or creating a branch, opening or describing a pull request, or answering a git workflow question such as "write a commit message for this", "what should I name this branch", or "is this ready to merge into main".
---

# Git Workflow Conventions

These are house rules for git, written for a team that ships from `main` and
integrates on `dev`. The goal behind all of them is the same: `main` should
always be safe to deploy, and history should be easy for a reviewer (or
future you) to read and, if needed, undo.

## Check the repository first

The rules below describe a `main` + `dev` model. Before applying them, look
at what the repository actually does:

- `git branch -a` — is there a `dev` (or `develop`) branch? What is the
  default branch (`main`, `master`, something else)?
- `git log -15 --format=%s` — do recent subjects already follow a format, and
  which scopes are in use?
- `CONTRIBUTING.md`, a pull-request template, or any other place the
  repository documents its own branch and commit rules.

What the repository documents wins; use this skill for whatever it leaves
open. Read `main` below as the repository's default branch. If there is no
`dev` branch, branch features off the default branch and treat it as the
protected one — don't create `dev`, and don't tell the user to.

Some choices belong to the team and are not set here: how pull requests are
merged (merge commit, squash, or rebase-merge), how `dev` is promoted to
`main`, and how a hotfix reaches `main`. If the repository doesn't document
them and the task depends on one, ask the user instead of picking one.

## Branching model

- **Feature branches** — every new feature or bug fix gets its own branch off
  `dev`. Don't commit directly to `main` or `dev`.
- **`dev`** is the integration branch. Features land here first and get
  tested together before they're allowed anywhere near `main`. It must still
  build and pass its tests; what it tolerates is *incomplete* work — a
  feature that lands in several PRs or sits behind a flag — not broken work.
- **`main`** must always be deployable. No broken code, no failing tests, no
  exceptions — this is the branch that ships. It's protected: changes only
  land via pull request, never a direct push.
- **Rebase feature branches** onto the latest `dev` before merging. This
  keeps the branch's history linear and avoids a tangle of merge commits that
  make `git log` and `git blame` painful to read later.
  - Rebase only a branch that is yours alone. If someone else has pulled it
    or pushes to it, don't rewrite it — merge `dev` into it instead, or agree
    on the rebase with them first.
  - After rebasing a branch that was already pushed, update the remote with
    `git push --force-with-lease`, never a plain `--force`.
  - Never force-push `dev` or `main`.

When naming a branch, favor `<type>/<short-description>`, matching the
commit type below, e.g. `feat/patient-intake-form`, `fix/moamalat-timeout`.
Keep it lowercase with words separated by hyphens. If the repository's
existing branches carry a ticket id, include it the same way they do.

## Commit messages

Messages follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

`<type>` is one of:

| Type | When to use it |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace, missing semicolons — no logic change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | A change that improves performance without changing behavior |
| `test` | Adding or correcting tests |
| `build` | Build system and dependencies — package versions, lock files, project files |
| `ci` | CI configuration and pipeline scripts |
| `chore` | Repository maintenance that touches neither app code nor the build — e.g. `.gitignore`, editor config |
| `revert` | Reverts an earlier commit |

Only `feat` and `fix` are defined by the specification itself; the others are
the additional types it allows, taken from the Angular convention.

The scope is optional: a noun in parentheses naming the area of the codebase
affected (a module, feature, or layer — e.g. `auth`, `scheduling`, `emr`).
Use one when the change belongs to one area and the project's history uses
scopes; leave it out otherwise.

Keep the description short, imperative, and written as if completing the
sentence "this commit will...". Aim for 50 characters or fewer and never let
the whole first line pass 72. Start it lowercase, as the examples do, and
don't end it with a period.

Add a body when the subject can't carry the *why*. Separate it from the
subject with one blank line, wrap it at 72 columns, and explain what changed
and why rather than how. Footers go after one more blank line, one per line,
as `Token: value` — e.g. `Refs: #123`.

**Breaking changes** are marked with `!` before the colon, with a
`BREAKING CHANGE: <description>` footer, or with both. The footer token is
uppercase. Either mark is valid with any type.

See `references/commit-examples.md` for worked examples across each type,
including a breaking change, a commit with body and footers, a revert, a
change split into several commits, and a couple of borderline cases (e.g.
which type does a database migration get?).

**Keep commits small and focused on a single logical change.** A commit that
mixes a bug fix with an unrelated refactor is harder to review, harder to
revert, and harder to cherry-pick later. If a change touches multiple
concerns, split it into multiple commits.

## Safety

- **Never commit secrets** — credentials, tokens, connection strings, private
  keys, `.env` files. If one is staged, unstage it. If one was already
  pushed, tell the user it has to be rotated: a later commit that removes it
  does not remove it from history.
- **Stage deliberately.** Review `git status` and `git diff --staged` before
  committing instead of running a blind `git add -A` or `git add .`.
- **Don't skip hooks** with `--no-verify`. If a hook fails, fix the cause or
  ask.
- **Don't amend a commit that others may have pulled.** To undo something
  that is already on `dev` or `main`, use `git revert` — a new commit — rather
  than rewriting shared history.

## Pull requests

- Every merge into `dev` or `main` goes through a pull request — this is
  where code review and discussion happen, not after the fact.
- Title the PR in the commit format, `<type>[optional scope][!]: <description>`.
- A PR description should make it easy for a reviewer to know *what* changed
  and *why*, not just restate the diff. Link the issue or ticket when there
  is one.
- Keep a PR to one logical change. Unrelated work goes in its own PR.
- Before opening a PR, rebase onto the target branch's latest commit so the
  PR shows a clean, linear diff (see the rebase rules under
  [Branching model](#branching-model)).

Checklist before asking for review:

- [ ] The branch is based on the right branch and up to date with it.
- [ ] The project builds and its tests pass.
- [ ] Each commit is one logical change with a message in the format above.
- [ ] The diff has no secrets, debug leftovers, or unrelated files.
- [ ] The description says what changed and why, and links the issue.
- [ ] Breaking changes are marked in the commit and called out in the
      description.

## Applying this in practice

Start from the repository (see [Check the repository first](#check-the-repository-first)).
When asked to write a commit message, first identify the type and scope from
the actual change described — don't default to `feat` for everything. When
asked about branch or merge strategy, check whether the target is `main`
(needs a PR, must be deployable, no exceptions) or `dev` (integration branch,
still needs a PR and a passing build, but accepts a feature that is not
finished yet). When in doubt about scope naming, look for existing scopes
already used in the project's recent commit history rather than inventing a
new one.
