# Endpoint Templates

One file per use case in `{WebProject}/Endpoints/{Feature}/{UseCase}.cs`: a `static class` with a single `HandleAsync` method. Unlike the handler, **this is not auto-discovered** — after creating the file you still add one line inside the feature's `{Feature}Module.cs` (a `CarterModule`) to map the route.

## Command with response body (POST → 200 + value)

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
            .Produces<ApiResponse<Unit>>(StatusCodes.Status204NoContent)
            .Produces<ApiResponse<Unit>>(StatusCodes.Status401Unauthorized)
            .Produces<ApiResponse<Unit>>(StatusCodes.Status404NotFound)
            .Produces<ApiResponse<Unit>>(StatusCodes.Status500InternalServerError);

        group.MapGet("/overdue", GetOverdue.HandleAsync)
            .MapToApiVersion(new Asp.Versioning.ApiVersion(1, 0))
            .WithName("GetOverdueTodos")
            .WithSummary("List overdue todos")
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

The error message comes from `error.Description` if set, otherwise `IErrorMessageProvider.GetErrorMessage(error.Code)` (for localized messages — see `VoltyApi/Resources/Error.*.resx`-style resource files if this template has them).

## Rules

- Routes are lowercase, plural, no leading slash inside the group: `""`/`"/"`, `"/{id:guid}/archive"`. Route constraints (`:guid`, `:int`) on all typed parameters.
- The `[FromBody]` request *is* the command/query when the shape matches 1:1; only add a separate `Request` class when the wire shape differs (e.g. enums arrive as `int` and need casting).
- Resolve `IMediator` and `IErrorMessageProvider` as `HandleAsync` parameters — both come from DI automatically for minimal API delegates.
- Pull the caller's id with `httpContext.User.GetUserId()` (an extension on `ClaimsPrincipal`) rather than trusting a client-supplied `userId` field in the request body.
- Always end the route registration with `.RequireAuthorization()` (or `.AllowAnonymous()` for pre-auth flows like registration/login) and give it `.WithName()`/`.WithSummary()`/`.WithDescription()` plus one `.Produces<ApiResponse<T>>(...)` per realistic status code — this is what feeds the OpenAPI docs.
- Failures never get hand-rolled responses — `MatchResult` is the only place HTTP status gets decided.
