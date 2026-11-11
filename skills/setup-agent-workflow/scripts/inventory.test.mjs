// Run with: node --test skills/setup-agent-workflow/scripts/inventory.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const INVENTORY = path.join(path.dirname(fileURLToPath(import.meta.url)), "inventory.mjs");
const isWindows = process.platform === "win32";

function tempDir(t, name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `saw-${name}-`));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function fakeExecutable(dir, name, { output = "", errorOutput = "", exitCode = 0, marker = null } = {}) {
  if (isWindows) {
    const lines = ["@echo off"];

    if (marker)
      lines.push(`echo ran> "${marker}"`);
    if (output)
      lines.push(`echo ${output}`);
    if (errorOutput)
      lines.push(`echo ${errorOutput} 1>&2`);

    lines.push(`exit /b ${exitCode}`);
    write(path.join(dir, `${name}.cmd`), `${lines.join("\r\n")}\r\n`);
    return;
  }

  const lines = ["#!/bin/sh"];

  if (marker)
    lines.push(`echo ran > "${marker}"`);
  if (output)
    lines.push(`echo "${output}"`);
  if (errorOutput)
    lines.push(`echo "${errorOutput}" >&2`);

  lines.push(`exit ${exitCode}`);
  write(path.join(dir, name), `${lines.join("\n")}\n`);
  fs.chmodSync(path.join(dir, name), 0o755);
}

function skill(dir, name, { userOnly = false } = {}) {
  write(
    path.join(dir, name, "SKILL.md"),
    `---\nname: ${name}\ndescription: test skill\n${userOnly ? "disable-model-invocation: true\n" : ""}---\n\n# ${name}\n`,
  );
}

// The developer's own git configuration (commit signing, hooks, templates, default branch name)
// must not decide whether these tests pass.
const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: "1" };

// When the tests run from a git hook, these point git at the developer's real repository.
for (const name of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"])
  delete GIT_ENV[name];

function inventoryRaw(args, env = process.env, cwd = undefined) {
  return spawnSync(process.execPath, [INVENTORY, ...args], { encoding: "utf8", env, cwd });
}

function inventory(args, env = process.env) {
  const result = inventoryRaw(args, env);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function gitAvailable() {
  return spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;
}

// A repository with one commit, created without touching the developer's git configuration.
function gitRepo(repo, files = { "README.md": "# Test\n" }) {
  const runGit = (...gitArgs) => execFileSync("git", gitArgs, { cwd: repo, stdio: "ignore", env: GIT_ENV });

  for (const [name, content] of Object.entries(files))
    write(path.join(repo, name), content);

  runGit("init", "-q");
  runGit("add", "-A");
  runGit("-c", "user.email=test@example.com", "-c", "user.name=test", "commit", "-qm", "init");
  return runGit;
}

test("empty machine reports nothing installed and recommends without failing", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  const report = inventory(["--cwd", repo, "--home", home, "--path", ""]);

  assert.deepEqual(report.skills, {});
  assert.equal(report.git.isRepo, false);
  assert.equal(report.git.gitMissing, true);
  assert.equal(report.project.mode, "new");
  assert.deepEqual(report.delegation.available, []);

  for (const tool of Object.values(report.tools))
    assert.equal(tool.status, "missing");

  assert.equal(report.tools.git.role, "required");
  assert.equal(report.tools.codex.role, "optional");

  const matt = report.dependencies.find((d) => d.id === "matt-pocock-skills");
  assert.equal(matt.relevant, true);
  assert.ok(matt.components.every((c) => c.installedFor.length === 0));
  assert.equal(report.dependencies.find((d) => d.id === "react-doctor").relevant, false);
  assert.equal(report.dependencies.find((d) => d.id === "dotnet-skills").relevant, false);
  assert.equal(report.docs.trackerConfigured, false);
});

test("skills report the agents that can see them and the user-only flag", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  skill(path.join(home, ".claude", "skills"), "tdd");
  skill(path.join(home, ".agents", "skills"), "to-spec", { userOnly: true });
  skill(path.join(repo, ".agents", "skills"), "test-guard");

  const report = inventory(["--cwd", repo, "--home", home, "--path", ""]);

  assert.deepEqual(report.skills.tdd.agents, ["claude-code"]);
  assert.equal(report.skills.tdd.userOnly, false);
  assert.deepEqual(report.skills["to-spec"].agents, ["codex"]);
  assert.equal(report.skills["to-spec"].userOnly, true);
  assert.ok(report.skills["test-guard"].agents.includes("github-copilot"));
  assert.ok(!report.skills["test-guard"].agents.includes("claude-code"));

  const matt = report.dependencies.find((d) => d.id === "matt-pocock-skills");
  assert.deepEqual(matt.components.find((c) => c.name === "to-spec").installedFor, ["codex"]);
});

