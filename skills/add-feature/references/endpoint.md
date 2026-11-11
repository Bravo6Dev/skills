# Endpoint Templates

One file per use case in `{WebProject}/Endpoints/{Feature}/{UseCase}.cs`: a `static class` with a single `HandleAsync` method. Unlike the handler, **this is not auto-discovered** — after creating the file you still add one line inside the feature's `{Feature}Module.cs` (a `CarterModule`) to map the route.

## Command with response body (POST → 200 + value)

This template answers a create with `200` and the new id in the body, not `201 Created` with a `Location` header. Follow the existing endpoints; switch to 201 only if the user asks.

```csharp
using Application.Features.Todos.Create;
using Application.Interfaces.Services;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace WebApi.Endpoints.Todos;

internal static class Create
{
    public static async Task<Results<Ok<ApiResponse<Guid>>, BadRequest<ApiResponse<Guid>>, NotFound<ApiResponse<Guid>>, Conflict<ApiResponse<Guid>>, JsonHttpResult<ApiResponse<Guid>>, NoContent>> HandleAsync(
        [FromBody] CreateTodoCommand command,
        HttpContext httpContext,
        IMediator mediator,
        IErrorMessageProvider messages,
        CancellationToken cancellationToken)
    {
        var result = await mediator.Send(command with { UserId = httpContext.User.GetUserId() }, cancellationToken);
        return result.MatchResult(messages);
    }
}
```

## Void command from route parameter (PUT/DELETE → 204)

`PUT` and `DELETE` are idempotent methods: a retried request must not change state a second time. The Archive sample meets that — a second archive changes nothing — but it answers the retry with `409`, so a client that retries after a lost response gets an error for an action that succeeded. Whether a retry should also return success is a design choice: return success when the state is already what was asked for, keep the `409`, or expose the action as `POST`. Follow what the project's existing endpoints do, and ask the user if there is no precedent.

```csharp
using Application.Features.Todos.Archive;
using Application.Interfaces.Services;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;

namespace WebApi.Endpoints.Todos;

internal static class Archive
{
    public static async Task<Results<NoContent, BadRequest<ApiResponse<Unit>>, NotFound<ApiResponse<Unit>>, Conflict<ApiResponse<Unit>>, JsonHttpResult<ApiResponse<Unit>>>> HandleAsync(
        Guid id,
        HttpContext httpContext,
        IMediator mediator,
        IErrorMessageProvider messages,
        CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new ArchiveTodoCommand(id, httpContext.User.GetUserId()), cancellationToken);
        return result.MatchResult(messages);
    }
}
```

## Query (GET → 200)

```csharp
using Application.Features.Todos.GetOverdue;
using Application.Interfaces.Services;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;

namespace WebApi.Endpoints.Todos;

internal static class GetOverdue
{
    public static async Task<Results<Ok<ApiResponse<List<TodoResponse>>>, BadRequest<ApiResponse<List<TodoResponse>>>, NotFound<ApiResponse<List<TodoResponse>>>, Conflict<ApiResponse<List<TodoResponse>>>, JsonHttpResult<ApiResponse<List<TodoResponse>>>, NoContent>> HandleAsync(
        HttpContext httpContext,
        IMediator mediator,
        IErrorMessageProvider messages,
        CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetOverdueTodosQuery(httpContext.User.GetUserId()), cancellationToken);
        return result.MatchResult(messages);
    }
}
```

## Wiring the route into the feature's Carter module

Carter modules themselves are auto-discovered by `builder.Services.AddCarter()` / `app.MapCarter()`, but every route inside `AddRoutes` is explicit — add one `group.MapX(...)` call per endpoint:

