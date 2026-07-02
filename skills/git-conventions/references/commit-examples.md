# Commit Message Examples

Worked examples for each `<type>`, plus a couple of borderline calls.

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

## test

Input: Added unit tests for the SERIALIZABLE transaction path in appointment booking
Output: `test(scheduling): cover serializable transaction path in booking`

## chore

Input: Bumped EF Core and updated the lock file
Output: `chore(deps): bump EF Core to latest patch version`

---

## Borderline cases

**A new database migration that adds a column for an existing feature.**
If the migration exists to support a new feature landing in the same PR, fold
it into that `feat` commit rather than splitting it out — reviewers want to
see schema and code together. If it's a standalone schema change with no
accompanying feature code (e.g. an index added purely for performance), use
`chore(db): add index on appointments.doctor_id`.

**Renaming a file with no other changes.**
This is `refactor`, not `chore` — it's a code-organization change, not a
tooling/build change. `refactor(scheduling): rename AppointmentSvc to
AppointmentService`.

**Fixing a typo in a comment.**
Small enough that `style` in the same commit as other related work is fine;
if it's a standalone commit, use `docs` if the typo is in doc comments/XML
docs, `style` otherwise.
