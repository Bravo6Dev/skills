---
name: add-feature
description: Scaffold a complete Clean Architecture feature slice — command or query, MediatR handler, FluentValidation validator, Carter minimal-API endpoint, and tests (unit, validator, integration). Use when the user asks to add a feature, use case, command, query, or endpoint to a MediatR + ErrorOr .NET Clean Architecture template.
argument-hint: <feature description, e.g. "archive a todo item" or "get todos due this week">
---

# Add a Feature (Vertical Slice)

Scaffold a full use case following this template's conventions: an Application-layer use case dispatched through **MediatR**, returning **ErrorOr**, exposed through a **Carter** minimal-API endpoint, and covered by MSTest unit + integration tests.

This is a MediatR-based template, not the "custom `ICommand`/`IQuery` + `Result`" style some Clean Architecture starters use. If you've seen that other style before, see [Deliberate differences](#deliberate-differences-from-the-icommandiqueryresult-style-template) below so you don't "fix" this template to match it.

## Workflow

1. **Classify the use case.** A state change is a **command**; a read is a **query**. Derive names from the existing pattern: use case verb + entity, e.g. `ArchiveTodoCommand`, `GetOverdueTodosQuery`.
2. **Check the Domain layer.** If the entity or its `{Entity}Errors` class doesn't exist, add it first (see the `add-entity` skill).
3. **Create the Application slice** in `Application/Features/{Feature}/{UseCase}/` — request (command/query), handler, validator (commands only), response DTO (queries only). Templates: [references/command-slice.md](references/command-slice.md) and [references/query-slice.md](references/query-slice.md).
4. **Create the endpoint** in `{WebProject}/Endpoints/{Feature}/{UseCase}.cs`, then **wire the route by hand** into that feature's `{Feature}Module.cs` (a `CarterModule`). Template: [references/endpoint.md](references/endpoint.md).
5. **Write tests** — handler unit test, validator test, and a handler-level integration test. Templates: [references/tests.md](references/tests.md).
6. **Verify:** `dotnet build` then `dotnet test`.

## Non-negotiable conventions

- **Folder = use case.** One folder per use case under `Application/Features/{Feature}/` (e.g. `Todos/Archive/`), containing all files for that slice.
- **Requests are `sealed record`s** implementing `IRequest<ErrorOr<TResponse>>` (or `IRequest<ErrorOr<Unit>>` for a void command). Positional record for few parameters; a record with `init`-only properties when there are many or named construction reads better.
- **Handlers are `public sealed class`** with a primary constructor, implementing `IRequestHandler<TCommand, ErrorOr<TResponse>>` / `IRequestHandler<TQuery, ErrorOr<TResponse>>`.
- **No manual DI registration for handlers or validators.** Both are discovered by assembly scan — `AddMediatR(cfg => cfg.RegisterServicesFromAssembly(...))` and `AddValidatorsFromAssembly(...)` in `Application/DependencyInjection.cs`. Never touch that file for a new slice. (Endpoint *routes* are the one thing that isn't auto-discovered — see step 4.)
- **Return `ErrorOr<T>` / `ErrorOr<Unit>`, never throw** for expected failures. Errors come from static properties on a `{Entity}Errors` class in `Domain/Errors/`, each backed by a matching constant on a nested `Codes` class (validators reference `Codes.X`, handlers return `{Entity}Errors.X`).
- **Validation lives in a `{Command}Validator`** (FluentValidation, `AbstractValidator<TCommand>`, rules end with `.WithErrorCode({Entity}Errors.Codes.X)`). It runs automatically via the open-generic `ValidationBehavior<,>` MediatR pipeline behavior — the handler never validates input shape itself. Queries have no validators.
- **Data access via `IAppDbContext`** (`Application.Interface.Data`) — never reference Infrastructure from Application.
- **User identity is resolved in the endpoint, not the handler.** Pull it from claims with `httpContext.User.GetUserId()` and pass it as a plain field on the command/query (e.g. `UserId`). The handler then filters or compares against that field directly — there is no injected "current user" service to mock.
- **Queries project directly to a `{X}Response` DTO** — never return domain entities. A DTO lives in its own use-case folder by default; promote it to `Features/{Feature}/Common/` only once a second slice in the same feature genuinely needs the same shape. Don't share a DTO across features.
- **Endpoints** are a `static class` with one `HandleAsync` method, resolving `IMediator` and `IErrorMessageProvider` as parameters, ending with `return result.MatchResult(messages);`. Every route is mapped explicitly inside the feature's `CarterModule` with full metadata (`.WithName`, `.WithSummary`, `.WithDescription`, `.Produces<ApiResponse<T>>(statusCode)` per realistic status, `.RequireAuthorization()` or `.AllowAnonymous()`, API version).

## Naming reference

| Artifact | Pattern | Example |
|---|---|---|
| Command | `{Verb}{Entity}Command` | `ArchiveTodoCommand` |
| Query | `Get{X}Query` | `GetOverdueTodosQuery` |
| Handler | `{Command/Query}Handler` | `ArchiveTodoCommandHandler` |
| Validator | `{Command}Validator` | `ArchiveTodoCommandValidator` |
| Response | `{X}Response` | `TodoResponse` |
| Errors | `{Entity}Errors` in `Domain/Errors/` | `TodoErrors.NotFound` / `TodoErrors.Codes.NotFound` |
| Endpoint | `{UseCase}.cs` in `Endpoints/{Feature}/` | `Endpoints/Todos/Archive.cs` |
| Route wiring | `{Feature}Module.cs` (`CarterModule`) | `TodosModule.cs` |
| Unit test | `{Handler}Tests` | `ArchiveTodoCommandHandlerTests` |
| Test method | `MethodName_StateUnderTest_ExpectedBehavior` | `Handle_TodoDoesNotExist_ReturnsNotFound` |

## Optional, opt-in improvements (not yet adopted in this codebase)

These come from the wider Clean-Architecture-in-.NET playbook and are genuinely good ideas, but nothing in this template uses them today — don't add them speculatively for a single new slice:

- **`HybridCache` for hot reads.** Wrap a demonstrably expensive query in `HybridCache.GetOrCreateAsync`, keyed via a `{Feature}CacheKeys` static class, and invalidate that key in every command that mutates the cached data. Only worth it once a specific query is known to be hot — introducing a cache changes the correctness story (staleness) so it's a deliberate, per-query decision, not a default.
- **MediatR licensing.** MediatR moved to a commercial license from v13 for commercial use past its free tier. If this template is used in a revenue-generating product, check current licensing terms for the installed `MediatR` version before scaling usage further — that's a business decision, not something this skill should decide for you.

## Deliberate differences from the ICommand/IQuery/Result-style template

If you know the popular "custom abstractions, no MediatR" Clean Architecture template, this one intentionally differs in three ways — don't "correct" the code below to match that template:

1. **MediatR + ErrorOr instead of custom `ICommand`/`IQuery`/`Result`.** Same job (dispatch a request to one handler, return success-or-error without throwing), different library. `ErrorOr<T>.Match(...)` plays the role `Result<T>.Match(...)` would.
2. **Endpoint routes are hand-wired, not auto-discovered.** Carter modules themselves are found by assembly scan, but each `group.MapPost(...)`/`MapGet(...)` call inside a module's `AddRoutes` is explicit. Forgetting to add the line is the most common way a new endpoint silently 404s.
3. **No injected "current user" abstraction.** The endpoint reads the claim and hands the id to the handler as data. This keeps handlers trivially testable (construct the command with any id) at the cost of one extra line per endpoint.