test("enabled Claude Code plugins count, disabled ones don't", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  const pluginDir = tempDir(t, "plugin");
  const disabledDir = tempDir(t, "disabled");
  skill(path.join(pluginDir, "skills"), "run-tests");
  skill(path.join(disabledDir, "skills"), "ef-core");
  write(path.join(repo, "Api", "Api.csproj"), "<Project Sdk=\"Microsoft.NET.Sdk\"></Project>");
  write(path.join(home, ".claude", "plugins", "installed_plugins.json"), JSON.stringify({
    version: 2,
    plugins: {
      "dotnet-test@dotnet-agent-skills": [{ scope: "user", installPath: pluginDir, version: "0.1.0" }],
      "dotnet-claude-kit@dotnet-claude-kit": [{ scope: "user", installPath: disabledDir, version: "0.12.0" }],
    },
  }));
  write(path.join(home, ".claude", "settings.json"), JSON.stringify({
    enabledPlugins: { "dotnet-claude-kit@dotnet-claude-kit": false },
  }));

  const report = inventory(["--cwd", repo, "--home", home, "--path", ""]);

  assert.deepEqual(report.skills["dotnet-test:run-tests"].agents, ["claude-code"]);
  assert.equal(report.skills["dotnet-claude-kit:ef-core"], undefined);
  assert.deepEqual(report.claudePlugins.map((p) => p.key), ["dotnet-test@dotnet-agent-skills"]);

  const dotnetSkills = report.dependencies.find((d) => d.id === "dotnet-skills");
  assert.deepEqual(dotnetSkills.components.find((c) => c.name === "dotnet-test").installedFor, ["claude-code"]);

  const kit = report.dependencies.find((d) => d.id === "dotnet-claude-kit");
  assert.deepEqual(kit.components.find((c) => c.name === "dotnet-claude-kit").installedFor, []);
});

test("tools are probed for a version, never assumed authenticated", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  const bin = tempDir(t, "bin");
  fakeExecutable(bin, "codex", { output: "codex-cli 9.9.9" });
  fakeExecutable(bin, "gh", { exitCode: 1 });

  const report = inventory(["--cwd", repo, "--home", home, "--path", bin]);

  assert.equal(report.tools.codex.status, "installed");
  assert.equal(report.tools.codex.version, "9.9.9");
  assert.equal(report.tools.codex.auth, "not-checked");
  assert.equal(report.tools.gh.status, "present-unverified");
  assert.match(report.tools.gh.notes[0], /version probe failed/);
  assert.equal(report.tools.node.status, "missing");
});

test("--no-probe runs nothing", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  const bin = tempDir(t, "bin");
  const marker = path.join(bin, "ran.txt");
  fakeExecutable(bin, "codex", { output: "codex-cli 9.9.9", marker });

  const report = inventory(["--cwd", repo, "--home", home, "--path", bin, "--no-probe"]);

  assert.equal(report.tools.codex.status, "present-unverified");
  assert.equal(fs.existsSync(marker), false);
});

test("executables inside the repository are never run", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  const repoBin = path.join(repo, "tools");
  const marker = path.join(repo, "ran.txt");
  fakeExecutable(repoBin, "git", { output: "git version 9.9.9", marker });
  fakeExecutable(repoBin, "codex", { output: "codex-cli 9.9.9", marker });

  const report = inventory(["--cwd", repo, "--home", home, "--path", repoBin]);

  assert.equal(fs.existsSync(marker), false);
  assert.equal(report.tools.git.status, "present-unverified");
  assert.match(report.tools.git.notes[0], /inside the repository/);
  assert.equal(report.git.isRepo, false);
});

