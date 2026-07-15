# Command Slice Templates

Files go in `Application/Features/{Feature}/{UseCase}/`. Replace `{Feature}` (plural, e.g. `Todos`), `{Entity}` (e.g. `TodoItem`), and use-case names throughout.

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
- `UserId` (or similar) is a plain field the *endpoint* fills in from `httpContext.User.GetUserId()` — see [Deliberate differences](../SKILL.md#deliberate-differences-from-the-icommandiqueryresult-style-template) in SKILL.md for why there's no injected current-user service.

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
        RuleFor(c => c.Description).NotEmpty().MaximumLength(255).WithErrorCode(TodoErrors.Codes.DescriptionRequired);
        RuleFor(c => c.DueDate).GreaterThanOrEqualTo(DateTime.Today).When(c => c.DueDate.HasValue)
            .WithErrorCode(TodoErrors.Codes.DueDateInPast);
    }
}
```

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
- Ownership: filter the query by the `UserId` carried on the request (preferred), or load first and compare, returning `UserErrors.Unauthorized` on mismatch.
- For a returning command (`IRequest<ErrorOr<Guid>>`), return the value directly — `ErrorOr<T>` has an implicit conversion: `return todoItem.Id;`.
- `Unit.Value` (from MediatR) is the "no data" success value for void commands — don't invent a custom marker type.
- Cross-cutting concerns (logging, validation, file cleanup) are already wired as open-generic MediatR pipeline behaviors in `Application/Behaviors/` — a new slice doesn't add its own.

## Domain additions (if needed)

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
        public const string DueDateInPast = "Todos.DueDate.InPast";
    }
}
```

`Error` factory → HTTP status (via the `MatchResult` extension in `references/endpoint.md`): `NotFound` → 404, `Conflict` → 409, `Validation`/`Failure` → 400, `Unauthorized` → 401, `Forbidden` → 403.

This template has no domain-event/`Raise(...)` mechanism — state changes happen directly in the handler followed by `SaveChangesAsync`. If a change needs a side effect (notification, projection, etc.), call the relevant service directly from the handler rather than introducing an event pipeline that doesn't otherwise exist here.
