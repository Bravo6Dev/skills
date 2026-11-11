# Query Slice Templates

Files go in `Application/Features/{Feature}/{UseCase}/`. Queries are reads: no `SaveChangesAsync`. A query whose only input is the caller's id needs no validator; one that takes client input — a date range, search text, page and page size, an id that isn't already constrained by the route — gets a `{Query}Validator` in the same folder, written like a command validator (see `references/command-slice.md`).

## Query

```csharp
using ErrorOr;
using MediatR;

namespace Application.Features.Todos.GetOverdue;

public sealed record GetOverdueTodosQuery(Guid UserId) : IRequest<ErrorOr<List<TodoResponse>>>;
```

With more parameters, keep it a positional record where it stays readable, or switch to `init`-property style (see `references/command-slice.md`) once it grows past two or three fields:

```csharp
public sealed record GetTodoByIdQuery(Guid UserId, Guid TodoItemId) : IRequest<ErrorOr<TodoResponse>>;
```

## Response DTO

Lives next to the query by default. Flat, serialization-friendly, never a domain entity.

```csharp
namespace Application.Features.Todos.GetOverdue;

public sealed class TodoResponse
{
    public Guid Id { get; init; }
    public string Description { get; init; } = string.Empty;
    public DateTime? DueDate { get; init; }
    public List<string> Labels { get; init; } = [];
    public bool IsCompleted { get; init; }
    public DateTime CreatedAt { get; init; }
}
```

Only move a DTO into `Features/{Feature}/Common/` once a *second* use case in the same feature needs the identical shape (e.g. `Application/Features/Todos/Common/TodoResponse.cs` once `GetTodoByIdQuery` above returns the same `TodoResponse` as `GetOverdueTodosQuery`). Don't pre-share a DTO across features "just in case" — duplicate it until two slices actually need the same shape.

## Handler

Scope to the caller (`request.UserId`, filled in by the endpoint from claims — see SKILL.md), project with `.Select` straight into the DTO:

```csharp
using Application.Interface.Data;
using ErrorOr;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Todos.GetOverdue;

public sealed class GetOverdueTodosQueryHandler(IAppDbContext context)
    : IRequestHandler<GetOverdueTodosQuery, ErrorOr<List<TodoResponse>>>
{
    public async Task<ErrorOr<List<TodoResponse>>> Handle(
        GetOverdueTodosQuery request,
        CancellationToken cancellationToken)
    {
        List<TodoResponse> todos = await context.TodoItems
            .Where(t => t.UserId == request.UserId && !t.IsCompleted && t.DueDate < DateTime.UtcNow)
            .OrderBy(t => t.DueDate)
            .ThenBy(t => t.Id)
            .Select(t => new TodoResponse
            {
                Id = t.Id,
                Description = t.Description,
                DueDate = t.DueDate,
                Labels = t.Labels,
                IsCompleted = t.IsCompleted,
                CreatedAt = t.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return todos;
    }
}
```

For single-item queries, return the matching `{Entity}Errors` member (e.g. `TodoErrors.NotFound`) when nothing matches, instead of returning `null`.

List queries:
- Always give the list a stable order (`OrderBy` plus a unique tiebreaker such as the id). Without one the database may return rows in any order, and paging skips or repeats rows.
- Bound the result. The sample above is unpaged to stay short; don't copy that for a list that can grow. Check how the project's existing list queries page (page/page-size fields on the query, a shared paged-response type, a fixed cap) and follow that, with a validated maximum page size. If no list query pages yet, ask the user before inventing a paging contract.

## Caching (optional — not currently used anywhere in this codebase)

No query in this template caches today; treat this as something to reach for deliberately, not a default for every new query. Only add it once a specific read is known to be hot (e.g. hit on every page load, expensive joins/aggregation).

```csharp
namespace Application.Features.Todos;

internal static class TodoCacheKeys
{
    internal static string ById(Guid userId, Guid todoItemId) => $"todos-{userId}-{todoItemId}";
}
```

```csharp
TodoResponse? todo = await cache.GetOrCreateAsync(
    TodoCacheKeys.ById(request.UserId, request.TodoItemId),
    async cancellation => await context.TodoItems
        .Where(t => t.Id == request.TodoItemId && t.UserId == request.UserId)
        .Select(t => new TodoResponse { /* ... */ })
        .SingleOrDefaultAsync(cancellation),
    cancellationToken: cancellationToken);
```

Every command that mutates the cached data must invalidate the same key with `cache.RemoveAsync(...)`. If you can't enumerate the affected keys, don't cache.
