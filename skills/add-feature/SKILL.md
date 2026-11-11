---
name: add-feature
description: Scaffold a complete use case in a split-layer Clean Architecture .NET solution — command or query, MediatR handler, FluentValidation validator, Carter minimal-API endpoint, and MSTest tests (unit, validator, integration). Use when the user asks to add a feature, use case, command, query, or endpoint and the solution has separate Application, Domain, Infrastructure and Web API projects, use cases under `Application/Features/{Feature}/{UseCase}/`, MediatR handlers returning ErrorOr, and Carter modules. Not for co-located vertical slices (one `Features/Area/UseCase/` folder inside the API project, FastEndpoints) — use `vertical-slice-feature` for those.
argument-hint: <feature description, e.g. "archive a todo item" or "get todos due this week">
---

# Add a Feature (Clean Architecture use-case slice)

Scaffold a full use case following this template's conventions: an Application-layer use case dispatched through **MediatR**, returning **ErrorOr**, exposed through a **Carter** minimal-API endpoint, and covered by MSTest unit + integration tests.

This is a MediatR-based template, not the "custom `ICommand`/`IQuery` + `Result`" style some Clean Architecture starters use. If you've seen that other style before, see [Deliberate differences](#deliberate-differences-from-the-icommandiqueryresult-style-template) below so you don't "fix" this template to match it.

"Slice" here means one use case's files, which are split across the Application, Web API and test projects. It is not the co-located vertical-slice layout (endpoint, handler and validator together in one folder of the API project) — that layout is covered by the `vertical-slice-feature` skill.

## Prerequisites

- **C# 12 / .NET 8 or later.** The templates use primary constructors and collection expressions (`[]`).
- **MediatR licensing.** MediatR moved to a commercial license from v13 for commercial use past its free tier. If this template is used in a revenue-generating product, check current licensing terms for the installed `MediatR` version before scaling usage further — that's a business decision, not something this skill should decide for you.

## Before you start: confirm the project matches

The templates call helpers that this skill does not create. Search the solution for each of these before writing any code:

- Folder layout: `Application/Features/{Feature}/{UseCase}/`, `Domain/Errors/`, `{WebProject}/Endpoints/{Feature}/`, a test project with `Features/` and `IntegrationTests/`.
- Application: `IAppDbContext`, the `ValidationBehavior<,>` pipeline behavior, `IErrorMessageProvider`.
- Web API: `ApiResponse<T>`, the `MatchResult` extension on `ErrorOr<T>`, the `GetUserId()` extension on `ClaimsPrincipal`, `OpenApiExtensions.CommonApiVersion`, Carter modules (`{Feature}Module : CarterModule`).
- Tests: MSTest, `TestDbContextFactory`, `IntegrationTestDbContextFactory`.

If a name differs slightly (a renamed helper, another namespace), use the project's name. If several are missing — no MediatR/ErrorOr, no Carter, no `MatchResult` — stop and tell the user this skill does not match the project instead of generating code against helpers that don't exist. For a project with co-located slices, point to `vertical-slice-feature`.

## Workflow

