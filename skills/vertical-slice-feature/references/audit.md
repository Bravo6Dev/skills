# Feature audit guard

Scope the requested feature, area, or changed diff. Read applicable repo instructions and trace the actual local pattern. Read-only unless the user requested fixes. Do not reject a legitimate framework or folder variation just because it differs from the default example.

## Trace the complete flow

1. **Entry:** route/method and operation ID are unique and discovered at runtime; group, API version/document, authorization policy, feature flag, and rate limit match the intended caller and contract.
2. **Input:** body/query/route/claim/cookie/header binding, requiredness, defaults, nulls, malformed input, and multipart parsing work as documented. Client data cannot spoof identity or another trusted source. A validator runs in the configured pipeline and uses published error codes if the operation has input rules.
3. **Handler and response:** the endpoint dispatches with cancellation, the handler resolves from DI, resource ownership is enforced, domain rules and data access complete, expected failures map to the intended status/envelope, and response DTOs expose only intended data. OpenAPI describes reachable success and failure outcomes.
4. **State and effects:** schema/model/configuration/migration agree; constraints, provider semantics, transactions, concurrency, external effects, events, and upload cleanup are covered where relevant. Service lifetimes and registration match usage. No accidental duplicate validation or handler registrations.
5. **Proof:** focused behavior tests, provider-backed tests for database-dependent claims, HTTP tests for contract/auth/binding claims, and project-required docs/CI updates exist and run. State any unavailable environment or unrun command as unverified.

Report findings first, ordered by impact. Each finding needs a path and line, observed evidence, impact, and smallest correction. Then give a compact status table for entry, input/validation, auth/ownership, handler/result, persistence/effects, API documentation, and tests. Use **pass**, **fail**, **not applicable**, or **unverified**; never mark an unchecked branch as pass. If there are no findings, identify the exact audited scope and checks performed.