test("an old Node is flagged for the skills CLI, and an old Codex drops .NET plugin support", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  const bin = tempDir(t, "bin");
  fakeExecutable(bin, "node", { output: "v20.11.0" });
  fakeExecutable(bin, "codex", { output: "codex-cli 0.100.0" });
  write(path.join(repo, "App", "App.csproj"), "<Project Sdk=\"Microsoft.NET.Sdk\"></Project>");

  const report = inventory(["--cwd", repo, "--home", home, "--path", bin]);

  assert.match(report.tools.node.notes.join(" "), /22\.20/);

  const dotnetSkills = report.dependencies.find((d) => d.id === "dotnet-skills");
  assert.ok(!dotnetSkills.supportedAgents.includes("codex"));
  assert.match(dotnetSkills.notes.join(" "), /0\.121\.0/);
});

test(".NET markers choose the relevant Microsoft plugins", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  write(path.join(repo, "src", "Api", "Api.csproj"), "<Project Sdk=\"Microsoft.NET.Sdk.Web\"><ItemGroup><PackageReference Include=\"Microsoft.EntityFrameworkCore\" /></ItemGroup></Project>");
  write(path.join(repo, "tests", "Api.Tests", "Api.Tests.csproj"), "<Project Sdk=\"Microsoft.NET.Sdk\"><ItemGroup><PackageReference Include=\"xunit.v3\" /></ItemGroup></Project>");
  write(path.join(repo, "global.json"), JSON.stringify({ sdk: { version: "10.0.100" }, test: { runner: "Microsoft.Testing.Platform" } }));

  const report = inventory(["--cwd", repo, "--home", home, "--path", ""]);
  const relevant = report.dependencies
    .find((d) => d.id === "dotnet-skills")
    .components.filter((c) => c.relevant)
    .map((c) => c.name);

  assert.deepEqual(relevant, ["dotnet", "dotnet-test", "dotnet-aspnetcore", "dotnet-data"]);
  assert.equal(report.dotnetProject.testRunner, "Microsoft.Testing.Platform");
  assert.equal(report.tools.dotnet.role, "required");
  assert.equal(report.dependencies.find((d) => d.id === "dotnet-claude-kit").relevant, true);
  assert.equal(report.dependencies.find((d) => d.id === "react-doctor").relevant, false);
});

test("a React project makes React Doctor and the React skills relevant", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  write(path.join(repo, "package.json"), JSON.stringify({ scripts: { lint: "eslint ." }, dependencies: { react: "^19.0.0" } }));
  write(path.join(repo, "package-lock.json"), "{}");
  write(path.join(repo, "src", "App.tsx"), "export const App = () => null;\n");

  const report = inventory(["--cwd", repo, "--home", home, "--path", ""]);

  assert.equal(report.dependencies.find((d) => d.id === "react-doctor").relevant, true);
  assert.equal(report.dependencies.find((d) => d.id === "dotnet-skills").relevant, false);

  const bravo = report.dependencies.find((d) => d.id === "bravo6dev-skills");
  assert.equal(bravo.components.find((c) => c.name === "react-architecture").relevant, true);
  assert.equal(bravo.components.find((c) => c.name === "vertical-slice-feature").relevant, false);
  assert.equal(bravo.components.find((c) => c.name === "react-structural-migration").onRequestOnly, true);
  assert.equal(report.dependencies.find((d) => d.id === "delegate-skills").onRequestOnly, true);
  assert.equal(report.tools.node.role, "required");
  assert.equal(report.packageJsons[0].packageManager, "npm");
});

test("previous decisions are read from the project workflow config", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  write(path.join(repo, "docs", "agents", "workflow-config.json"), JSON.stringify({
    version: 1,
    dependencies: { "react-doctor": { decision: "declined", date: "2026-11-10" } },
  }));

  const report = inventory(["--cwd", repo, "--home", home, "--path", ""]);

  assert.equal(report.workflowConfig.valid, true);
  assert.equal(report.dependencies.find((d) => d.id === "react-doctor").previousDecision.decision, "declined");

  write(path.join(repo, "docs", "agents", "workflow-config.json"), "{ not json");
  assert.equal(inventory(["--cwd", repo, "--home", home, "--path", ""]).workflowConfig.valid, false);
});