1. **Classify the use case.** A state change is a **command**; a read is a **query**. Derive names from the existing pattern: use case verb + entity, e.g. `ArchiveTodoCommand`, `GetOverdueTodosQuery`.
2. **Check the Domain layer and the schema.** If the entity or its `{Entity}Errors` class doesn't exist, add it first. A new entity, or a new column on an existing one, also needs the `DbSet`, the EF configuration and a migration — see [Domain additions](references/command-slice.md#domain-additions-if-needed). Generate and review the migration; don't apply it to a shared database unless the user asks.
3. **Create the Application slice** in `Application/Features/{Feature}/{UseCase}/` — request (command/query), handler, validator (every command, and any query that takes client input beyond the caller's id), response DTO (queries only). Templates: [references/command-slice.md](references/command-slice.md) and [references/query-slice.md](references/query-slice.md).
4. **Create the endpoint** in `{WebProject}/Endpoints/{Feature}/{UseCase}.cs`, then **wire the route by hand** into that feature's `{Feature}Module.cs` (a `CarterModule`). Template: [references/endpoint.md](references/endpoint.md).
5. **Write tests** — handler unit test, validator test (when the slice has a validator), and a handler-level integration test. These call the handler directly, so they don't cover the route, authorization or binding — see [Endpoint coverage](references/tests.md#endpoint-http-level-coverage). Templates: [references/tests.md](references/tests.md).
6. **Verify:** `dotnet build` then `dotnet test`. The integration tests need a SQL Server (LocalDB or `TEST_SQL_CONNECTION`); if neither is available, run the rest and report the integration tests as written but not run — see [Run](references/tests.md#run).

## Non-negotiable conventions

- **Folder = use case.** One folder per use case under `Application/Features/{Feature}/` (e.g. `Todos/Archive/`), containing all files for that slice.
- **Requests are `sealed record`s** implementing `IRequest<ErrorOr<TResponse>>` (or `IRequest<ErrorOr<Unit>>` for a void command). Positional record for few parameters; a record with `init`-only properties when there are many or named construction reads better.
- **Handlers are `public sealed class`** with a primary constructor, implementing `IRequestHandler<TCommand, ErrorOr<TResponse>>` / `IRequestHandler<TQuery, ErrorOr<TResponse>>`.
- **No manual DI registration for handlers or validators.** Both are discovered by assembly scan — `AddMediatR(cfg => cfg.RegisterServicesFromAssembly(...))` and `AddValidatorsFromAssembly(...)` in `Application/DependencyInjection.cs`. Never touch that file for a new slice. (Endpoint *routes* are the one thing that isn't auto-discovered — see step 4.)
- **Return `ErrorOr<T>` / `ErrorOr<Unit>`, never throw** for expected failures. Errors come from static properties on a `{Entity}Errors` class in `Domain/Errors/`, each backed by a matching constant on a nested `Codes` class (validators reference `Codes.X`, handlers return `{Entity}Errors.X`).
- **Validation lives in a `{Command}Validator`** (FluentValidation, `AbstractValidator<TCommand>`). Every validator in a rule chain gets its own `.WithErrorCode({Entity}Errors.Codes.X)` — `.WithErrorCode` applies only to the validator immediately before it, so `NotEmpty().MaximumLength(255).WithErrorCode(X)` leaves `NotEmpty` with its default code. It runs automatically via the open-generic `ValidationBehavior<,>` MediatR pipeline behavior — the handler never validates input shape itself. A query whose only input is the caller's id needs no validator; a query that takes client input (ids outside the route constraint, date ranges, search text, page size) gets a `{Query}Validator` the same way.
- **Data access via `IAppDbContext`** (`Application.Interface.Data`) — never reference Infrastructure from Application.
- **User identity is resolved in the endpoint, not the handler.** Pull it from claims with `httpContext.User.GetUserId()` and pass it as a plain field on the command/query (e.g. `UserId`). The handler then filters or compares against that field directly — there is no injected "current user" service to mock. When the command is bound from the request body, the client can also send that field, so the endpoint must always overwrite it — see the rules in [references/endpoint.md](references/endpoint.md#rules).
- **Queries project directly to a `{X}Response` DTO** — never return domain entities. A DTO lives in its own use-case folder by default; promote it to `Features/{Feature}/Common/` only once a second slice in the same feature genuinely needs the same shape. Don't share a DTO across features.
- **Endpoints** are a `static class` with one `HandleAsync` method, resolving `IMediator` and `IErrorMessageProvider` as parameters, ending with `return result.MatchResult(messages);`. Every route is mapped explicitly inside the feature's `CarterModule` with full metadata (`.WithName`, `.WithSummary`, `.WithDescription`, `.Produces<ApiResponse<T>>(statusCode)` per status the route can really return — `.Produces(StatusCodes.Status204NoContent)` with no body type for 204 — and the API version). Authorization is set once on the module's route group with `.RequireAuthorization()`; a route adds its own policy, or `.AllowAnonymous()`, only when it differs from the group.

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

## Optional, opt-in improvement (not yet adopted in this codebase)

This comes from the wider Clean-Architecture-in-.NET playbook and is a genuinely good idea, but nothing in this template uses it today — don't add it speculatively for a single new slice:

- **`HybridCache` for hot reads.** Wrap a demonstrably expensive query in `HybridCache.GetOrCreateAsync`, keyed via a `{Feature}CacheKeys` static class, and invalidate that key in every command that mutates the cached data. Only worth it once a specific query is known to be hot — introducing a cache changes the correctness story (staleness) so it's a deliberate, per-query decision, not a default.

## Deliberate differences from the ICommand/IQuery/Result-style template

If you know the popular "custom abstractions, no MediatR" Clean Architecture template, this one intentionally differs in three ways — don't "correct" the code in the references to match that template:

1. **MediatR + ErrorOr instead of custom `ICommand`/`IQuery`/`Result`.** Same job (dispatch a request to one handler, return success-or-error without throwing), different library. `ErrorOr<T>.Match(...)` plays the role `Result<T>.Match(...)` would.
2. **Endpoint routes are hand-wired, not auto-discovered.** Carter modules themselves are found by assembly scan, but each `group.MapPost(...)`/`MapGet(...)` call inside a module's `AddRoutes` is explicit. Forgetting to add the line is the most common way a new endpoint silently 404s.
3. **No injected "current user" abstraction.** The endpoint reads the claim and hands the id to the handler as data. This keeps handlers trivially testable (construct the command with any id) at the cost of one extra line per endpoint.
