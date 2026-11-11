---
name: vertical-slice-feature
description: Add or audit a complete HTTP use case in an existing .NET project whose use cases are co-located as one folder per operation (Features/Area/UseCase) inside the API project, typically FastEndpoints endpoints with MediatR and ErrorOr or local equivalents, alongside domain/application/infrastructure boundaries. Use for feature work in that layout; not for initial architecture setup (use vertical-slice-architecture), and not for split-layer projects where MediatR handlers live under an Application project and Carter modules expose them (use add-feature).
---

# Vertical-slice feature

Complete a requested use case across the existing project's full flow. This skill fits projects with an API feature folder per operation and supporting domain/application/infrastructure boundaries. It also provides a read-only feature audit guard. The project's actual conventions outrank the example stack and paths below; do not migrate an existing project just to make it look like the example.

## Discover the local pattern

Read applicable repository instructions, architecture decisions, feature docs, solution files, and tests. Inspect the nearest comparable feature end to end: request binding, endpoint/group, handler, validation, expected-error mapping, data access, migration practice, test helpers, and CI. Identify the exact operation, caller, route, inputs, output, state changes, and external effects. If the code uses equivalent frameworks or a different folder name, use its established mechanisms and naming. Confirm the architecture before adding or auditing anything. Endpoint, request, and handler together under a feature folder in the API project fit this skill. If handlers live under an Application project and Carter modules in the web project expose them through MediatR, use `add-feature` instead. If the code matches neither pattern, stop and tell the user what you found; do not force either workflow onto it.

## Add the feature

Follow [the feature flow](references/build.md). Keep each HTTP use case in one feature slice; add only the validator, response, binder, domain changes, schema change, external adapter, and registrations the behavior needs. Trace the call from HTTP binding and authorization through validation and handler to persistence/side effects, then back through typed errors and documented responses. Preserve existing API contracts unless the user asks to change them.

Run the applicable build and focused tests, then broader tests when feasible. Update the project's maintained list of tests (when it keeps one) or API documentation only where its own maintenance rules or the changed contract require it. State exactly which checks ran and what remains unverified.

## Audit guard

For an audit request, use [the guard](references/audit.md) without editing files unless the user asks for fixes. After building a feature, apply the same guard to the changed flow and fix concrete failures. Report file and line evidence with **pass**, **fail**, **not applicable**, or **unverified** status; compilation alone is not an end-to-end pass.

## Default shape when the project has not established a finer convention

The project's documented feature folder contract is the source of truth; this list is the fallback and matches the shape `vertical-slice-architecture` sets up.

- Co-locate `<UseCase>Request`, `<UseCase>Endpoint`, `<UseCase>Handler`, and applicable `<UseCase>Validator`/`<UseCase>Response` under `Api/Features/<Area>/<UseCase>/`. Add `<Area>Group` only for group policy/version/route metadata shared by the area, and `<UseCase>Binder` only for binding that needs custom parsing.
- In a FastEndpoints/MediatR/ErrorOr project, let the transport request implement `IRequest<ErrorOr<T>>`; dispatch that request once, return typed expected errors from the handler, and map them at the endpoint. Use FastEndpoints validation for slice requests when that is the configured pipeline. Do not add a second validation pipeline or manual registrations when assembly discovery already handles them. Use the dispatcher the project already has; MediatR is commercially licensed from v13, so do not add it to a project without it, or upgrade it across that version, without the user's agreement.
- Domain owns invariants and error meanings; Application owns shared contracts/workflows; Infrastructure owns EF Core and external adapters; API owns HTTP. Verify authorization policy and resource ownership separately. Never trust a client-provided identity.
- A read may need no validator, and a feature without schema changes needs no migration. Prefer the smallest complete flow over boilerplate.
