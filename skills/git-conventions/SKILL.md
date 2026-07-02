---
name: git-conventions
description: Applies this team's Git branching, commit-message, and pull-request conventions whenever writing a commit message, naming or creating a branch, opening or describing a pull request, or giving any git workflow advice for .cs, .sql, or .md changes. Use this any time the user asks things like "write a commit message for this", "what should I name this branch", "is this ready to merge into main", or is otherwise working with git in a project that follows these conventions — even if they don't explicitly mention "git conventions" or name this skill.
---

# Git Workflow Conventions

These are the team's house rules for git. The goal behind all of them is the
same: `main` should always be safe to deploy, and history should be easy for
a reviewer (or future you) to read and, if needed, undo.

## Branching model

- **Feature branches** — every new feature or bug fix gets its own branch off
  `dev`. Don't commit directly to `main` or `dev`.
- **`dev`** is the integration branch. Features land here first and get
  tested together before they're allowed anywhere near `main`.
- **`main`** must always be deployable. No broken code, no failing tests, no
  exceptions — this is the branch that ships. It's protected: changes only
  land via pull request, never a direct push.
- **Rebase feature branches** onto the latest `dev` before merging. This
  keeps history linear and avoids a tangle of merge commits that make `git
  log` and `git blame` painful to read later.

When naming a branch, favor `<type>/<short-description>`, matching the
commit type below, e.g. `feat/patient-intake-form`, `fix/moamalat-timeout`.

## Commit messages

Format: `<type>(<scope>): <subject>`

`<type>` is one of:

| Type | When to use it |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace, missing semicolons — no logic change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or correcting tests |
| `chore` | Build process, tooling, dependencies — anything not touching app code |

`<scope>` is the area of the codebase affected (a module, feature, or layer —
e.g. `auth`, `scheduling`, `emr`). Keep `<subject>` short, imperative, and
written as if completing the sentence "this commit will...".

See `references/commit-examples.md` for worked examples across each type,
including a couple of borderline cases (e.g. is a migration `feat` or
`chore`?).

**Keep commits small and focused on a single logical change.** A commit that
mixes a bug fix with an unrelated refactor is harder to review, harder to
revert, and harder to cherry-pick later. If a change touches multiple
concerns, split it into multiple commits.

## Pull requests

- Every merge into `dev` or `main` goes through a pull request — this is
  where code review and discussion happen, not after the fact.
- A PR description should make it easy for a reviewer to know *what* changed
  and *why*, not just restate the diff.
- Before opening a PR, rebase onto the target branch's latest commit so the
  PR shows a clean, linear diff.

## Applying this in practice

When asked to write a commit message, first identify the type and scope from
the actual change described — don't default to `feat` for everything. When
asked about branch or merge strategy, check whether the target is `main`
(needs a PR, must be deployable, no exceptions) or `dev` (integration branch,
still needs a PR but slightly more tolerant of in-progress work). When in
doubt about scope naming, look for existing scopes already used in the
project's recent commit history rather than inventing a new one.
