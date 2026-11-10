# Workflow config

`docs/agents/workflow-config.json` remembers the team's decisions about optional dependencies and delegation, so a refresh or audit doesn't ask the same questions again. Write it only after the user approves recording the decisions, and show its content first.

It holds **project decisions only**: what this team uses or chose not to use. Never write machine-specific facts (absolute paths, installed versions, which machine has what), credentials, tokens or account names. Each developer's machine is inventoried fresh on every run.

## Shape

```json
{
  "version": 1,
  "dependencies": {
    "matt-pocock-skills": { "decision": "declined", "date": "2026-11-10", "fallback": ["F1", "F2", "F3", "F4", "F5", "F8"] },
    "react-doctor": { "decision": "declined", "date": "2026-11-10", "fallback": "F9" },
    "guard-skills": { "decision": "installed", "date": "2026-11-10", "components": ["clean-code-guard", "test-guard"], "declinedComponents": ["docs-guard"], "fallback": "F6" },
    "dotnet-skills": { "decision": "pending", "date": "2026-11-10", "components": ["dotnet-test"], "fallback": "F10" }
  },
  "delegation": { "mode": "B" }
}
```

- **Keys** under `dependencies` are the dependency `id`s from the inventory (`matt-pocock-skills`, `guard-skills`, `bravo6dev-skills`, `delegate-skills`, `dotnet-skills`, `dotnet-claude-kit`, `react-doctor`).
- **`decision`:**
  - `installed`: the team uses it.
  - `pending`: approved, waiting for a step only the user can do (a slash command, a restart, signing in).
  - `declined`: use the fallback.
  - `failed`: an approved install failed; the fallback is in use.
  - `deferred`: ask again next time.
- **`components`:** the subset chosen. **`declinedComponents`:** the subset the user turned down.
- **`fallback`:** the step procedure (or list of procedures) used for whatever isn't installed: `F1`–`F11`.
- **`delegation.mode`:** `A` (with `implementer`, the delegate skill name), `B` or `C`.

## Using it

- The inventory returns each dependency's `previousDecision`.
- **Declined:** don't recommend it again on refresh or audit. Mention it once in the findings ("previously declined on <date>; using F9"). Raise it again only if the user asks, or if something it depends on changed: a new stack, or a newly supported agent.
- **Installed** but now missing on this machine: report it as missing *on this machine* and offer the install. That isn't a workflow change.
- **Pending:** remind the user of the step they still have to do. If the inventory now shows it, propose changing the decision to `installed`.
- **Failed or deferred:** offer it again, with the earlier error if one was recorded in the report.
- **Audit:** a declined dependency with its fallback in place is compliant. Report missing optional enhancements separately, as information.
- If the file is invalid JSON (`workflowConfig.valid: false`), report it and don't overwrite it without approval.
