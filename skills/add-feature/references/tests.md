# Test Templates

Stack: **MSTest** (`[TestClass]`/`[TestMethod]`) + its own `Assert.*` API, **FluentValidation.TestHelper** for validators. Every new use case gets a handler unit test, a validator test when the slice has a validator, and a handler-level integration test.

> Unless the solution already has them, the test suite uses neither FluentAssertions nor WebApplicationFactory/Testcontainers, whatever other conventions docs in the solution may say. Follow the patterns below, and don't add those packages for a single new slice. An HTTP test host that already exists is used as described under [Endpoint (HTTP-level) coverage](#endpoint-http-level-coverage).

## Handler unit tests

`Tests/Features/{Feature}/{Handler}Tests.cs` (e.g. `ArchiveTodoCommandHandlerTests.cs`). Backed by the EF Core **InMemory** provider via a `TestDbContextFactory.Create()` helper (unique DB name per instance — no shared state between tests). Any external dependency the handler needs (auth, tokens, OTP, storage, ...) is a hand-written **fake** in `Tests/Helpers/` (e.g. `FakeAuthService`, `FakeTokenService`) — not a mocking library.

Cover: each failure path (one test per guard clause, including the ownership check — another user's row) and the happy path. Assert persisted state after `_context.ChangeTracker.Clear()`, so the assertion re-reads what was saved; without it `FindAsync` hands back the tracked instance the handler just mutated, and the test passes even if `SaveChangesAsync` is missing.

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
    public async Task Handle_TodoBelongsToAnotherUser_ReturnsNotFound()
    {
        var todo = new TodoItem { Id = Guid.NewGuid(), UserId = Guid.NewGuid(), Description = "Not yours" };
        _context.TodoItems.Add(todo);
        await _context.SaveChangesAsync();

        var result = await _handler.Handle(new ArchiveTodoCommand(todo.Id, UserId), CancellationToken.None);

        Assert.IsTrue(result.IsError);
        Assert.AreEqual(TodoErrors.Codes.NotFound, result.FirstError.Code);
    }

    [TestMethod]
    public async Task Handle_TodoAlreadyArchived_ReturnsAlreadyArchived()
    {
        var todo = new TodoItem { Id = Guid.NewGuid(), UserId = UserId, Description = "Archived", IsArchived = true };
        _context.TodoItems.Add(todo);
        await _context.SaveChangesAsync();

        var result = await _handler.Handle(new ArchiveTodoCommand(todo.Id, UserId), CancellationToken.None);

        Assert.IsTrue(result.IsError);
        Assert.AreEqual(TodoErrors.Codes.AlreadyArchived, result.FirstError.Code);
    }

    [TestMethod]
    public async Task Handle_ValidCommand_ArchivesTodo()
    {
        var todo = new TodoItem { Id = Guid.NewGuid(), UserId = UserId, Description = "Archive me" };
        _context.TodoItems.Add(todo);
        await _context.SaveChangesAsync();

        var result = await _handler.Handle(new ArchiveTodoCommand(todo.Id, UserId), CancellationToken.None);

        Assert.IsFalse(result.IsError);
        _context.ChangeTracker.Clear();
        var stored = await _context.TodoItems.FindAsync(todo.Id);
        Assert.IsNotNull(stored);
        Assert.IsTrue(stored.IsArchived);
        Assert.IsNotNull(stored.ArchivedAt);
    }
}
```

Conventions:
- Test names: `MethodName_StateUnderTest_ExpectedBehavior`, e.g. `Handle_TodoDoesNotExist_ReturnsNotFound`.
- Assert failures by comparing the error **code**, not the whole `Error` object: `Assert.AreEqual(TodoErrors.Codes.NotFound, result.FirstError.Code)`.
- `[TestCleanup]` disposes the in-memory context; there's no shared fixture between test methods in a class.
- Add a new `Fake{Service}` under `Tests/Helpers/` only if one doesn't already exist for that interface — reuse existing fakes first.
- Query handlers get the same treatment: seed rows for the caller and for another user, then assert that only the caller's rows come back, in the expected order.

## Validator tests

`Tests/Features/{Feature}/{Command}ValidatorTests.cs` (e.g. `CreateTodoCommandValidatorTests.cs`). A query that has a validator gets `{Query}ValidatorTests.cs` the same way.

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

    [TestMethod]
    public void Validate_DescriptionTooLong_FailsWithDescriptionTooLongCode()
    {
        var command = ValidCommand() with { Description = new string('a', 256) };

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(c => c.Description)
              .WithErrorCode(TodoErrors.Codes.DescriptionTooLong);
    }
}
```

Cover each validator's failure — every validator in a chain has its own error code, so each needs its own test — plus one fully-valid command. Assert with `.WithErrorCode(...)`, matching the `{Entity}Errors.Codes` constant the validator used.

## Integration tests

`Tests/IntegrationTests/Features/{Feature}/{UseCase}HandlerIntegrationTests.cs` (e.g. `ArchiveTodoHandlerIntegrationTests.cs`). These run the handler directly (no HTTP layer) against a **real SQL Server** database — `IntegrationTestDbContextFactory.Create(dbName)`, which points at `(localdb)\mssqllocaldb` by default or the `TEST_SQL_CONNECTION` environment variable in CI. Each test class creates and drops its own uniquely-named database.

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
        _dbName = $"IntegrationTest_ArchiveTodo_{Guid.NewGuid():N}";
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

`EnsureCreated()` builds the schema from the current model and bypasses the migrations, so these tests do not prove that a new migration works. When the slice adds a migration, check it separately — review the generated `Up`/`Down` and apply it to a disposable database. Don't change the shared integration helper to `Migrate()` without asking.

## Endpoint (HTTP-level) coverage

Everything above calls the handler directly. None of it exercises the route registration in the Carter module, authorization, model binding, the `ValidationBehavior<,>` pipeline or the `MatchResult` status mapping — a route that was never wired builds, passes every test here, and returns 404.

- If the solution already has an HTTP test host (a `WebApplicationFactory<Program>`-based project), add one test per new endpoint: the expected status and body on the happy path, `401` without credentials, `404` for a resource that belongs to another user, and `400` for an invalid body.
- If it has none, don't add one as a side effect of a single slice. Re-read the `group.MapX(...)` line you added, call the route once if you can run the API, and say in your summary that the endpoint itself is not covered by automated tests. Offer an HTTP test host as a separate change.

## Run

```
dotnet test
```

Integration tests need either LocalDB (Windows default) or `TEST_SQL_CONNECTION` pointed at a reachable SQL Server (CI). LocalDB does not exist on Linux or macOS. When neither is available, run everything else:

```
dotnet test --filter "FullyQualifiedName!~IntegrationTests"
```

and report the integration tests as written but not run. Don't describe the slice as verified against a real database in that case.
