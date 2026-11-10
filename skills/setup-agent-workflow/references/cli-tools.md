# CLI tools

How to read the inventory's `tools` section, which tools a workflow needs, and how to install a missing one. Never install a tool without the user's explicit approval, and never install every coding-agent CLI by default.

## Statuses

| Field | Values | Meaning |
|---|---|---|
| `status` | `installed` | Found on `PATH` outside the repo, and `<tool> --version` printed a version |
| | `missing` | Not on `PATH` |
| | `present-unverified` | On `PATH`, but the version probe failed, was skipped (`--no-probe`), or the executable sits inside the repository (never executed) |
| `auth` | `not-checked` | The tool needs an account; the inventory never checks sign-in. Treat it as unknown until a command that needs it succeeds |
| | `not-applicable` | No account needed |
| `role` | `required` / `recommended` / `optional` | For this project, with the `reason` the inventory gives |
| `notes` | | Probe failures and version minimums (for example Node below 22.20 for the skills CLI) |

A dependency is **unsupported** when the host agent isn't in its `supportedAgents` (for example `dotnet-claude-kit` under Codex) or a version minimum isn't met (for example Codex below 0.121.0 for the .NET plugins).

Presence is not usability. Before relying on an account-bound tool (`gh`, any coding-agent CLI), run its own read-only check after the user agrees, for example `gh auth status`, and report the result.

## Roles

- **Required:** `git`; `dotnet` for a .NET project; `node`/`npm`/`npx` when the project's gates run through package scripts.
- **Recommended:** `node` and `npx` otherwise (they run the inventory and the skills CLI); `gh` with a GitHub remote; `glab` with a GitLab remote.
- **Optional:** coding-agent CLIs (`claude`, `codex`, `copilot`, `gemini`, `opencode`). They matter only as implementers when the user selects external delegation, and an installed CLI is never used just because it is there.

## Install guidance

Show only the rows for missing tools that matter, and only the user's platform (`platform` in the inventory: `win32`, `darwin`, `linux`). The commands are as published by each vendor and package manager (checked 2026-11-10); the link is the authority if they differ.

| Tool | Windows | macOS | Linux | Official page |
|---|---|---|---|---|
| git | `winget install --id Git.Git -e` | `brew install git` | the distribution package (`sudo apt install git`, `sudo dnf install git`) | https://git-scm.com/downloads |
| Node.js (22.20+ for the skills CLI) | `winget install --id OpenJS.NodeJS.LTS -e` | `brew install node` | a version manager or the distribution page | https://nodejs.org/en/download |
| GitHub CLI | `winget install --id GitHub.cli -e` | `brew install gh` | see the official Linux instructions | https://github.com/cli/cli#installation |
| .NET SDK (version from `global.json`) | `winget install --id Microsoft.DotNet.SDK.10 -e` | `brew install --cask dotnet-sdk` | see the official Linux instructions | https://learn.microsoft.com/dotnet/core/install/ |
| Claude Code | `irm https://claude.ai/install.ps1 \| iex` or `winget install Anthropic.ClaudeCode` | `curl -fsSL https://claude.ai/install.sh \| bash` or `brew install --cask claude-code` | `curl -fsSL https://claude.ai/install.sh \| bash` | https://code.claude.com/docs/en/setup |
| Codex CLI | `npm install -g @openai/codex` | `brew install --cask codex` or `npm install -g @openai/codex` | `curl -fsSL https://chatgpt.com/codex/install.sh \| sh` or `npm install -g @openai/codex` | https://github.com/openai/codex |
| GitHub Copilot CLI (needs a Copilot plan; PowerShell 6+ on Windows) | `winget install GitHub.Copilot` | `brew install copilot-cli` | `curl -fsSL https://gh.io/copilot-install \| bash` | https://github.com/github/copilot-cli |
| Gemini CLI | `npm install -g @google/gemini-cli` | `brew install gemini-cli` | `npm install -g @google/gemini-cli` | https://github.com/google-gemini/gemini-cli |
| OpenCode | `npm i -g @opencode/cli@latest` | `brew install opencode` | `curl -fsSL https://opencode.ai/v2/install \| bash` | https://github.com/sst/opencode |

After an install, open a new terminal (so `PATH` refreshes), run the inventory again and use its result. Signing in (`gh auth login`, `codex login`, running `claude` the first time) is interactive: the user does it.