test("a tracked instruction file deleted from the working tree is reported", (t) => {
  if (!gitAvailable()) {
    t.skip("git is not available");
    return;
  }

  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  gitRepo(repo, { "AGENTS.md": "# Agents\n", "CLAUDE.md": "@AGENTS.md\n" });
  fs.rmSync(path.join(repo, "AGENTS.md"));

  // --no-probe: this test needs git from PATH, not a version probe of every tool on the machine.
  const report = inventory(["--cwd", repo, "--home", home, "--no-probe"], GIT_ENV);

  assert.deepEqual(
    { exists: report.agentFiles["AGENTS.md"].exists, tracked: report.agentFiles["AGENTS.md"].tracked, gitStatus: report.agentFiles["AGENTS.md"].gitStatus },
    { exists: false, tracked: true, gitStatus: "D" },
  );
  assert.equal(report.agentFiles["CLAUDE.md"].gitStatus, "clean");
  assert.deepEqual(report.agentFiles["CLAUDE.md"].imports, ["@AGENTS.md"]);
  assert.equal(report.git.dirty, true);
});

test("a mistyped --cwd or flag stops with exit code 2 instead of describing an empty project", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");

  const missing = inventoryRaw(["--cwd", path.join(repo, "no-such-folder"), "--home", home, "--path", ""]);
  assert.equal(missing.status, 2);
  assert.equal(missing.stdout, "");
  assert.match(missing.stderr, /not an existing directory/);

  const badArguments = [
    ["--cwdd", repo],
    ["--cwd"],
    ["--cwd", "--no-probe"],
    ["--cwd", ""],
    ["--cwd="],
    ["--home="],
    ["--no-probe=1"],
    [repo],
  ];

  for (const bad of badArguments) {
    const result = inventoryRaw(bad);
    assert.equal(result.status, 2, `expected exit code 2 for: ${JSON.stringify(bad)}`);
    assert.equal(result.stdout, "");
  }

  const help = inventoryRaw(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /inventory\.mjs \[--cwd/);
});

test("flags accept --key=value, and the report carries a schema version and no warnings", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  write(path.join(repo, "main.go"), "package main\n");

  const report = inventory([`--cwd=${repo}`, `--home=${home}`, "--path="]);

  assert.equal(report.cwd, path.resolve(repo));
  assert.equal(report.project.mode, "existing");
  assert.equal(report.schemaVersion, 1);
  assert.deepEqual(report.warnings, []);
});

test("credentials embedded in a remote URL never reach the report", (t) => {
  if (!gitAvailable()) {
    t.skip("git is not available");
    return;
  }

  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  const runGit = gitRepo(repo);
  // The password contains an `@`: everything before the host must go, not only up to the first one.
  runGit("remote", "add", "origin", "https://someone:not-a-real@secret@github.com/acme/app.git");

  const result = inventoryRaw(["--cwd", repo, "--home", home, "--no-probe"], GIT_ENV);

  assert.equal(result.status, 0, result.stderr);
  assert.ok(!result.stdout.includes("not-a-real"));
  assert.ok(!result.stdout.includes("secret@"));
  assert.deepEqual(JSON.parse(result.stdout).git.remotes, [
    { name: "origin", url: "https://github.com/acme/app.git", host: "github" },
  ]);
});

test("only a remote-tracking ref loses its first segment, and a subdirectory is not the root", (t) => {
  if (!gitAvailable()) {
    t.skip("git is not available");
    return;
  }

  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  const runGit = gitRepo(repo, { "README.md": "# Test\n", "packages/app/index.js": "export {};\n" });
  runGit("branch", "feature/dev");

  const local = inventory(["--cwd", repo, "--home", home, "--no-probe"], GIT_ENV);
  assert.equal(local.git.hasDev, false);
  assert.equal(local.git.cwdIsRoot, true);
  assert.equal(local.git.dirty, false);

  runGit("update-ref", "refs/remotes/origin/dev", "HEAD");

  const remote = inventory(["--cwd", repo, "--home", home, "--no-probe"], GIT_ENV);
  assert.equal(remote.git.hasDev, true);
  assert.ok(remote.git.branches.includes("origin/dev"));

  const nested = inventory(["--cwd", path.join(repo, "packages", "app"), "--home", home, "--no-probe"], GIT_ENV);
  assert.equal(nested.git.isRepo, true);
  assert.equal(nested.git.cwdIsRoot, false);
});

