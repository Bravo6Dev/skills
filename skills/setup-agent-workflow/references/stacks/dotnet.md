# Stack: .NET

Detected by `*.sln`, `*.slnx`, `*.csproj`, `*.fsproj` or `*.vbproj` in the inventory.

## Gate commands

Take the real commands from the README, then CI, in that order. Only when neither has them, propose these and mark them **not run**:

```bash
dotnet restore <solution>
dotnet format <solution> --verify-no-changes --no-restore
dotnet build <solution> --configuration Release --no-restore
dotnet test <test command for the runner in use>
```

After the Release build gate, pass `--no-build --configuration Release` to `dotnet test`, so the tests run against that build instead of rebuilding in Debug.

Check the test runner before writing the test command. When `global.json` opts `dotnet test` into Microsoft Testing Platform (`"test": { "runner": "Microsoft.Testing.Platform" }`, .NET 10 SDK+), the form is `dotnet test --solution <solution> ...`. Otherwise `dotnet test` runs in VSTest mode and the form is `dotnet test <solution> ...`, even when a project file sets `UseMicrosoftTestingPlatformRunner`. If the `dotnet-test:run-tests` skill is installed, use it to confirm.

**New project:** no solution exists yet, so write the commands with `<solution>` as a placeholder, mark them **not run**, and note that the first implementation ticket fills in the name and confirms the test runner.

**Quiet variants for delegated runs:** `dotnet format <solution> --no-restore` first (it applies the automatic fixes; naming, and diagnostics with no automatic fix, stay), then `dotnet format <solution> --verify-no-changes --no-restore` and `dotnet build <solution> -c Release --no-restore -v q -clp:ErrorsOnly`. When the tests use Testcontainers, note that they need Docker, which a sandboxed implementer may not reach.

## Skills

- Slices: `vertical-slice-feature` for slice folders co-located in the API project (`Api/Features/<Area>/<UseCase>/`, typically FastEndpoints), `add-feature` for split-layer Clean Architecture (MediatR handlers in `Application/Features/<Feature>/<UseCase>/`, ErrorOr, Carter modules in the Web API project), `vertical-slice-architecture` only to set up a new foundation. Name the one that matches the code. If none matches, describe the nearest-feature procedure (F5 in step-procedures.md) instead.
- References, named in the instruction file of the agent that has them (`CLAUDE.md` for Claude Code plugins; `AGENTS.md` **Skills by step** only for a team without Claude Code whose agents all have the plugin, confirmed by the user because the inventory can't see Codex or Copilot plugins): `dotnet-claude-kit:*` (Claude Code only) and `dotnet-*:*` plugin skills (`ef-core`, `authentication`, `openapi`, `testing`, `serilog`, `security-scan`, `dotnet-test:run-tests`, `dotnet-data:optimizing-ef-core-queries`, …) "applied inside <ADR/architecture doc>". Where they suggest a different pattern, the project's ADRs and architecture doc win.

## Candidate conventions

Rules that need judgment, in the form a .NET project's `AGENTS.md` can use. **Include a rule only when the code already follows it or the user approves adding it.** Replace every path and name with the project's real ones. Leave out rules for libraries the project doesn't use.

First, the enforced line: what `.editorconfig`, analyzers and `TreatWarningsAsErrors` already check, and that `dotnet format <solution>` applies the automatic fixes (not naming).

- **Aggregates.** A root per consistency boundary; invariants enforced through domain operations; children created and changed through the root; cross-aggregate uniqueness enforced in the database.
- **Relationships.** Navigation properties; track a new graph through its root; let EF Core fix up foreign keys.
- **Unit of work.** One `SaveChangesAsync()` per atomic change when possible; an explicit transaction only when a guarantee spans queries, locks or several saves.
- **Indexes.** Which indexes are allowed without a spec (primary keys, uniqueness that enforces a rule) and when performance indexes are reviewed.
- **Use-case names.** A slice folder and its files are named `<Verb><Noun>`, with the verb table (`List`, `Get`, `Create`, `Update`, `Delete`, `Upsert`, or the business verb from the glossary) and the file pattern (`Features/<Area>/<UseCase>/<UseCase>Endpoint.cs`, `…Request.cs`, `…Handler.cs`). That pattern is the co-located layout; a split-layer project in the `add-feature` style names `Application/Features/<Feature>/<UseCase>/` folders holding the command or query, its handler and validator. Write the pattern the code shows.
- **Async suffix.** Every method returning `Task`/`ValueTask` ends in `Async`, except overrides, interface implementations that keep the framework's name, and test methods named as sentences.
- **Unbraced statements.** When braces may be omitted, if ever.
- **Vertical LINQ.** One significant call per line in multi-step query chains, with a short example.
- **Blank lines.** Where one blank line separates logical blocks.
- **`ConfigureAwait`.** Not called in ASP.NET Core application code.
- **Comments explain why.** No comments that restate code, label sections or narrate changes.
- **Registration chains.** Fluent `services.AddX().AddY()` / `app.UseX().UseY()`, one call per line.
- **Settings.** How configuration binds (the options class and section layout), how settings are validated at startup, where secrets come from per environment.
- **Error codes and messages.** Where error-code constants live, their format, and every localized-message resource that must change in the same commit.
- **Validation.** Where validators live, and that input is validated once, in the pipeline.
- **Pagination.** The shared request/response types and the extension that applies paging; no hand-written `Skip`/`Take`.
- **Access.** The authorization policies every endpoint must choose from, how the caller's identity is bound, and that handlers still check ownership.
- **Logging.** What is already logged centrally, and how sensitive request properties are masked.

To source a rule, read two or three existing slices end to end and the shared infrastructure they call. Write the rule the code shows, not the one on this list.

- When the architecture doc already states a rule, `AGENTS.md` points to it in one line instead of restating it.
- Example names in a rule (`ListOrders`) may use glossary terms even where no such slice exists yet. Never use terms from another project.
- In a new project, write no rules here. They come from ADR-0001 and the first slices.
