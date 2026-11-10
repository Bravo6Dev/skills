# Greenfield docs

Skeletons for a new project, written only after the user approves creating them. They give the generated `AGENTS.md` real files to route to. Fill what the interview settled; mark everything else **Open**. Never invent business rules.

Ask for a short decision-ID prefix (default: the project name's first three letters in upper case, e.g. `ACM-01`).

## `docs/project-reference.md`

```markdown
# <Project> — Project reference

> **Version:** 0.1 · **As of:** <YYYY-MM-DD> · **Status:** Draft; business authority once approved.

## 1. Product

<One paragraph: who it serves, the problem, the first workflow.>

## 2. Users and roles

| Role | What they do |
|---|---|

## 3. Scope

**In scope (first release):** …
**Out of scope:** …

## 4. Business rules

<Numbered rules, each traceable to a decision in §9. Empty until agreed.>

## 9. Decision register

| ID | Decision | Status | Date |
|---|---|---|---|
| <PFX>-01 | <question or decision> | Agreed / Open / Deferred | <date> |

## 10. Glossary

| Term | Meaning | Avoid |
|---|---|---|
```

Keep the section numbers for the decision register (§9) and glossary (§10) so other docs can cite them; add sections 5–8 as the product needs them.

## `docs/architecture.md`

```markdown
# <Project> — Architecture

> **Status:** Draft until ADR-0001 is accepted.

## Projects and references
## Feature folder contract
## Errors
## Persistence
## Tests
```

Write only headings plus anything ADR-0001 already fixes. The first implementation tickets fill the rest.

## `docs/adr/README.md`

```markdown
# Architecture decision records

| ADR | Title | Status |
|---|---|---|
| [0001](0001-stack-and-architecture.md) | Stack and architecture | proposed |

## Rules

- One decision per ADR, numbered in order, never renumbered.
- `status`: proposed → accepted, or superseded by a later ADR.
- Write an ADR for decisions that are hard to reverse: stack, storage, authentication, external providers.

## Template

    # NNNN. <Title>
    - status: proposed
    - date: YYYY-MM-DD
    ## Context
    ## Decision
    ## Consequences
```

## `docs/adr/0001-stack-and-architecture.md`

The stack the user named in the interview, `status: proposed`. Context: why this stack; Decision: runtime, framework, database, test stack, deployable units; Consequences: what it rules out. If the user hasn't chosen a stack, don't write this ADR. Record the stack as Open in the decision register instead.