test("a git failure is reported, not mistaken for a folder without git", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  const bin = tempDir(t, "bin");
  fakeExecutable(bin, "git", { errorOutput: "fatal: detected dubious ownership in repository", exitCode: 128 });

  const report = inventory(["--cwd", repo, "--home", home, "--path", bin, "--no-probe"]);

  assert.equal(report.git.isRepo, false);
  assert.equal(report.git.gitMissing, undefined);
  assert.equal(typeof report.git.gitError, "string");

  // On Windows a .cmd can't be started without a shell, so the error is the spawn failure itself.
  if (!isWindows)
    assert.match(report.git.gitError, /dubious ownership/);
});

test("source deeper than the walk limit makes the mode ambiguous, not new", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  write(path.join(repo, "pom.xml"), "<project></project>");
  write(path.join(repo, "src", "main", "java", "com", "acme", "shop", "orders", "Order.java"), "class Order {}\n");

  const report = inventory(["--cwd", repo, "--home", home, "--path", ""]);

  assert.equal(report.project.sourceFiles, 0);
  assert.equal(report.project.depthLimited, true);
  assert.equal(report.project.ambiguous, true);
});

test("a repository with history but no recognised source file is ambiguous", (t) => {
  if (!gitAvailable()) {
    t.skip("git is not available");
    return;
  }

  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  const runGit = gitRepo(repo, { "schema.graphql": "type Query { ok: Boolean }\n" });

  for (let i = 0; i < 3; i++)
    runGit("-c", "user.email=test@example.com", "-c", "user.name=test", "commit", "--allow-empty", "-qm", `more ${i}`);

  const report = inventory(["--cwd", repo, "--home", home, "--no-probe"], GIT_ENV);

  assert.equal(report.git.commitCount, 4);
  assert.equal(report.project.mode, "new");
  assert.equal(report.project.depthLimited, false);
  assert.equal(report.project.ambiguous, true);
});

test("skill names that collide with Object.prototype members are ordinary skills", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  skill(path.join(repo, ".claude", "skills"), "constructor");
  skill(path.join(repo, ".claude", "skills"), "toString", { userOnly: true });
  write(path.join(repo, ".claude", "skills", "odd", "SKILL.md"), "---\nname: __proto__\ndescription: test skill\n---\n");

  const report = inventory(["--cwd", repo, "--home", home, "--path", ""]);

  assert.deepEqual(Object.keys(report.skills).sort(), ["__proto__", "constructor", "toString"]);
  assert.deepEqual(report.skills.constructor.agents, ["claude-code"]);
  assert.equal(report.skills.toString.userOnly, true);
});

test("frontmatter is read from a file with a byte-order mark and CRLF line endings", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  write(
    path.join(home, ".claude", "skills", "folder-name", "SKILL.md"),
    "\uFEFF---\r\nname: with-bom\r\ndescription: test skill\r\ndisable-model-invocation: true\r\n---\r\n\r\n# with-bom\r\n",
  );

  const report = inventory(["--cwd", repo, "--home", home, "--path", ""]);

  assert.deepEqual(Object.keys(report.skills), ["with-bom"]);
  assert.equal(report.skills["with-bom"].userOnly, true);
});

test("a project named like a test framework is not a test project, and .vbproj is .NET", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  write(
    path.join(repo, "Api", "Api.csproj"),
    "<Project Sdk=\"Microsoft.NET.Sdk\"><ItemGroup><ProjectReference Include=\"..\\Crm.Opportunities\\Crm.Opportunities.csproj\" /></ItemGroup></Project>",
  );

  const report = inventory(["--cwd", repo, "--home", home, "--path", ""]);

  assert.equal(report.dotnetProject.markers.tests, false);
  assert.equal(
    report.dependencies.find((d) => d.id === "dotnet-skills").components.find((c) => c.name === "dotnet-test").relevant,
    false,
  );

  const legacy = tempDir(t, "legacy");
  write(path.join(legacy, "Legacy", "Legacy.vbproj"), "<Project Sdk=\"Microsoft.NET.Sdk\"></Project>");

  assert.deepEqual(inventory(["--cwd", legacy, "--home", home, "--path", ""]).stacks.map((s) => s.id), ["dotnet"]);
});

