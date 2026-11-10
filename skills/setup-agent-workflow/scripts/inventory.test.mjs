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

function fakeExecutable(dir, name, { output = "", exitCode = 0, marker = null } = {}) {
  if (isWindows) {
    const lines = ["@echo off"];

    if (marker)
      lines.push(`echo ran> "${marker}"`);
    if (output)
      lines.push(`echo ${output}`);

    lines.push(`exit /b ${exitCode}`);
    write(path.join(dir, `${name}.cmd`), `${lines.join("\r\n")}\r\n`);
    return;
  }

  const lines = ["#!/bin/sh"];

  if (marker)
    lines.push(`echo ran > "${marker}"`);
  if (output)
    lines.push(`echo "${output}"`);

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

function inventory(args) {
  const result = spawnSync(process.execPath, [INVENTORY, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
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
  const gitCheck = spawnSync("git", ["--version"], { encoding: "utf8" });

  if (gitCheck.status !== 0) {
    t.skip("git is not available");
    return;
  }

  const home = tempDir(t, "home");
  const repo = tempDir(t, "repo");
  const runGit = (...gitArgs) => execFileSync("git", gitArgs, { cwd: repo, stdio: "ignore" });
  write(path.join(repo, "AGENTS.md"), "# Agents\n");
  write(path.join(repo, "CLAUDE.md"), "@AGENTS.md\n");
  runGit("init", "-q");
  runGit("add", "-A");
  runGit("-c", "user.email=test@example.com", "-c", "user.name=test", "commit", "-qm", "init");
  fs.rmSync(path.join(repo, "AGENTS.md"));

  const report = inventory(["--cwd", repo, "--home", home]);

  assert.deepEqual(
    { exists: report.agentFiles["AGENTS.md"].exists, tracked: report.agentFiles["AGENTS.md"].tracked, gitStatus: report.agentFiles["AGENTS.md"].gitStatus },
    { exists: false, tracked: true, gitStatus: "D" },
  );
  assert.equal(report.agentFiles["CLAUDE.md"].gitStatus, "clean");
  assert.deepEqual(report.agentFiles["CLAUDE.md"].imports, ["@AGENTS.md"]);
  assert.equal(report.git.dirty, true);
});
