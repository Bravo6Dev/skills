# Test Templates

Stack: **MSTest** (`[TestClass]`/`[TestMethod]`) + its own `Assert.*` API, **FluentValidation.TestHelper** for validators. Every new use case gets a handler unit test, a validator test, and a handler-level integration test.

> This template's own `tests.md` conventions doc mentions FluentAssertions and WebApplicationFactory/Testcontainers — the actual test suite uses neither. Follow what's below (verified against the real test files); it reflects what actually runs in CI today.

## Handler unit tests

`Tests/Features/{Feature}/{UseCase}{Command|Query}HandlerTests.cs`. Backed by the EF Core **InMemory** provider via a `TestDbContextFactory.Create()` helper (unique DB name per instance — no shared state between tests). Any external dependency the handler needs (auth, tokens, OTP, storage, ...) is a hand-written **fake** in `Tests/Helpers/` (e.g. `FakeAuthService`, `FakeTokenService`) — not a mocking library.

Cover: each failure path (one test per guard clause) and the happy path, asserting persisted state through the same `AppDbContext`.

```csharp
using Application.Features.Todos.Archive;
using Domain.Entities;
using Domain.Errors;
using Infrastructure.Data;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Tests.Helpers;

namespace Tests.Features.Todos;

[TestClass]
public sealed class ArchiveTodoCommandHandlerTests
{
    private static readonly Guid UserId = Guid.NewGuid();

    private readonly AppDbContext _context;
    private readonly ArchiveTodoCommandHandler _handler;

    public ArchiveTodoCommandHandlerTests()
    {
        _context = TestDbContextFactory.Create();
        _handler = new ArchiveTodoCommandHandler(_context);
    }

    [TestCleanup]
    public void Cleanup() => _context.Dispose();

    [TestMethod]
    public async Task Handle_TodoDoesNotExist_ReturnsNotFound()
    {
        var result = await _handler.Handle(new ArchiveTodoCommand(Guid.NewGuid(), UserId), CancellationToken.None);

        Assert.IsTrue(result.IsError);
        Assert.AreEqual(TodoErrors.Codes.NotFound, result.FirstError.Code);
    }

    [TestMethod]
    public async Task Handle_ValidCommand_ArchivesTodo()
    {
        var todo = new TodoItem { Id = Guid.NewGuid(), UserId = UserId, Description = "Archive me" };
        await _context.TodoItems.AddAsync(todo);
        await _context.SaveChangesAsync();

        var result = await _handler.Handle(new ArchiveTodoCommand(todo.Id, UserId), CancellationToken.None);

        Assert.IsFalse(result.IsError);
        var stored = await _context.TodoItems.FindAsync(todo.Id);
        Assert.IsNotNull(stored);
        Assert.IsTrue(stored.IsArchived);
    }
}
```

Conventions:
- Test names: `MethodName_StateUnderTest_ExpectedBehavior`, e.g. `Handle_TodoDoesNotExist_ReturnsNotFound`.
- Assert failures by comparing the error **code**, not the whole `Error` object: `Assert.AreEqual(TodoErrors.Codes.NotFound, result.FirstError.Code)`.
- `[TestCleanup]` disposes the in-memory context; there's no shared fixture between test methods in a class.
- Add a new `Fake{Service}` under `Tests/Helpers/` only if one doesn't already exist for that interface — reuse existing fakes first.

## Validator tests

`Tests/Features/{Feature}/{UseCase}CommandValidatorTests.cs`.

```csharp
using Application.Features.Todos.Create;
using Domain.Errors;
using FluentValidation.TestHelper;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Tests.Features.Todos;

[TestClass]
public sealed class CreateTodoCommandValidatorTests
{
    private readonly CreateTodoCommandValidator _validator = new();

    private static CreateTodoCommand ValidCommand() => new()
    {
        UserId = Guid.NewGuid(),
        Description = "Buy milk"
    };

    [TestMethod]
    public void Validate_ValidCommand_PassesValidation()
    {
        var result = _validator.TestValidate(ValidCommand());
        result.ShouldNotHaveAnyValidationErrors();
    }

    [TestMethod]
    public void Validate_EmptyDescription_FailsWithDescriptionRequiredCode()
    {
        var command = ValidCommand() with { Description = string.Empty };

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(c => c.Description)
              .WithErrorCode(TodoErrors.Codes.DescriptionRequired);
    }
}
```

Cover each rule's failure plus one fully-valid command. Assert with `.WithErrorCode(...)`, matching the `{Entity}Errors.Codes` constant the validator used.

## Integration tests

`Tests/IntegrationTests/Features/{Feature}/{UseCase}HandlerIntegrationTests.cs`. These run the handler directly (no HTTP layer) against a **real SQL Server** database — `IntegrationTestDbContextFactory.Create(dbName)`, which points at `(localdb)\mssqllocaldb` by default or the `TEST_SQL_CONNECTION` environment variable in CI. Each test class creates and drops its own uniquely-named database.

```csharp
using Application.Features.Todos.Archive;
using Domain.Entities;
using Domain.Errors;
using Infrastructure.Data;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Tests.IntegrationTests.Helpers;

namespace Tests.IntegrationTests.Features.Todos;

[TestClass]
public sealed class ArchiveTodoHandlerIntegrationTests
{
    private static string _dbName = default!;
    private AppDbContext _context = default!;
    private ArchiveTodoCommandHandler _handler = default!;

    [ClassInitialize]
    public static void ClassInit(TestContext _)
    {
        _dbName = $"VoltyIT_ArchiveTodo_{Guid.NewGuid():N}";
        using var ctx = IntegrationTestDbContextFactory.Create(_dbName);
        ctx.Database.EnsureCreated();
    }

    [ClassCleanup]
    public static void ClassCleanup()
    {
        using var ctx = IntegrationTestDbContextFactory.Create(_dbName);
        ctx.Database.EnsureDeleted();
    }

    [TestInitialize]
    public void Init()
    {
        _context = IntegrationTestDbContextFactory.Create(_dbName);
        _handler = new ArchiveTodoCommandHandler(_context);
    }

    [TestCleanup]
    public void Cleanup() => _context.Dispose();

    [TestMethod]
    public async Task Handle_ValidCommand_PersistsArchivedState()
    {
        var userId = Guid.NewGuid();
        var todo = new TodoItem { Id = Guid.NewGuid(), UserId = userId, Description = "Archive me" };
        _context.TodoItems.Add(todo);
        await _context.SaveChangesAsync();

        var result = await _handler.Handle(new ArchiveTodoCommand(todo.Id, userId), CancellationToken.None);

        Assert.IsFalse(result.IsError);

        using var verifyCtx = IntegrationTestDbContextFactory.Create(_dbName);
        var stored = await verifyCtx.TodoItems.FindAsync(todo.Id);
        Assert.IsNotNull(stored);
        Assert.IsTrue(stored.IsArchived);
    }
}
```

Minimum coverage per new slice: one happy-path test that re-reads through a fresh context to prove the write actually persisted, plus one failure-path test per handler guard clause that has DB-dependent behavior (e.g. a not-found case that's only meaningful against a real provider).

## Run

```
dotnet test
```

Integration tests need either LocalDB (Windows default) or `TEST_SQL_CONNECTION` pointed at a reachable SQL Server (CI).
