# Stack: any other

For stacks without their own reference (Flutter, Python, Go, Rust, JVM, Node services…), and for the parts of a known stack the reference doesn't cover.

## Finding the gate commands

Look in this order and use the first source that has them:

1. `README.md` sections on building, testing, contributing.
2. CI files from the inventory (`ci`): the `run:` / `script:` steps are the commands the team trusts.
3. Task runners: `Makefile`, `justfile`, `Taskfile.yml`, `package.json` scripts.
4. Only when none exist, propose the stack's usual commands and mark them **not run**:

| Stack | Format | Lint/analyze | Test | Build |
|---|---|---|---|---|
| Flutter/Dart | `dart format --set-exit-if-changed .` | `flutter analyze` | `flutter test` | `flutter build <target>` |
| Python | `ruff format --check .` | `ruff check .` | `pytest` | — |
| Go | `gofmt -l .` (must print nothing) | `go vet ./...` | `go test ./...` | `go build ./...` |
| Rust | `cargo fmt --check` | `cargo clippy -- -D warnings` | `cargo test` | `cargo build` |
| JVM | the build's format plugin | the build's lint plugin | `./mvnw test` / `./gradlew test` | `./mvnw package` / `./gradlew build` |

Never run a command to verify it without the user's approval. Builds can download packages and tests can need services.

## Finding the conventions

1. **Enforced by tools:** formatter and linter configs (`.editorconfig`, `analysis_options.yaml`, `ruff.toml`, `.golangci.yml`, `rustfmt.toml`, ESLint/Biome configs). Write one line naming them and the fix command; don't restate their rules.
2. **Judgment rules:** read two or three comparable features end to end. Write a rule only for a pattern that repeats and that a tool can't check: folder and naming per use case, where validation happens, how errors flow to the caller, how access is checked, what must never be logged.
3. **Recorded decisions:** ADRs and architecture docs win over anything inferred from code. If the code contradicts them, report it instead of choosing.
4. Commit style comes from `git.recentCommitSubjects`, and the branch model from `git.branches`.

Aim for 5–12 judgment rules. A rule the team doesn't follow yet is a proposal: show it separately and add it only with approval.
