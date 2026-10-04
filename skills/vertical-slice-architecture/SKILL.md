---
name: vertical-slice-architecture
description: Set up a reusable .NET vertical-slice API architecture with co-located HTTP use cases, domain and application boundaries, infrastructure, persistence, tests, and delivery wiring. Use when starting a project or establishing its feature template; not for adding one feature to an established project.
---

# Vertical-slice architecture

Build a working project foundation and one small reference use case that proves the flow. The reference pattern is a co-located HTTP slice using FastEndpoints for transport and validation, MediatR for dispatch, ErrorOr for expected failures, EF Core for persistence, and separate Domain, Application, Infrastructure, API, and Tests boundaries. Use the user's chosen stack or existing platform constraints when they differ; retain the architectural responsibilities rather than forcing package names.

## Discover and decide

Read the target repository's agent instructions, architecture decisions, solution/project files, deployment environment, database requirements, and test conventions. Determine whether this is a new solution or an architecture setup inside an existing solution. Preserve compatible existing structure, SDK pinning, package management, CI, and configuration. Choose the database provider, authentication model, API versioning, localization, and external integrations from actual requirements. If a choice has no requirement yet, make a small documented default that can be replaced without changing domain code.

Use [the architecture blueprint](references/blueprint.md) for the project graph, setup flow, reference slice, and acceptance checks. Create only infrastructure that the requested product can use now; mark future extension points in concise documentation instead of building unused systems.

## Deliver a working template

1. Establish the solution, project references, dependency injection composition, configuration and secret boundaries, database context and migrations, and API startup. Keep domain rules independent of web and persistence frameworks; place service contracts and shared workflows in Application; implement persistence and external adapters in Infrastructure.
2. Add a small end-to-end reference operation in `Api/Features/<Area>/<UseCase>/` (or the target's equivalent). Its transport request, endpoint, handler, and any validator/response belong together. Wire dispatch, expected-error mapping, validation, authorization policy, API documentation, and cancellation through the complete route. The reference operation should exercise a real persistence path when persistence is in scope.
3. Set up meaningful unit, integration, and HTTP contract test facilities for the chosen stack. Include a runnable build/test command and a minimal CI gate. Verify dependency injection resolves the reference handler, the route is reachable, persistence works with the real provider where it matters, and documented responses match runtime behavior.
4. Document the feature folder contract, layer ownership, registration rules, migration command, test commands, and decisions that future feature work must follow. Avoid a large generated manual or redundant sample code.

## Guardrails

- One HTTP use case is one slice. Do not duplicate a separate transport DTO and command solely to cross a layer when the API request can safely serve both roles. Keep domain behavior out of endpoints.
- Expected business failures are typed results with stable codes and mapped HTTP responses; unexpected failures use the application's exception path. Client input cannot supply trusted identity or authorization decisions.
- API endpoint/validator discovery, MediatR handler registration, service lifetimes, migrations, and test startup must be proven by execution, not assumed from compilation.
- Database migrations and deployment need a compatibility plan when an existing release may still run. Never apply a generated migration to an uncontrolled database merely to validate the template.
- This skill creates the architecture. For a new use case in a project that already follows it, use `vertical-slice-feature` if available; the feature workflow is self-contained if that skill is unavailable.
