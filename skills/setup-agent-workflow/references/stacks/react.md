# Stack: React

Detected by `react` in a `package.json` dependency list (inventory `packageJsons[].frameworks`). Next.js, Vite, React Native and Expo show up there too.

## Gate commands

Use the package manager the lockfile shows (`packageJsons[].packageManager`) and the scripts that exist (`packageJsons[].scripts`). Never name a script that isn't in `package.json`. Typical mapping:

| Gate | Script to look for (by name, or by the command it runs) | Fallback when missing |
|---|---|---|
| Lint | `lint` | none; record "no lint gate" |
| Types | `typecheck`, `type-check`, `tsc` | none when another script already runs `tsc` (often `build`); otherwise, when `tsconfig.json` exists, propose `tsc --noEmit` through the package manager's runner (`npx tsc --noEmit`, `pnpm exec tsc --noEmit`, `yarn tsc --noEmit`, `bunx tsc --noEmit`), marked **not run**. When the root `tsconfig.json` only lists `references` (the Vite default), that command checks nothing: use the form the `build` script uses (often `tsc -b`) |
| Test | `test`, `test:unit` | none; record "no test gate" |
| Build | `build` | none |
| Format | `format:check`, or another script whose command is `prettier --check` or `biome format` (`biome check` covers lint and format together) | none |

Write them the way the package manager runs a script: `npm run lint`, `pnpm run lint`, `yarn run lint`, `bun run lint`. In a monorepo (`workspaces`), name the root scripts or the workspace filter the README uses.

A `test` script that starts a watcher (a bare `vitest`, or Jest with `--watch`) never exits in an agent run. Name the one-shot script the project has (`test:run`, `test:ci`); when there is none, propose the one-shot form (`vitest run`; `jest` without `--watch`; `CI=true` for `react-scripts test`) marked **not run**, and say so in the findings.

Report a gate that will fail as it stands, without fixing it: for example, a `lint` script with no ESLint config. That goes in the findings and the **Current state** line.

## Skills

- `react-architecture` while writing or changing React code; `react-architecture-audit` for a read-only structure report; `react-structural-migration` only for an approved migration.
- Other installed React skills (for example a lint/diagnostics skill) may be named in `CLAUDE.md` when their description fits the review step.

## Candidate conventions

**Include a rule only when the code already follows it or the user approves adding it.** Name the real folders.

- **Feature folders.** Where features live (`src/features/<feature>/`), what each contains, and the public entry (`index.ts`) other features import from; no deep imports across features, except a deliberate lazy import of a screen file for route-level code splitting where the project follows `react-architecture`, which allows it.
- **Components.** One exported component per file; screens/pages compose feature components and hold no data fetching beyond the project's pattern.
- **Logic and data.** Business logic in hooks, API calls in a service or query layer, using the data library already in use (TanStack Query, RTK Query, SWR…); no second one.
- **State.** Where shared state lives (context, Zustand, Redux Toolkit), and when local state is enough.
- **Types.** No `any` without a reason in a comment; API types generated or hand-written, as the project does.
- **Styling.** The one styling system in use (Tailwind, CSS modules, styled-components) and its token source.
- **Accessibility.** Interactive elements are real buttons/links with labels; forms have labels.
- **Tests.** The test runner and where tests live; test behavior through the rendered UI.