```csharp
using Carter;

namespace WebApi.Endpoints.Todos;

public sealed class TodosModule : CarterModule
{
    public override void AddRoutes(IEndpointRouteBuilder app)
    {
        var versionSet = app.NewApiVersionSet()
            .HasApiVersion(new Asp.Versioning.ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        var group = app.MapGroup("api/v{version:apiVersion}/todos")
            .WithApiVersionSet(versionSet)
            .WithGroupName(OpenApiExtensions.CommonApiVersion)
            .WithTags("Todos")
            .RequireAuthorization();

        group.MapPost("/", Create.HandleAsync)
            .MapToApiVersion(new Asp.Versioning.ApiVersion(1, 0))
            .WithName("CreateTodo")
            .WithSummary("Create a todo item")
            .WithDescription("Creates a new todo item for the current user.")
            .Produces<ApiResponse<Guid>>(StatusCodes.Status200OK)
            .Produces<ApiResponse<Guid>>(StatusCodes.Status400BadRequest)
            .Produces<ApiResponse<Guid>>(StatusCodes.Status401Unauthorized)
            .Produces<ApiResponse<Guid>>(StatusCodes.Status500InternalServerError);

        group.MapPut("/{id:guid}/archive", Archive.HandleAsync)
            .MapToApiVersion(new Asp.Versioning.ApiVersion(1, 0))
            .WithName("ArchiveTodo")
            .WithSummary("Archive a todo item")
            .WithDescription("Archives a todo item that belongs to the current user.")
            .Produces(StatusCodes.Status204NoContent)
            .Produces<ApiResponse<Unit>>(StatusCodes.Status401Unauthorized)
            .Produces<ApiResponse<Unit>>(StatusCodes.Status404NotFound)
            .Produces<ApiResponse<Unit>>(StatusCodes.Status409Conflict)
            .Produces<ApiResponse<Unit>>(StatusCodes.Status500InternalServerError);

        group.MapGet("/overdue", GetOverdue.HandleAsync)
            .MapToApiVersion(new Asp.Versioning.ApiVersion(1, 0))
            .WithName("GetOverdueTodos")
            .WithSummary("List overdue todos")
            .WithDescription("Lists the current user's incomplete todo items whose due date has passed.")
            .Produces<ApiResponse<List<TodoResponse>>>(StatusCodes.Status200OK)
            .Produces<ApiResponse<List<TodoResponse>>>(StatusCodes.Status401Unauthorized)
            .Produces<ApiResponse<List<TodoResponse>>>(StatusCodes.Status500InternalServerError);
    }
}
```

If `{Feature}Module.cs` already exists, add the new `group.MapX(...)` call to it — don't create a second module for the same feature.

## `ApiResponse<T>` and `MatchResult`

Every response body is wrapped in `ApiResponse<T>` (`{ bool Success, T? Data, string? Error }`), and `result.MatchResult(messages)` (an `ErrorOr<T>` extension) maps success to `200 Ok`/`204 NoContent` and translates the first `Error` by its `ErrorType`:

| `ErrorType` | HTTP status |
|---|---|
| `Validation` / `Failure` | 400 Bad Request |
| `Unauthorized` | 401 |
| `Forbidden` | 403 |
| `NotFound` | 404 |
| `Conflict` | 409 |
| anything else | 500 |

The error message comes from `error.Description` if set, otherwise `IErrorMessageProvider.GetErrorMessage(error.Code)` (for localized messages — see `{WebProject}/Resources/Error.*.resx`-style resource files if this template has them).

## Rules

- Routes are lowercase, plural, and relative to the group's prefix (the group already carries `api/v{version}/todos`): `"/"`, `"/{id:guid}/archive"`. Route constraints (`:guid`, `:int`) on all typed parameters.
- The `[FromBody]` request *is* the command when the shape matches 1:1; only add a separate `Request` class when the wire shape differs (e.g. enums arrive as `int` and need casting). A `GET` has no body: build the query in the endpoint from route and query-string parameters (bound individually, or with `[AsParameters]` on a small request type) plus the caller's id.
- Over-posting: every server-set property on a body-bound command (`UserId`, a tenant id, a role) can also be sent by the client. The endpoint must overwrite each one before dispatch (`command with { UserId = httpContext.User.GetUserId() }`), and nothing fails if a new endpoint forgets. Where the project allows it, make it impossible to forget: put `[JsonIgnore]` on the server-set property, or bind a separate `Request` type that doesn't have it.
- Resolve `IMediator` and `IErrorMessageProvider` as `HandleAsync` parameters — both come from DI automatically for minimal API delegates.
- Pull the caller's id with `httpContext.User.GetUserId()` (an extension on `ClaimsPrincipal`) rather than trusting a client-supplied `userId` field in the request body.
- Authorization is on by default at the group: `.RequireAuthorization()` sits on `MapGroup(...)` as in the module above, and every route in the group inherits it. When you create a new module, put it on the group. Add a per-route `.RequireAuthorization("PolicyName")` when a route needs more than "any authenticated user" (a role, a scope, an admin-only action), and `.AllowAnonymous()` only for pre-auth flows like registration/login.
- Give every route `.WithName()`/`.WithSummary()`/`.WithDescription()` plus one `.Produces<ApiResponse<T>>(...)` per status code the route can really return — including each error type its handler returns (e.g. `409` for a `Conflict` error) — this is what feeds the OpenAPI docs. A `204` has no body, so declare it as `.Produces(StatusCodes.Status204NoContent)` with no response type.
- The `Results<...>` return type is whatever `MatchResult` returns for that response shape — copy it from an existing endpoint of the same kind rather than editing the union by hand. Its members also describe themselves to OpenAPI, so the generated document can list a status a given route never returns (a `NoContent` on a create, a `Conflict` on a list); the `.Produces(...)` lines are the ones you maintain.
- Failures never get hand-rolled responses — `MatchResult` is the only place HTTP status gets decided.
