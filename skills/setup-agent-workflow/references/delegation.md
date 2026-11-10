# Delegation

Who writes the code, and how the orchestrating agent stays the reviewer. The delegation section goes in `CLAUDE.md` only. `AGENTS.md` carries just the guard that stops other agents from delegating again because they read it.

## Pick the mode

Read `delegation` in the inventory and the host's own capabilities, then ask the user once.

| Mode | When | What `CLAUDE.md` says |
|---|---|---|
| **A. External implementer** | The user **explicitly asks** for a specific implementer (or `workflowConfig.config.delegation.implementer` names one), its `*-delegate` skill and CLI are available (`delegation.available`), and the user authorizes its use | Claude orchestrates; that implementer executes briefs. If its prerequisite check fails, Claude falls back to B (or C) and says so. Any other `*-delegate` skill needs approval. |
| **B. Native subagents** | The host agent can spawn subagents with a tool it has right now (Claude Code can) | The agent orchestrates and uses its own subagents with the same brief. |
| **C. Direct** | No subagents on this host, the user wants no delegation, or the project is too small for tickets | The agent implements directly. Omit the orchestration section; keep one line saying so. |

**Priority:** A only when explicitly requested and authorized, otherwise B when the host supports native subagents, otherwise C. In a non-interactive run with no explicit request, take B or C.

- **Never pick A because a CLI is installed.** Other agent CLIs usually bill a separate account. `delegation.available` only means a skill and a binary exist; it says nothing about sign-in, cost or the user's intent. Mention available implementers in the findings as information.
- **Native subagents:** the running agent states whether it has a subagent tool now. The inventory can't detect this. Don't claim subagents for a host you can't verify.
- **No recursion:** an implementer or subagent never delegates further. The brief says so, and `AGENTS.md` carries the guard below.
- With several authorized implementers, mention `delegate-setup` for lanes. If `delegation.laneConfig` shows lanes are configured, say "use the configured lanes" instead of naming one CLI.
- For every mode, small changes are done directly without delegation.
- Name the prerequisite check the way the delegate skill states it. For example, `codex-delegate` requires that `codex --version` works.

## Text for `CLAUDE.md` (modes A and B)

Adapt the names, the gate commands and the conventions excerpt to the project. Keep the steps. In mode B, replace step 2 with: "Claude uses its own subagents with this brief and discloses that in the report."

```markdown
## Implementation delegation — Claude orchestrator only

The Claude orchestrator owns the spec and tickets, the implementation brief, independent review and the approved commit. The implementer only executes the brief; it must not re-scope, create tracker items, commit or delegate further.

For each approved spec slice or ticket:

1. **Brief:** goal, current state, included and excluded files, acceptance criteria, the actual gate commands from <the gate location>, and a no-commit instruction. Excerpt the <`AGENTS.md` conventions | architecture doc and ADR rules> the ticket touches (<the two or three that matter most here>); the implementer may not read <that file>.
2. **Implement:** if the `<x>-delegate` skill is installed and `<prerequisite check>` works, Claude may use `<x>-delegate`. Other `*-delegate` skills require approval. If unavailable, Claude may use its own subagents with the same brief and must disclose that fallback.
3. **Review:** independently inspect the diff against the brief and spec, run the gates and the review skills in the Skills table; never rely on implementer claims.
4. **Rework:** send a narrow delta brief; resume the same implementer session when possible.
5. **Land:** report outcomes and unexpected choices. Commit and push only with approval; don't widen scope without approval.

Small changes can be done directly without delegation.

### Keeping delegated runs lean

- **Excerpt, don't point:** put the spec sections, rules and acceptance criteria the ticket needs into the brief; name the few prior-art files worth reading.
- **Quiet gates:** <auto-fix formatter first, then verify-only format, then a quiet build that prints errors only; see the stack reference>. If the implementer's sandbox can't reach <a dependency the tests need, such as Docker>, the orchestrator runs the tests and sends back only the failures.
- **Small slices** that finish in one sitting; review and gate each before the next.
- **Resume, don't restart** an interrupted run, with a short delta brief.

Verify every finding against the code. Don't post, approve, push or merge without explicit approval.
```

Adapting the template:

- **Sandbox clause:** drop it when the tests need nothing outside the implementer's sandbox.
- **Quiet gates:** these are quiet variants of the recorded gates, so they need no verification mark of their own. With no formatter, start the bullet at the build. For package scripts, use `<pm> run --silent <script>` (npm, pnpm and yarn accept `--silent`).
- **Brief:** in a new project with no conventions in `AGENTS.md` yet, the brief excerpts the architecture doc and ADR-0001 instead.

## Guard text for `AGENTS.md` (every mode)

Use the first form when Claude Code is in use and other agents also work in the repo, naming them. Use the second when Claude Code isn't used, or no other agent works here:

```markdown
### Agent-specific workflows

Shared repository instructions don't require implementation delegation. Each coding agent performs its assigned work directly unless the user explicitly authorizes another arrangement. Claude Code-specific skills, orchestration and delegation are in `CLAUDE.md`. <Codex> must not invoke a `*-delegate` skill, launch another agent session, or spawn subagents solely because it read repository instructions.
```

```markdown
### Agent-specific workflows

Each coding agent performs its assigned work directly unless the user explicitly authorizes another arrangement. No agent invokes a `*-delegate` skill, launches another agent session, or spawns subagents solely because it read repository instructions. <Delegation mode for the host, e.g. "Codex implements directly; see `<workflow doc>` §2 D.">
```

## Brief checklist

Use this when Claude writes a brief:

- Goal in one sentence, and why.
- Current state: what exists, and the nearest comparable feature to copy from.
- Files to create or change; files that must not change.
- Acceptance criteria copied from the ticket, not paraphrased.
- The conventions that apply, excerpted.
- Exact gate commands, quiet variants.
- "Do not commit, push, create tracker items or delegate."
- What to report back: files changed, gates run with results, any deviation and its reason.
