# Feature audit guard

Scope the requested feature, area, or changed diff. Read applicable repo instructions and trace the actual local pattern. The audit is read-only unless the user requested fixes. Do not reject a legitimate framework or folder variation just because it differs from the default example.

## Trace the complete flow

1. **Entry:** route/method and operation ID are unique and discovered at runtime; group, API version/document, authorization policy, feature flag, and rate limit match the intended caller and contract.
2. **Input:** body/query/route/claim/cookie/header binding, requiredness, defaults, nulls, malformed input, and multipart parsing work as documented. Client data cannot spoof identity or another trusted source, and no bindable field lets a client set a server-owned value (owner, role, status, price, audit fields). A validator runs in the configured pipeline and uses published error codes if the operation has input rules.
3. **Handler and response:** the endpoint dispatches with cancellation, the handler resolves from DI, resource ownership is enforced, domain rules and data access complete, expected failures map to the intended status/envelope, and response DTOs expose only intended data. Unexpected failures return no stack trace, SQL, or internal detail to the caller, and logs carry no secrets, tokens, or personal data. OpenAPI describes reachable success and failure outcomes.
4. **State and effects:** schema/model/configuration/migration agree; constraints, provider semantics, transactions, concurrency, external effects, events, and upload cleanup are covered where relevant. Service lifetimes and registration match usage. No accidental duplicate validation or handler registrations. List queries are bounded (maximum page size, stable order) and do not issue a query per row (N+1). A command a client may retry is idempotent or takes an idempotency key. No secret, key, or connection string is committed in source or checked-in configuration.
5. **Proof:** focused behavior tests, provider-backed tests for database-dependent claims, HTTP tests for contract/auth/binding claims, and project-required docs/CI updates exist and run. State any unavailable environment or unrun command as unverified.

Report findings first, ordered by impact. Each finding needs a path and line, observed evidence, impact, and smallest correction. Then give a compact status table for entry, input/validation, auth/ownership, handler/result, persistence/effects, API documentation, and tests. Use **pass**, **fail**, **not applicable**, or **unverified**; never mark an unchecked branch as pass. If there are no findings, identify the exact audited scope and checks performed.

The table rows follow the trace: entry (step 1), input/validation (step 2), auth/ownership (policy in step 1, ownership in step 3), handler/result and API documentation (step 3), persistence/effects (step 4), tests (step 5). They are the per-feature subset of the longer template-level acceptance list that `vertical-slice-architecture` reports.

## Impact scale

- **high:** a caller can reach a security or data-integrity failure, or a documented contract is broken: authorization or ownership bypass, spoofable identity, data loss or corruption, leaked internal detail, wrong status or body on a documented path.
- **medium:** wrong behavior on a failure or edge path, an unbounded query, or a database/contract claim with no test that could prove it.
- **low:** convention drift or a documentation mismatch with no runtime effect.

## Report shape

Paths, lines, and wording below are illustrative; report what the audited code actually shows.

```text
Findings
1. [high] Api/Features/Orders/CancelOrder/CancelOrderHandler.cs:27
   Evidence: loads the order by id only; the caller's id is never compared.
   Impact: any authenticated user can cancel another user's order.
   Correction: filter by the caller's id and return the existing not-found error.
2. [low] Api/Features/Orders/CancelOrder/CancelOrderEndpoint.cs:14
   Evidence: the handler returns a conflict for an already-cancelled order; the endpoint metadata lists no 409.
   Impact: OpenAPI omits a reachable outcome.
   Correction: add the 409 response to the endpoint metadata.

| Area                | Status       | Evidence                                    |
| ------------------- | ------------ | ------------------------------------------- |
| Entry               | unverified   | CancelOrderEndpoint.cs:9; discovery not run |
| Input/validation    | pass         | CancelOrderValidator.cs:9                   |
| Auth/ownership      | fail         | finding 1                                   |
| Handler/result      | pass         | CancelOrderHandler.cs:18-40                 |
| Persistence/effects | unverified   | no disposable database in this environment  |
| API documentation   | fail         | finding 2                                   |
| Tests               | unverified   | test command not run: SDK unavailable       |
```