test("headings and imports inside a fenced code block are not counted", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  write(
    path.join(repo, "AGENTS.md"),
    "# Agents\n\n```bash\n# not a heading\n@not-an-import\n```\n\n## Commands\n\n@docs/agents/workflow.md\n",
  );

  const report = inventory(["--cwd", repo, "--home", home, "--path", ""]);

  assert.deepEqual(report.agentFiles["AGENTS.md"].headings, ["# Agents", "## Commands"]);
  assert.deepEqual(report.agentFiles["AGENTS.md"].imports, ["@docs/agents/workflow.md"]);
});

test("a workspace package takes the root lock file, and peerDependencies count", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  write(path.join(repo, "package.json"), JSON.stringify({ name: "root", private: true, workspaces: ["packages/*"] }));
  write(path.join(repo, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  write(
    path.join(repo, "packages", "ui", "package.json"),
    JSON.stringify({ name: "ui", scripts: { build: "tsc" }, peerDependencies: { react: "^19.0.0" } }),
  );

  const report = inventory(["--cwd", repo, "--home", home, "--path", ""]);

  assert.deepEqual(report.packageJsons.map((p) => p.path), ["package.json", "packages/ui/package.json"]);

  const ui = report.packageJsons.find((p) => p.name === "ui");
  assert.equal(ui.packageManager, "pnpm");
  assert.deepEqual(ui.frameworks, ["react"]);
  assert.ok(report.stacks.some((s) => s.id === "react"));
});

test("malformed manifests and plugin records are described as empty, not fatal", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  write(path.join(repo, "package.json"), "[1, 2, 3]");
  write(path.join(repo, "a", "package.json"), "\"just a string\"");
  write(path.join(repo, "b", "package.json"), JSON.stringify({ name: 7, dependencies: "react", scripts: null, peerDependencies: [] }));
  write(path.join(repo, "c", "package.json"), "{ not json");
  write(path.join(home, ".claude", "plugins", "installed_plugins.json"), JSON.stringify({
    plugins: { "broken@somewhere": [null, "text", { scope: "user", installPath: 42 }], "list@somewhere": "not a list" },
  }));
  write(path.join(home, ".claude", "settings.json"), JSON.stringify({ enabledPlugins: ["not", "an", "object"] }));

  const report = inventory(["--cwd", repo, "--home", home, "--path", ""]);

  assert.deepEqual(report.packageJsons.map((p) => p.path), ["a/package.json", "b/package.json", "c/package.json", "package.json"]);

  for (const pkg of report.packageJsons) {
    assert.equal(pkg.name, null);
    assert.deepEqual(pkg.scripts, {});
    assert.deepEqual(pkg.frameworks, []);
  }

  assert.deepEqual(report.skills, {});
  assert.deepEqual(report.claudePlugins.map((p) => p.key), ["broken@somewhere"]);

  const installedPlugins = path.join(home, ".claude", "plugins", "installed_plugins.json");
  write(installedPlugins, JSON.stringify({ plugins: [] }));
  assert.deepEqual(inventory(["--cwd", repo, "--home", home, "--path", ""]).claudePlugins, []);
});

test("a package's own packageManager field wins over a lock file in a parent directory", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  write(path.join(repo, "package.json"), JSON.stringify({ name: "root" }));
  write(path.join(repo, "yarn.lock"), "");
  write(path.join(repo, "tools", "cli", "package.json"), JSON.stringify({ name: "cli", packageManager: "pnpm@9.1.0" }));

  const report = inventory(["--cwd", repo, "--home", home, "--path", ""]);

  assert.equal(report.packageJsons.find((p) => p.name === "root").packageManager, "yarn");
  assert.equal(report.packageJsons.find((p) => p.name === "cli").packageManager, "pnpm");
});

