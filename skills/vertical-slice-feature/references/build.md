# Add one complete use case

Use local feature files as templates. The steps below are checkpoints; skip a file when the behavior has no need for it.

## Contract and slice

1. Search for an existing use case, route, response, error code, schema, and test covering the request. Split a feature with several HTTP operations into separate slices. Keep route/method and operation names unique. Determine authentication policy, resource ownership, API version/document, expected status and response body, and whether the operation is read-only or mutates state.
2. Build the request using the project's binding conventions for body, route, query, claims, headers, and cookies. Do not let body fields override trusted route or identity values. Decide requiredness, defaults, nullable values, enum parsing, pagination, and absent/malformed input from the actual HTTP contract. In FastEndpoints projects, a propertyless request may require `EndpointWithoutRequest<TResult>`.
3. Create or extend the endpoint in the established area/group. Route and group policy, feature gate, rate limit, media type, API version, and OpenAPI metadata must match runtime behavior. Dispatch the request with a cancellation token and use the project's success/error mapping. Check both success and realistic failure status metadata. Keep endpoints thin.
4. Add a handler for orchestration. Use application contracts or existing shared services for data and external I/O; put persistent business invariants in Domain. Reads return response DTOs rather than persistence entities. Writes save intended state once and handle duplicate/conflicting requests and concurrent updates where the domain requires it. Filter or compare resource ownership in the handler even when the route has an authorization policy.
5. Add request validation only for meaningful input rules; use the project's configured validator pipeline and stable error codes. Expected not-found, conflict, forbidden, and invalid-state outcomes should use the existing typed-result convention. Ensure each user-facing code has the required localization/translation. Unexpected failures follow the project's exception path.

## Downstream changes when needed

- New persisted state may require domain types, an application context contract, EF Core `DbSet`, entity configuration, migration, and indexes/constraints. Follow the target database provider and migration tooling. Inspect generated migrations and backward compatibility; validate with a disposable database rather than applying to an uncontrolled instance.
- A new external dependency needs an application-owned contract, infrastructure implementation, correct DI lifetime, and tests of its failure behavior. Check transaction and partial-failure boundaries; an external call is not automatically rolled back with a database save.
- Multipart uploads need the project's binder, content-type and antiforgery handling, and cleanup behavior. Check missing/invalid files, save failure after upload, replacement, and whether prior files survive a failed update.
- Domain events, queues, feature flags, rate limits, encryption, time zones, and pagination are conditional. Use the existing mechanism only where this feature needs it; verify ordering and failure paths that could alter the response or stored state.

## Proof

Add focused tests for a real happy path and meaningful failures/boundaries. Use a provider-backed integration test for SQL translation, constraints, migrations, concurrency or transaction behavior; a pure in-memory double cannot prove those. Use an HTTP host for route discovery, binding, auth/ownership, validation envelope, status, and OpenAPI changes. Use the project's chosen test framework and helpers. Follow any local rule for updating test inventory or documentation.

Run the project's build, focused tests, and appropriate broader suite. Review the diff for unintended contract changes, missing registrations, localization, migration safety, and unrelated edits. Report exact commands and results; distinguish checks that could not run from checks that passed.
