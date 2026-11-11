# Commit Message Examples

Worked examples for each `<type>`, plus a couple of borderline calls.

The inputs come from one project (a clinic scheduling system on .NET). The
scopes and names are illustrative — use the scopes the repository you are
working in already uses.

## feat

Input: Added the ability for doctors to block off recurring unavailable time slots
Output: `feat(scheduling): add recurring unavailable time slots for doctors`

## fix

Input: Moamalat webhook was silently failing on duplicate idempotency keys
Output: `fix(payments): handle duplicate idempotency keys in Moamalat webhook`

## docs

Input: Wrote up the onboarding steps for new backend devs
Output: `docs(readme): add backend onboarding guide`

## style

Input: Ran the formatter across the EMR controllers, no logic touched
Output: `style(emr): apply code formatting to controllers`

## refactor

Input: Extracted the shared soft-delete filter logic into a base repository
Output: `refactor(data): extract soft-delete filter into base repository`

## perf

Input: Replaced the per-row doctor lookup in the daily schedule query with a single join
Output: `perf(scheduling): load doctors with a single join in daily schedule`

## test

Input: Added unit tests for the SERIALIZABLE transaction path in appointment booking
Output: `test(scheduling): cover serializable transaction path in booking`

## build

Input: Bumped EF Core and updated the lock file
Output: `build(deps): bump EF Core from <old version> to <new version>`

Name the actual versions; "latest" says nothing once a newer one exists.

## ci

Input: Made the pipeline run the integration tests on every pull request
Output: `ci: run integration tests on pull requests`

## chore

Input: Added the IDE settings folder to .gitignore
Output: `chore: ignore IDE settings folder`

No scope here: the change doesn't belong to one area of the codebase.

## revert

Input: The recurring time-slots feature broke booking; taking commit 3f9c2ab back out
Output:

```
revert: add recurring unavailable time slots for doctors

Refs: 3f9c2ab
```

Create the commit with `git revert` so the change itself is the exact
inverse, then give it this message.

---

## Body and footers

Input: Fixed the Moamalat webhook timing out; the handler did the ledger write
inside the request. Tracked as issue 482.
Output:

```
fix(payments): acknowledge Moamalat webhook before ledger write

The handler wrote to the ledger before responding, so a slow write made
the gateway time out and retry. Acknowledge first and process the event
from the queue instead.

Refs: #482
```

## Breaking change

Input: The appointments API now returns times in UTC instead of clinic local time
Output:

```
feat(api)!: return appointment times in UTC

BREAKING CHANGE: appointment start and end times are now UTC. Clients
that displayed them as-is must convert to the clinic's time zone.
```

The `!` and the `BREAKING CHANGE:` footer each mark the break on their own;
using both makes it visible in the one-line log and explains it.

## Splitting a change that mixes concerns

Input: Fixed the duplicate-booking bug, and while in there renamed
AppointmentSvc to AppointmentService and reformatted the file
Output: three commits, in an order where each one builds —

1. `refactor(scheduling): rename AppointmentSvc to AppointmentService`
2. `style(scheduling): apply code formatting to AppointmentService`
3. `fix(scheduling): prevent duplicate booking for the same slot`

---

## Borderline cases

**A new database migration that adds a column for an existing feature.**
If the migration exists to support a new feature landing in the same PR, fold
it into that `feat` commit rather than splitting it out — reviewers want to
see schema and code together. If it's a standalone schema change with no
accompanying feature code (e.g. an index added purely for performance), give
it the type that matches its purpose:
`perf(db): add index on appointments.doctor_id`.

**Renaming a class or file with no behavior change.**
This is `refactor`, not `chore` — it's a code-organization change, not a
tooling/build change. `refactor(scheduling): rename AppointmentSvc to
AppointmentService`.

**Fixing a typo in a comment.**
If you notice it while changing that same code, fix it there — it doesn't
need a commit of its own, and it isn't a second logical change. As a
standalone commit, use `docs` if the typo is in doc comments/XML docs (they
are the documentation), `style` otherwise.
