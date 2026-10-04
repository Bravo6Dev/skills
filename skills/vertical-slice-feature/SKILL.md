---
name: vertical-slice-feature
description: Add or audit a complete HTTP use case in an existing .NET project with co-located vertical slices and domain/application/infrastructure boundaries. Follow the project's FastEndpoints/MediatR/ErrorOr pattern or its local equivalents; use for feature work, not initial architecture setup or legacy split-layer scaffolding.
---

# Vertical-slice feature

Complete a requested use case across the existing project's full flow. This skill fits projects with an API feature folder per operation and supporting domain/application/infrastructure boundaries. It also provides a read-only feature audit guard. The project's actual conventions outrank the example stack and paths below; do not migrate an existing project just to make it look like the example.

## Discover the local pattern

Read applicable repository instructions, architecture decisions, feature docs, solution files, and tests. Inspect the nearest comparable feature end to end: request binding, endpoint/group, handler, validation, expected-error mapping, data access, migration practice, test helpers, and CI. Identify the exact operation, caller, route, inputs, output, state changes, and external effects. If the code uses equivalent frameworks or a different folder name, use its established mechanisms and naming. If it uses a split Application/Carter or another non-co-located architecture, use that project's own feature workflow instead.

## Add the feature

Follow [the feature flow](references/build.md). Keep each HTTP use case in one feature slice; add only the validator, response, binder, domain changes, schema change, external adapter, and registrations the behavior needs. Trace the call from HTTP binding and authorization through validation and handler to persistence/side effects, then back through typed errors and documented responses. Preserve existing API contracts unless the user asks to change them.

Run the applicable build and focused tests, then broader tests when feasible. Update the project's test inventory or API documentation only where its own maintenance rules or the changed contract require it. State exactly which checks ran and what remains unverified.

## Audit guard

For an audit request, use [the guard](references/audit.md) without editing files unless the user asks for fixes. After building a feature, apply the same guard to the changed flow and fix concrete failures. Report file and line evidence with **pass**, **fail**, **not applicable**, or **unverified** status; compilation alone is not an end-to-end pass.

## Default shape when the project has not established a finer convention

- Co-locate `<UseCase>Request`, `<UseCase>Endpoint`, `<UseCase>Handler`, and applicable `<UseCase>Validator`/`<UseCase>Response` under `Api/Features/<Area>/<UseCase>/`.
- In a FastEndpoints/MediatR/ErrorOr project, let the transport request implement `IRequest<ErrorOr<T>>`; dispatch that request once, return typed expected errors from the handler, and map them at the endpoint. Use FastEndpoints validation for slice requests when that is the configured pipeline. Do not add a second validation pipeline or manual registrations when assembly discovery already handles them.
- Domain owns invariants and error meanings; Application owns shared contracts/workflows; Infrastructure owns EF Core and external adapters; API owns HTTP. Verify authorization policy and resource ownership separately. Never trust a client-provided identity.
- A read may need no validator, and a feature without schema changes needs no migration. Prefer the smallest complete flow over boilerplate.
