# Command Slice Templates

Files go in `Application/Features/{Feature}/{UseCase}/`. The samples use a `Todos` feature and a `TodoItem` entity — substitute your own feature (plural), entity and use-case names throughout.

## Command

Positional record for few parameters:

```csharp
using ErrorOr;
using MediatR;

namespace Application.Features.Todos.Archive;

public sealed record ArchiveTodoCommand(Guid TodoItemId, Guid UserId) : IRequest<ErrorOr<Unit>>;
```

Record with `init`-only properties when there are many parameters (matches `CreateTodoCommand`):

```csharp
using ErrorOr;
using MediatR;

namespace Application.Features.Todos.Create;

public sealed record CreateTodoCommand : IRequest<ErrorOr<Guid>>
{
    public Guid UserId { get; init; }
    public string Description { get; init; } = string.Empty;
    public DateTime? DueDate { get; init; }
    public List<string> Labels { get; init; } = [];
    public int Priority { get; init; }
}
```

- `IRequest<ErrorOr<Unit>>` → endpoint responds `204 NoContent` (see `references/endpoint.md`).
- `IRequest<ErrorOr<TResponse>>` → endpoint responds `200 Ok` with the value.
- `UserId` (or similar) is a plain field the *endpoint* fills in from `httpContext.User.GetUserId()` — see [Deliberate differences](../SKILL.md#deliberate-differences-from-the-icommandiqueryresult-style-template) in SKILL.md for why there's no injected current-user service. Because `CreateTodoCommand` is bound straight from the request body, a client can put a `UserId` in the JSON; the endpoint's `command with { UserId = ... }` is what makes that harmless. See the over-posting rule in `references/endpoint.md`.

## Validator

Public class, same folder. Auto-registered (`AddValidatorsFromAssembly`) and run automatically by the `ValidationBehavior<,>` MediatR pipeline behavior before the handler executes.

```csharp
using Domain.Errors;
using FluentValidation;

namespace Application.Features.Todos.Create;

public sealed class CreateTodoCommandValidator : AbstractValidator<CreateTodoCommand>
{
    public CreateTodoCommandValidator()
    {
        RuleFor(c => c.UserId).NotEmpty().WithErrorCode(TodoErrors.Codes.UserIdRequired);
        RuleFor(c => c.Description)
            .NotEmpty().WithErrorCode(TodoErrors.Codes.DescriptionRequired)
            .MaximumLength(255).WithErrorCode(TodoErrors.Codes.DescriptionTooLong);
        RuleFor(c => c.DueDate).Must(dueDate => dueDate >= DateTime.UtcNow.Date).When(c => c.DueDate.HasValue)
            .WithErrorCode(TodoErrors.Codes.DueDateInPast);
    }
}
```

Notes:
- `.WithErrorCode(...)` applies only to the validator immediately before it. Give every validator in a chain its own code; one trailing `.WithErrorCode` leaves the earlier validators with FluentValidation's default codes (`NotEmptyValidator`, ...), and the wrong message reaches the client.
- Compare dates against the same clock the handlers use (`DateTime.UtcNow` here), inside the rule so it is evaluated per request. `DateTime.Today` is server-local time and, passed as a constant, is captured once when the validator is constructed.
- Bound every client-supplied collection, string and number. The sample leaves `Labels` and `Priority` unchecked only because their limits are domain decisions: when you write a real validator, add a maximum count and item length for lists and an allowed range for numbers, or ask the user for the limits. Keep them in step with the column lengths in the EF configuration.

## Handler

`public sealed class` with a primary constructor, `IAppDbContext` for data access. Guard clauses return the appropriate `{Entity}Errors` member; the happy path mutates, saves, and returns.

```csharp
using Application.Interface.Data;
using Domain.Entities;
using Domain.Errors;
using ErrorOr;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Todos.Archive;

public sealed class ArchiveTodoCommandHandler(IAppDbContext context)
    : IRequestHandler<ArchiveTodoCommand, ErrorOr<Unit>>
{
    public async Task<ErrorOr<Unit>> Handle(ArchiveTodoCommand request, CancellationToken cancellationToken)
    {
        TodoItem? todoItem = await context.TodoItems
            .FirstOrDefaultAsync(t => t.Id == request.TodoItemId && t.UserId == request.UserId, cancellationToken);

        if (todoItem is null)
            return TodoErrors.NotFound;

        if (todoItem.IsArchived)
            return TodoErrors.AlreadyArchived;

        todoItem.IsArchived = true;
        todoItem.ArchivedAt = DateTime.UtcNow;

        await context.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}
```

Notes:
- Ownership: filter the query by the `UserId` carried on the request (preferred), so another user's item is indistinguishable from a missing one and returns `{Entity}Errors.NotFound` (404). If you load first and compare, still return `NotFound` — or a `Forbidden`-type error (403) if the project deliberately reveals that the item exists. Never an `Unauthorized` error: 401 means "not authenticated" and can send the client into a re-login loop.
- For a returning command (`IRequest<ErrorOr<Guid>>`), return the value directly — `ErrorOr<T>` has an implicit conversion: `return todoItem.Id;`.
- `Unit.Value` (from MediatR) is the "no data" success value for void commands — don't invent a custom marker type.
- Cross-cutting concerns (logging, validation, file cleanup) are already wired as open-generic MediatR pipeline behaviors in `Application/Behaviors/` — a new slice doesn't add its own.
- Concurrency: load → check → save is not atomic. Two requests racing on the same row can both pass the guard. Where that matters, check whether the entity already has a concurrency token (e.g. a `rowversion` property) and whether existing handlers translate `DbUpdateConcurrencyException` into a `Conflict` error, and follow that. If the project has no such pattern, tell the user rather than adding one to a single entity.
- Transactions: one `SaveChangesAsync` call is one transaction. A handler that needs several saves (or a save plus raw SQL) to succeed or fail together needs an explicit transaction — look at how existing handlers do it before introducing a new pattern.
- Idempotency: a create command the client retries (timeout, double submit) inserts twice. If a duplicate would be harmful — payments, orders, anything billed or sent — ask the user how the project wants it handled (idempotency key, a natural unique constraint) instead of shipping a plain insert.

## Domain additions (if needed)

New entity, or new columns on an existing one (the Archive sample assumes `TodoItem` has `IsArchived` and `ArchivedAt`):

1. Entity class in `Domain/Entities/`, shaped like the existing entities.
2. For a new entity, a `DbSet<{Entity}>` on `IAppDbContext` (Application) and on the Infrastructure `AppDbContext`.
3. EF configuration next to the existing entity configurations — required/length/index settings that match the validator rules.
4. A migration: `dotnet ef migrations add {Name} --project {InfrastructureProject} --startup-project {WebProject}`. Read the generated `Up`/`Down` before keeping it. Do not run `dotnet ef database update` against a shared or non-local database unless the user asks for it.

`{Entity}Errors` class in `Domain/Errors/{Entity}Errors.cs`, built from **ErrorOr**'s `Error` factories with a nested `Codes` class of string constants:

```csharp
using ErrorOr;

namespace Domain.Errors;

public static class TodoErrors
{
    public static Error NotFound => Error.NotFound(Codes.NotFound, "The todo item was not found.");
    public static Error AlreadyArchived => Error.Conflict(Codes.AlreadyArchived, "The todo item is already archived.");

    public static class Codes
    {
        public const string NotFound = "Todos.NotFound";
        public const string AlreadyArchived = "Todos.AlreadyArchived";
        public const string UserIdRequired = "Todos.UserId.Required";
        public const string DescriptionRequired = "Todos.Description.Required";
        public const string DescriptionTooLong = "Todos.Description.TooLong";
        public const string DueDateInPast = "Todos.DueDate.InPast";
    }
}
```

`Error` factory → HTTP status (via the `MatchResult` extension in `references/endpoint.md`): `NotFound` → 404, `Conflict` → 409, `Validation`/`Failure` → 400, `Unauthorized` → 401, `Forbidden` → 403.

This template has no domain-event/`Raise(...)` mechanism — state changes happen directly in the handler followed by `SaveChangesAsync`. If a change needs a side effect (notification, projection, etc.), call the relevant service directly from the handler rather than introducing an event pipeline that doesn't otherwise exist here. Save first, then call the side effect, and decide what happens when the side effect fails after the save has committed (ask the user if it isn't obvious) — there is no outbox here, so the two can diverge.