test("a project built on the MSTest SDK is a test project, and a tilde fence hides its content", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  write(path.join(repo, "Tests", "Tests.csproj"), "<Project Sdk='MSTest.Sdk/3.6.0'></Project>");
  write(path.join(repo, "AGENTS.md"), "# Agents\n\n~~~~\n# inside\n```\n@still-inside\n~~~~\n\n## After\n");

  const report = inventory(["--cwd", repo, "--home", home, "--path", ""]);

  assert.equal(report.dotnetProject.markers.tests, true);
  assert.deepEqual(report.agentFiles["AGENTS.md"].headings, ["# Agents", "## After"]);
  assert.deepEqual(report.agentFiles["AGENTS.md"].imports, []);
});

test("a PATH entry that links into the repository is not executed", { skip: isWindows }, (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  const bin = tempDir(t, "bin");
  const marker = path.join(repo, "ran.txt");
  fakeExecutable(path.join(repo, "tools"), "codex", { output: "codex-cli 9.9.9", marker });
  fs.symlinkSync(path.join(repo, "tools", "codex"), path.join(bin, "codex"));

  const report = inventory(["--cwd", repo, "--home", home, "--path", bin]);

  assert.equal(fs.existsSync(marker), false);
  assert.equal(report.tools.codex.status, "present-unverified");
  assert.match(report.tools.codex.notes[0], /inside the repository/);
});

test("project settings decide which plugins are enabled, and a plugin without an install path is not scanned", (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  const pluginDir = tempDir(t, "plugin");
  const startDir = tempDir(t, "start");
  skill(path.join(pluginDir, "skills"), "run-tests");
  skill(path.join(startDir, "skills"), "stray");
  write(path.join(home, ".claude", "plugins", "installed_plugins.json"), JSON.stringify({
    version: 2,
    plugins: {
      "dotnet-test@dotnet-agent-skills": [{ scope: "user", installPath: pluginDir, version: "0.1.0" }],
      "ghost@somewhere": [{ scope: "user", version: "0.1.0" }],
    },
  }));

  const before = inventoryRaw(["--cwd", repo, "--home", home, "--path", ""], process.env, startDir);
  assert.equal(before.status, 0, before.stderr);
  assert.deepEqual(Object.keys(JSON.parse(before.stdout).skills), ["dotnet-test:run-tests"]);

  write(path.join(repo, ".claude", "settings.json"), JSON.stringify({
    enabledPlugins: { "dotnet-test@dotnet-agent-skills": false },
  }));
  assert.deepEqual(Object.keys(inventory(["--cwd", repo, "--home", home, "--path", ""]).skills), []);

  write(path.join(repo, ".claude", "settings.local.json"), JSON.stringify({
    enabledPlugins: { "dotnet-test@dotnet-agent-skills": true },
  }));
  assert.deepEqual(Object.keys(inventory(["--cwd", repo, "--home", home, "--path", ""]).skills), ["dotnet-test:run-tests"]);
});

test("CLAUDE_CONFIG_DIR is where user-level Claude Code skills live, unless --home simulates another machine", (t) => {
  const home = tempDir(t, "home");
  const configDir = tempDir(t, "claude-config");
  const repo = tempDir(t, "repo");
  skill(path.join(configDir, "skills"), "from-config-dir");
  const env = { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: configDir };

  const report = inventory(["--cwd", repo, "--path", ""], env);
  assert.deepEqual(report.skills["from-config-dir"].agents, ["claude-code"]);

  assert.deepEqual(inventory(["--cwd", repo, "--home", home, "--path", ""], env).skills, {});
});

test("a directory that can't be read is reported as a warning", { skip: isWindows || process.getuid?.() === 0 }, (t) => {
  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  const workflows = path.join(repo, ".github", "workflows");
  write(path.join(workflows, "ci.yml"), "name: ci\n");
  fs.chmodSync(workflows, 0o000);

  let report;

  try {
    report = inventory(["--cwd", repo, "--home", home, "--path", ""]);
  } finally {
    // Restored before the temp directory is removed.
    fs.chmodSync(workflows, 0o755);
  }

  assert.deepEqual(report.ci, []);
  assert.ok(report.warnings.some((warning) => warning.includes("workflows")));
});
