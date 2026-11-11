# Architecture blueprint

Use this as a decision framework, not a fixed folder generator. Name projects and paths according to the target repository.

## Project graph and ownership

```text
Domain  <-  Application  <-  Infrastructure
                 ^                 ^
                 |                 |
                 +------ API ------+
                          ^
                        Tests
```

An arrow points from a project to the project it references (`Domain <- Application`: Application references Domain). References are transitive, so Infrastructure and API also see Domain. The diagram shows Tests only through the API host; a test project references whichever layers it exercises.

- **Domain:** entities, value objects, invariants, domain events, error definitions. No dependency on HTTP, EF Core, or external providers.
- **Application:** contracts used by workflows (`IAppDbContext`, storage, messaging, clocks), shared use-case services, and cross-cutting MediatR behaviors that really apply to all requests. It can depend on Domain, not API or Infrastructure.
- **Infrastructure:** EF Core context, entity configurations, migrations, provider adapters, background/external services. It implements Application contracts and references Domain/Application, never API.
- **API:** composition root, authentication/authorization, serialization, localization, OpenAPI, and co-located feature slices. The API may reference the other projects to compose them. A handler may live with its endpoint in API only when that endpoint is its sole caller; a workflow invoked by another slice, a background job, a message consumer, or any non-HTTP host belongs in Application. Because API references Infrastructure for composition, nothing in the compiler stops a slice from using the concrete `DbContext` or a provider adapter: API-hosted handlers go through Application contracts, only the composition root touches Infrastructure types, and the dependency test in the setup order enforces it.
- **Tests:** depend on the layers they exercise. Use a real database provider for SQL behavior, constraints, migrations, and transaction semantics; a light double is suitable for pure handler branching.

Suggested slice shape:

```text
Api/Features/<Area>/
  <Area>Group.cs                 # when group policy/version/route metadata is shared
  <UseCase>/
    <UseCase>Request.cs          # transport request and dispatch message
    <UseCase>Endpoint.cs         # binding, policy, metadata, dispatch and result mapping
    <UseCase>Handler.cs          # orchestration and data access through contracts
    <UseCase>Validator.cs        # only when input rules exist
    <UseCase>Response.cs         # only when this use case owns the shape
    <UseCase>Binder.cs           # only for binding needing custom parsing
```

Promote a DTO or helper to the area only after more than one slice actually uses it. Keep non-HTTP workflows and cross-area services outside a single HTTP slice. Reads project to response types and avoid exposing persistence entities. For a request with no client fields, use the endpoint framework's requestless form if a propertyless request would fail binding. There is then no transport request to dispatch: the endpoint builds the dispatch message itself from claims or server state, or calls the handler directly.

## Setup order

1. Create or adapt the solution/projects, target framework, package management and project references. Restore and build before adding behavior.
2. Define a small domain example and Application persistence contract. Add EF Core context/configuration, a chosen database provider, migrations, and dependency injection. Keep provider-specific configuration in Infrastructure. Add design-time context creation if migrations cannot otherwise run. Check indexes, uniqueness, foreign keys, UTC handling, and data ownership for each persisted type.
3. Compose API startup: configuration validation, secrets outside source control, logging/error handling, endpoint registration, MediatR scanning (or the chosen dispatcher's registration) for both Application and API handlers, validation discovery, database registration, auth/policies, serialization, OpenAPI, and health checks where deployment needs them. Apply the security baseline here: HTTPS redirection and HSTS outside development, an explicit CORS policy when browsers call the API, request body and upload size limits, an exception path that returns no stack trace or internal detail, and logging that records no secrets, tokens, or personal data. Register each service once with a correct lifetime; avoid captive scoped services in singleton validators or background workers.
4. Define one result convention: success and no-content responses, typed expected errors with stable codes, validation errors, and unexpected errors. Add localization only when the product needs it; if present, ensure every published error code has a translation. Keep wire schema and response metadata consistent with runtime mapping.
5. Implement the reference slice through the actual database. Use a disposable database for it: a container or local instance of the chosen provider created for the run, or a throwaway database the user designates. If none is available, do not point at a shared or production database; report persistence and migrations as **unverified** and say what is needed to verify them. Verify route binding from body/query/route/claim, validation before business work, policy and ownership checks, handler dispatch, persistence, and response mapping. Multipart uploads, file cleanup, feature flags, per-feature rate limits, and domain-event dispatch are conditional capabilities; add them only when the product needs them and prove their failure paths. A maximum page size on list endpoints, rate limiting on anonymous and authentication endpoints, and idempotent handling of commands a client may retry are baseline, not conditional, whenever such endpoints exist.
6. Add test hosts/helpers and a CI workflow that restores, builds, and runs the intended suite, for the CI provider the repository uses or the user confirmed. Use the repository's chosen test framework. Add the automated dependency test: Domain and Application reference neither API nor Infrastructure, and types under the API feature folders use no Infrastructure type directly. A focused HTTP test must prove the route is discovered and the result contract works; a provider-backed integration test must prove persistence if the template includes EF Core.

## Acceptance guard

Report **pass**, **fail**, **not applicable**, or **unverified** for: project graph (including the dependency test), registrations and service lifetimes, route discovery, binding, validation, auth and ownership, expected-error mapping, persistence/migrations, security baseline, OpenAPI, tests, and CI. Execute the build and relevant tests; identify environment limits plainly. Review generated migration SQL and ensure no test points at a production database. A template is ready for new features only when its reference slice runs through the intended stack, not merely when projects compile.
