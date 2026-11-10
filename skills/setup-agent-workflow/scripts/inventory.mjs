#!/usr/bin/env node
// Read-only inventory for setup-agent-workflow. Prints one JSON object to stdout.
//
// Safety contract: never writes files, never installs, never authenticates, never touches the
// network, never runs project scripts. The only processes it starts are read-only git queries and
// `<tool> --version` probes of executables resolved from PATH outside the repository, run from a
// neutral directory with a timeout.
//
// Usage: node inventory.mjs [--cwd <repo>] [--home <dir>] [--path <PATH string>] [--no-probe]
//   --home and --path simulate another machine in tests; --no-probe skips the version probes.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log("node inventory.mjs [--cwd <repo>] [--home <dir>] [--path <PATH string>] [--no-probe]");
  process.exit(0);
}

const cwd = path.resolve(args.cwd ?? process.cwd());
const home = path.resolve(args.home ?? os.homedir());
const searchPath = typeof args.path === "string" ? args.path : process.env.PATH ?? "";
const probe = !args["no-probe"];
const isWindows = process.platform === "win32";

const IGNORED_DIRS = new Set([
  ".git", "node_modules", "bin", "obj", "dist", "build", "out", ".next", ".nuxt", ".dart_tool",
  ".venv", "venv", "__pycache__", "vendor", "target", "TestResults", ".idea", ".vs", ".vscode",
  "coverage", ".scratch", ".gradle", "Pods", ".turbo", ".cache",
]);
const SOURCE_EXTENSIONS = new Set([
  ".cs", ".fs", ".vb", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".dart",
  ".py", ".go", ".java", ".kt", ".kts", ".rs", ".rb", ".php", ".swift", ".c", ".cc", ".cpp", ".h",
  ".hpp", ".scala", ".ex", ".exs",
]);
const MANIFEST_NAMES = new Set([
  "package.json", "pubspec.yaml", "pyproject.toml", "requirements.txt", "go.mod", "Cargo.toml",
  "pom.xml", "build.gradle", "build.gradle.kts", "global.json", "Directory.Build.props",
  "Directory.Packages.props", "Makefile", "justfile", "Taskfile.yml", "compose.yaml",
  "docker-compose.yml", "Dockerfile", ".editorconfig", "tsconfig.json", "biome.json",
  "eslint.config.js", "eslint.config.mjs", ".eslintrc.json", ".eslintrc.js", ".prettierrc",
  "prettier.config.js", "ruff.toml", "analysis_options.yaml", "dotnet-tools.json",
]);
const MANIFEST_EXTENSIONS = new Set([".sln", ".slnx", ".csproj", ".fsproj"]);
const MAX_ENTRIES = 20000;
const MAX_DEPTH = 6;

// Where each agent reads skills, per the skills CLI agents table (vercel-labs/skills docs/agents.md).
const SKILL_LOCATIONS = [
  { scope: "user:.claude", dir: () => path.join(home, ".claude", "skills"), agents: ["claude-code"] },
  { scope: "user:.agents", dir: () => path.join(home, ".agents", "skills"), agents: ["codex"] },
  { scope: "user:.codex", dir: () => path.join(home, ".codex", "skills"), agents: ["codex"] },
  { scope: "user:.cursor", dir: () => path.join(home, ".cursor", "skills"), agents: ["cursor"] },
  { scope: "user:.config/opencode", dir: () => path.join(home, ".config", "opencode", "skills"), agents: ["opencode"] },
  { scope: "user:.copilot", dir: () => path.join(home, ".copilot", "skills"), agents: ["github-copilot"] },
  { scope: "user:.gemini", dir: () => path.join(home, ".gemini", "skills"), agents: ["gemini-cli"] },
  { scope: "project:.claude", dir: () => path.join(cwd, ".claude", "skills"), agents: ["claude-code"] },
  { scope: "project:.agents", dir: () => path.join(cwd, ".agents", "skills"), agents: ["codex", "cursor", "opencode", "github-copilot", "gemini-cli"] },
];

const TOOL_SPECS = [
  { name: "git", needsAuth: false },
  { name: "node", needsAuth: false },
  { name: "npm", needsAuth: false },
  { name: "npx", needsAuth: false },
  { name: "gh", needsAuth: true },
  { name: "glab", needsAuth: true },
  { name: "dotnet", needsAuth: false },
  { name: "claude", needsAuth: true, agent: "claude-code" },
  { name: "codex", needsAuth: true, agent: "codex" },
  { name: "copilot", needsAuth: true, agent: "github-copilot" },
  { name: "gemini", needsAuth: true, agent: "gemini-cli" },
  { name: "opencode", needsAuth: true, agent: "opencode" },
];

const DELEGATE_CLIS = {
  "aider-delegate": "aider",
  "agy-delegate": "agy",
  "claude-delegate": "claude",
  "cline-delegate": "cline",
  "codex-delegate": "codex",
  "commandcode-delegate": isWindows ? "cmdc" : "cmd",
  "copilot-delegate": "copilot",
  "cursor-delegate": "cursor-agent",
  "grok-delegate": "grok",
  "kimi-delegate": "kimi",
  "mcode-delegate": "mcode",
  "muse-delegate": "muse",
  "omp-delegate": "omp",
  "opencode-delegate": "opencode",
  "pi-delegate": "pi",
  "qoder-delegate": "qodercli",
  "vibe-delegate": "vibe",
  "warp-delegate": "oz",
  "zcode-delegate": "zcode",
};

const WORKFLOW_CONFIG = "docs/agents/workflow-config.json";

const gitPath = which("git");
const tree = walk(cwd);
const stacks = detectStacks(tree);
const gitReport = gitInfo();
const skills = findSkills();
const claudePlugins = findClaudePlugins();
const dotnetProject = describeDotnet(tree);
const workflowConfig = readWorkflowConfig();
const tools = describeTools(stacks, gitReport);

const report = {
  cwd,
  home,
  platform: process.platform,
  generatedAt: new Date().toISOString(),
  hostHints: hostHints(),
  git: gitReport,
  project: projectMode(tree),
  stacks,
  dotnetProject,
  packageJsons: tree.packageJsons,
  manifests: tree.manifests,
  ci: findCi(),
  agentFiles: findAgentFiles(),
  docs: findDocs(),
  workflowConfig,
  skills,
  claudePlugins,
  tools,
  delegation: delegationSummary(skills),
  dependencies: describeDependencies(),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

function parseArgs(argv) {
  const out = {};

  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];

    if (!key.startsWith("--"))
      continue;

    const next = argv[i + 1];

    if (next === undefined || next.startsWith("--")) {
      out[key.slice(2)] = true;
    } else {
      out[key.slice(2)] = next;
      i++;
    }
  }

  return out;
}

function rel(p) {
  return path.relative(cwd, p).split(path.sep).join("/");
}

function exists(p) {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function readText(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function readJson(p) {
  const text = readText(p);

  if (text === null)
    return null;

  try {
    return JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    return null;
  }
}

function isInside(child, parent) {
  const relative = path.relative(parent.toLowerCase(), child.toLowerCase());
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function which(command) {
  const extensions = isWindows
    ? [...(process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").toLowerCase().split(";").filter(Boolean), ""]
    : [""];

  for (const dir of searchPath.split(path.delimiter)) {
    if (!dir)
      continue;

    for (const ext of extensions) {
      const candidate = path.join(dir, command + ext);

      try {
        if (fs.statSync(candidate).isFile())
          return candidate;
      } catch {
        // Not in this PATH entry; keep looking.
      }
    }
  }

  return null;
}

function git(...gitArgs) {
  if (!gitPath || isInside(gitPath, cwd))
    return null;

  try {
    return execFileSync(gitPath, gitArgs, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
      timeout: 15000,
    }).trim();
  } catch {
    return null;
  }
}

function gitInfo() {
  if (!gitPath)
    return { isRepo: false, gitMissing: true };

  if (git("rev-parse", "--is-inside-work-tree") !== "true")
    return { isRepo: false };

  const remotes = (git("remote", "-v") ?? "")
    .split(/\r?\n/)
    .filter((line) => line.endsWith("(fetch)"))
    .map((line) => {
      const [name, url] = line.split(/\s+/);
      return { name, url, host: hostOf(url) };
    });
  const branches = (git("for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes") ?? "")
    .split(/\r?\n/)
    .filter((ref) => ref && !/^refs\/remotes\/[^/]+\/HEAD$/.test(ref))
    .map((ref) => ref.replace(/^refs\/(heads|remotes)\//, ""));
  const branchNames = new Set(branches.map((b) => b.replace(/^[^/]+\//, "")));

  return {
    isRepo: true,
    root: git("rev-parse", "--show-toplevel"),
    currentBranch: git("branch", "--show-current"),
    remotes,
    branches,
    hasMain: branchNames.has("main"),
    hasMaster: branchNames.has("master"),
    hasDev: branchNames.has("dev") || branchNames.has("develop"),
    commitCount: Number.parseInt(git("rev-list", "--count", "HEAD") ?? "0", 10) || 0,
    recentCommitSubjects: (git("log", "-15", "--format=%s") ?? "").split(/\r?\n/).filter(Boolean),
    dirty: (git("status", "--porcelain") ?? "").length > 0,
  };
}

function hostOf(url) {
  if (!url)
    return null;
  if (/github\.com[:/]/i.test(url))
    return "github";
  if (/gitlab/i.test(url))
    return "gitlab";
  if (/bitbucket/i.test(url))
    return "bitbucket";
  if (/dev\.azure\.com|visualstudio\.com/i.test(url))
    return "azure-devops";
  return "other";
}

function hostHints() {
  // Only signals known to be set by the host itself. The running agent's own knowledge of what
  // it is outranks this guess.
  if (process.env.CLAUDECODE === "1")
    return { guess: "claude-code", evidence: "CLAUDECODE=1" };

  return { guess: null, evidence: null };
}

function walk(root) {
  const result = { sourceFiles: 0, sourceByExtension: {}, manifests: [], packageJsons: [], truncated: false };
  let seen = 0;
  const stack = [{ dir: root, depth: 0 }];

  while (stack.length > 0) {
    const { dir, depth } = stack.pop();
    let entries;

    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (++seen > MAX_ENTRIES) {
        result.truncated = true;
        return result;
      }

      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && depth < MAX_DEPTH)
          stack.push({ dir: full, depth: depth + 1 });
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();

      if (SOURCE_EXTENSIONS.has(ext)) {
        result.sourceFiles++;
        result.sourceByExtension[ext] = (result.sourceByExtension[ext] ?? 0) + 1;
      }

      if (MANIFEST_NAMES.has(entry.name) || MANIFEST_EXTENSIONS.has(ext))
        result.manifests.push(rel(full));

      if (entry.name === "package.json")
        result.packageJsons.push(describePackageJson(full));
    }
  }

  return result;
}

function describePackageJson(file) {
  const pkg = readJson(file) ?? {};
  const dir = path.dirname(file);
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const lockfiles = {
    "pnpm-lock.yaml": "pnpm",
    "yarn.lock": "yarn",
    "bun.lockb": "bun",
    "bun.lock": "bun",
    "package-lock.json": "npm",
  };
  const packageManager = Object.entries(lockfiles).find(([lock]) => exists(path.join(dir, lock)))?.[1]
    ?? (typeof pkg.packageManager === "string" ? pkg.packageManager.split("@")[0] : null);
  const frameworks = ["react", "next", "vite", "react-native", "expo", "vue", "svelte", "@angular/core", "express", "@nestjs/core", "vitest", "jest", "@playwright/test", "typescript"]
    .filter((name) => name in deps);

  return {
    path: rel(file),
    name: pkg.name ?? null,
    packageManager,
    scripts: pkg.scripts ?? {},
    frameworks,
    workspaces: Boolean(pkg.workspaces),
  };
}

function detectStacks(t) {
  const stacksFound = [];
  const has = (predicate) => t.manifests.filter(predicate);
  const dotnet = has((m) => /\.(sln|slnx|csproj|fsproj)$/i.test(m));

  if (dotnet.length > 0)
    stacksFound.push({ id: "dotnet", evidence: dotnet.slice(0, 8) });

  const react = t.packageJsons.filter((p) => p.frameworks.includes("react"));

  if (react.length > 0)
    stacksFound.push({ id: "react", evidence: react.map((p) => `${p.path} (${p.frameworks.join(", ")})`) });

  const otherNode = t.packageJsons.filter((p) => !p.frameworks.includes("react") && Object.keys(p.scripts).length > 0);

  if (otherNode.length > 0)
    stacksFound.push({ id: "node", evidence: otherNode.map((p) => `${p.path} (${p.frameworks.join(", ") || "no framework"})`) });

  const pubspecs = has((m) => m.endsWith("pubspec.yaml"));

  if (pubspecs.length > 0) {
    const flutter = pubspecs.some((m) => /\bflutter:/.test(readText(path.join(cwd, m)) ?? ""));
    stacksFound.push({ id: flutter ? "flutter" : "dart", evidence: pubspecs });
  }

  const simple = [
    ["python", (m) => /(^|\/)(pyproject\.toml|requirements\.txt)$/.test(m)],
    ["go", (m) => /(^|\/)go\.mod$/.test(m)],
    ["rust", (m) => /(^|\/)Cargo\.toml$/.test(m)],
    ["jvm", (m) => /(^|\/)(pom\.xml|build\.gradle(\.kts)?)$/.test(m)],
  ];

  for (const [id, predicate] of simple) {
    const evidence = has(predicate);

    if (evidence.length > 0)
      stacksFound.push({ id, evidence: evidence.slice(0, 8) });
  }

  return stacksFound;
}

function describeDotnet(t) {
  const files = t.manifests.filter((m) => /\.(csproj|fsproj)$|(^|\/)Directory\.(Build|Packages)\.props$/i.test(m));

  if (files.length === 0)
    return null;

  const text = files.map((m) => readText(path.join(cwd, m)) ?? "").join("\n");
  const globalJson = readJson(path.join(cwd, "global.json"));
  const markers = {
    aspnetcore: /Sdk="Microsoft\.NET\.Sdk\.Web"|Microsoft\.AspNetCore\./.test(text),
    efCore: /Microsoft\.EntityFrameworkCore/.test(text),
    tests: /Microsoft\.NET\.Test\.Sdk|xunit|MSTest|NUnit|TUnit/i.test(text),
    blazor: /Sdk="Microsoft\.NET\.Sdk\.BlazorWebAssembly"|Microsoft\.AspNetCore\.Components/.test(text),
    maui: /<UseMaui>\s*true/i.test(text),
    winforms: /<UseWindowsForms>\s*true/i.test(text),
    wpf: /<UseWPF>\s*true/i.test(text),
  };

  return {
    projectFiles: files.filter((m) => /proj$/i.test(m)).length,
    sdkPinned: globalJson?.sdk?.version ?? null,
    testRunner: globalJson?.test?.runner ?? null,
    markers,
  };
}

function projectMode(t) {
  const commitCount = gitReport.commitCount ?? 0;
  const mode = t.sourceFiles === 0 ? "new" : "existing";

  return {
    mode,
    ambiguous: t.sourceFiles > 0 && t.sourceFiles < 10 && commitCount <= 3,
    sourceFiles: t.sourceFiles,
    sourceByExtension: t.sourceByExtension,
    walkTruncated: t.truncated,
  };
}

function findCi() {
  const found = [];
  const workflows = path.join(cwd, ".github", "workflows");

  if (isDir(workflows)) {
    for (const name of fs.readdirSync(workflows)) {
      if (/\.ya?ml$/i.test(name))
        found.push(`.github/workflows/${name}`);
    }
  }

  for (const candidate of [".gitlab-ci.yml", "azure-pipelines.yml", "Jenkinsfile", ".circleci/config.yml", "bitbucket-pipelines.yml"]) {
    if (exists(path.join(cwd, candidate)))
      found.push(candidate);
  }

  return found;
}

function describeMarkdown(file) {
  const text = readText(file);

  if (text === null)
    return { exists: false };

  const lines = text.split(/\r?\n/);

  return {
    exists: true,
    lines: lines.length,
    headings: lines.filter((line) => /^#{1,3}\s/.test(line)).map((line) => line.trim()),
    imports: lines.filter((line) => /^@\S+/.test(line.trim())).map((line) => line.trim()),
  };
}

function findAgentFiles() {
  const names = ["AGENTS.md", "CLAUDE.md", "CLAUDE.local.md", ".claude/CLAUDE.md", "GEMINI.md", ".github/copilot-instructions.md", ".cursorrules", ".windsurfrules"];
  const tracked = new Set((git("ls-files", "--", ...names) ?? "").split(/\r?\n/).filter(Boolean));
  const files = {};

  for (const name of names) {
    const full = path.join(cwd, name);
    const isTracked = tracked.has(name);

    if (!exists(full) && !isTracked)
      continue;

    const description = !exists(full)
      ? { exists: false }
      : name.endsWith(".md") ? describeMarkdown(full) : { exists: true };

    // A tracked file that is deleted or modified in the working tree still has a committed
    // version; the skill must build on that version instead of treating the file as new.
    files[name] = {
      ...description,
      tracked: isTracked,
      gitStatus: isTracked ? (git("status", "--porcelain", "--", name) ?? "").slice(0, 2).trim() || "clean" : "untracked",
    };
  }

  if (isDir(path.join(cwd, ".cursor", "rules")))
    files[".cursor/rules/"] = { exists: true };

  return files;
}

function findDocs() {
  const listMarkdown = (dir) => (isDir(dir)
    ? fs.readdirSync(dir).filter((name) => name.toLowerCase().endsWith(".md")).sort()
    : []);
  const adrDirs = ["docs/adr", "docs/adrs", "docs/decisions", "doc/adr", "adr"]
    .filter((dir) => isDir(path.join(cwd, dir)))
    .map((dir) => ({ dir, files: listMarkdown(path.join(cwd, dir)) }));
  const rootFiles = ["README.md", "CONTEXT.md", "CONTEXT-MAP.md", "GLOSSARY.md", "CONTRIBUTING.md"]
    .filter((name) => exists(path.join(cwd, name)));
  const docsAgents = listMarkdown(path.join(cwd, "docs", "agents"));

  return {
    rootFiles,
    readme: exists(path.join(cwd, "README.md")) ? describeMarkdown(path.join(cwd, "README.md")) : { exists: false },
    docsDir: listMarkdown(path.join(cwd, "docs")),
    docsAgents,
    // Written by setup-matt-pocock-skills or by this skill's fallback; either way the tracker is configured.
    trackerConfigured: docsAgents.includes("issue-tracker.md"),
    adrDirs,
    githubTemplates: {
      issueTemplates: isDir(path.join(cwd, ".github", "ISSUE_TEMPLATE")),
      pullRequestTemplate: exists(path.join(cwd, ".github", "pull_request_template.md"))
        || exists(path.join(cwd, ".github", "PULL_REQUEST_TEMPLATE.md")),
    },
    localTracker: isDir(path.join(cwd, ".scratch")),
  };
}

function readWorkflowConfig() {
  const full = path.join(cwd, WORKFLOW_CONFIG);

  if (!exists(full))
    return { path: WORKFLOW_CONFIG, exists: false };

  const config = readJson(full);

  return config === null
    ? { path: WORKFLOW_CONFIG, exists: true, valid: false }
    : { path: WORKFLOW_CONFIG, exists: true, valid: true, config };
}

function frontmatter(file) {
  const text = readText(file) ?? "";
  const match = text.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---/);
  const block = match?.[1] ?? "";

  return {
    name: block.match(/^name:\s*["']?([^"'\r\n]+)["']?\s*$/m)?.[1]?.trim() ?? null,
    userOnly: /^disable-model-invocation:\s*true\s*$/m.test(block),
  };
}

function findSkills() {
  const found = {};
  const add = (name, userOnly, scope, agents) => {
    found[name] ??= { userOnly, locations: [], agents: [] };
    found[name].userOnly = found[name].userOnly || userOnly;

    if (!found[name].locations.includes(scope))
      found[name].locations.push(scope);

    for (const agent of agents) {
      if (!found[name].agents.includes(agent))
        found[name].agents.push(agent);
    }
  };
  const scanDir = (dir, scope, agents, prefix = "") => {
    if (!isDir(dir))
      return;

    for (const entry of fs.readdirSync(dir)) {
      const skillFile = path.join(dir, entry, "SKILL.md");

      if (!exists(skillFile))
        continue;

      const meta = frontmatter(skillFile);
      add(`${prefix}${meta.name ?? entry}`, meta.userOnly, scope, agents);
    }
  };

  for (const location of SKILL_LOCATIONS)
    scanDir(location.dir(), location.scope, location.agents);

  for (const plugin of enabledClaudePluginEntries())
    scanDir(path.join(plugin.installPath, "skills"), `plugin:${plugin.plugin}`, ["claude-code"], `${plugin.plugin}:`);

  return Object.fromEntries(Object.entries(found).sort(([a], [b]) => a.localeCompare(b)));
}

function enabledClaudePluginEntries() {
  const installed = readJson(path.join(home, ".claude", "plugins", "installed_plugins.json"));
  const settings = readJson(path.join(home, ".claude", "settings.json")) ?? {};
  const enabled = settings.enabledPlugins ?? {};
  const entries = [];

  for (const [key, list] of Object.entries(installed?.plugins ?? {})) {
    const [plugin, marketplace] = key.split("@");

    for (const entry of Array.isArray(list) ? list : []) {
      const forThisRepo = entry.projectPath && path.resolve(entry.projectPath).toLowerCase() === cwd.toLowerCase();

      if (entry.scope !== "user" && !forThisRepo)
        continue;

      entries.push({
        key,
        plugin,
        marketplace: marketplace ?? null,
        scope: entry.scope ?? null,
        version: entry.version ?? null,
        enabled: enabled[key] !== false,
        installPath: entry.installPath ?? "",
      });
    }
  }

  return entries.filter((entry) => entry.enabled);
}

function findClaudePlugins() {
  return enabledClaudePluginEntries().map(({ key, plugin, marketplace, scope, version }) => ({ key, plugin, marketplace, scope, version }));
}

function probeVersion(executable) {
  if (!probe)
    return { ok: false, reason: "probe disabled (--no-probe)" };

  const useShell = isWindows && /\.(cmd|bat)$/i.test(executable);

  // cmd.exe would interpret these characters; an installed tool never needs them in its path.
  if (useShell && /["%^&|<>!]/.test(executable))
    return { ok: false, reason: "path contains shell metacharacters; not probed" };

  const result = useShell
    ? spawnSync(`"${executable}" --version`, { shell: true, cwd: os.tmpdir(), encoding: "utf8", timeout: 10000, windowsHide: true })
    : spawnSync(executable, ["--version"], { cwd: os.tmpdir(), encoding: "utf8", timeout: 10000, windowsHide: true });

  if (result.error || result.status !== 0)
    return { ok: false, reason: result.error ? result.error.code ?? result.error.message : `exit code ${result.status}` };

  const firstLine = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.split(/\r?\n/).find((line) => line.trim()) ?? "";
  const version = firstLine.match(/\d+\.\d+(?:\.\d+)?/)?.[0] ?? null;

  return version ? { ok: true, version, raw: firstLine.trim().slice(0, 120) } : { ok: false, reason: "no version in output" };
}

function versionAtLeast(version, minimum) {
  if (!version)
    return false;

  const a = version.split(".").map(Number);
  const b = minimum.split(".").map(Number);

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0))
      return (a[i] ?? 0) > (b[i] ?? 0);
  }

  return true;
}

function toolRole(name, stackIds, remoteHosts) {
  const agentTool = TOOL_SPECS.find((tool) => tool.name === name)?.agent;

  if (agentTool)
    return { role: "optional", reason: "coding-agent CLI; used as an implementer only if you select external delegation" };

  switch (name) {
    case "git":
      return { role: "required", reason: "branches, history and diffs drive the workflow" };
    case "node":
    case "npm":
    case "npx":
      return stackIds.includes("react") || stackIds.includes("node")
        ? { role: "required", reason: "the project's gates run through package scripts" }
        : { role: "recommended", reason: "runs this inventory and the skills CLI (npx skills)" };
    case "gh":
      return remoteHosts.includes("github")
        ? { role: "recommended", reason: "GitHub issues and pull requests from the terminal" }
        : { role: "optional", reason: "no GitHub remote detected" };
    case "glab":
      return remoteHosts.includes("gitlab")
        ? { role: "recommended", reason: "GitLab issues and merge requests from the terminal" }
        : { role: "optional", reason: "no GitLab remote detected" };
    case "dotnet":
      return stackIds.includes("dotnet")
        ? { role: "required", reason: "build, format and test gates for the .NET projects" }
        : { role: "optional", reason: "no .NET project detected" };
    default:
      return { role: "optional", reason: "" };
  }
}

function describeTools(stackList, gitData) {
  const stackIds = stackList.map((s) => s.id);
  const remoteHosts = (gitData.remotes ?? []).map((r) => r.host);
  const result = {};

  for (const spec of TOOL_SPECS) {
    const executable = which(spec.name);
    const { role, reason } = toolRole(spec.name, stackIds, remoteHosts);
    const entry = { role, reason, path: executable, version: null, status: "missing", auth: spec.needsAuth ? "not-checked" : "not-applicable", notes: [] };

    if (executable && isInside(executable, cwd)) {
      entry.status = "present-unverified";
      entry.notes.push("resolved inside the repository; not executed");
    } else if (executable) {
      const probed = probeVersion(executable);
      entry.status = probed.ok ? "installed" : "present-unverified";
      entry.version = probed.ok ? probed.version : null;

      if (!probed.ok)
        entry.notes.push(`version probe failed: ${probed.reason}`);
    }

    if (spec.name === "node" && entry.version && !versionAtLeast(entry.version, "22.20.0"))
      entry.notes.push("the skills CLI (npx skills) requires Node.js 22.20 or later");

    result[spec.name] = entry;
  }

  return result;
}

function delegationSummary(skillMap) {
  const implementers = Object.entries(DELEGATE_CLIS)
    .filter(([skill]) => skill in skillMap)
    .map(([skill, cli]) => ({ skill, cli, cliOnPath: Boolean(which(cli)), auth: "not-checked" }));
  const configHome = process.env.XDG_CONFIG_HOME ?? path.join(home, ".config");

  return {
    implementers,
    available: implementers.filter((i) => i.cliOnPath).map((i) => i.skill),
    delegateSetupInstalled: "delegate-setup" in skillMap,
    laneConfig: {
      global: exists(path.join(configHome, "delegate-skills", "config.json")),
      project: exists(path.join(cwd, ".delegate", "config.json")),
    },
  };
}

function skillAgents(name) {
  const direct = skills[name]?.agents ?? [];
  const viaPlugin = Object.entries(skills)
    .filter(([key]) => key.endsWith(`:${name}`))
    .flatMap(([, value]) => value.agents);

  return [...new Set([...direct, ...viaPlugin])];
}

function pluginInstalled(plugin, marketplace) {
  return claudePlugins.some((p) => p.plugin === plugin && (!marketplace || p.marketplace === marketplace));
}

function previousDecision(id) {
  return workflowConfig.config?.dependencies?.[id] ?? null;
}

function skillComponent(name, relevant, reason, flags = {}) {
  return { name, kind: "skill", relevant, reason, ...flags, installedFor: skillAgents(name) };
}

function describeDependencies() {
  const stackIds = stacks.map((s) => s.id);
  const isDotnet = stackIds.includes("dotnet");
  const isReact = stackIds.includes("react");
  const markers = dotnetProject?.markers ?? {};
  const codexVersion = tools.codex?.version ?? null;
  const pluginComponent = (name, relevant, reason) => ({
    name,
    kind: "plugin",
    relevant,
    reason,
    installedFor: pluginInstalled(name, "dotnet-agent-skills") ? ["claude-code"] : [],
    notCheckedFor: ["codex", "github-copilot"],
  });
  const dependencies = [
    {
      id: "matt-pocock-skills",
      repo: "https://github.com/mattpocock/skills",
      relevant: true,
      reason: "clarify, spec, ticket, implement and TDD procedures for any engineering workflow",
      installVia: "plugin or skills CLI",
      supportedAgents: ["claude-code", "codex", "github-copilot", "gemini-cli", "any skills CLI agent"],
      trackerConfigured: exists(path.join(cwd, "docs", "agents", "issue-tracker.md")),
      components: ["setup-matt-pocock-skills", "grill-with-docs", "grilling", "domain-modeling", "to-spec", "to-tickets", "triage", "implement", "implement-spec", "tdd", "code-review", "wayfinder"]
        .map((name) => skillComponent(name, true, "")),
    },
    {
      id: "guard-skills",
      repo: "https://github.com/amElnagdy/guard-skills",
      relevant: true,
      reason: "review guards to run after implementation and before landing",
      installVia: "skills CLI",
      supportedAgents: ["any skills CLI agent"],
      components: [
        skillComponent("clean-code-guard", true, "changed production code"),
        skillComponent("test-guard", true, "changed tests"),
        skillComponent("docs-guard", true, "changed documentation"),
      ],
    },
    {
      id: "bravo6dev-skills",
      repo: "https://github.com/Bravo6Dev/skills",
      relevant: true,
      reason: "git conventions, plus architecture skills that match the detected stack",
      installVia: "skills CLI",
      supportedAgents: ["any skills CLI agent"],
      components: [
        skillComponent("git-conventions", true, "branch, commit and PR text"),
        skillComponent("react-architecture", isReact, isReact ? "React detected" : "no React project"),
        skillComponent("react-architecture-audit", isReact, isReact ? "React detected" : "no React project"),
        skillComponent("react-structural-migration", isReact, isReact ? "React detected; only for an approved migration" : "no React project", { onRequestOnly: true }),
        skillComponent("vertical-slice-feature", isDotnet, isDotnet ? "only if the code uses co-located vertical slices" : "no .NET project", { requiresArchitectureMatch: true }),
        skillComponent("vertical-slice-architecture", isDotnet, isDotnet ? "only to set up a new vertical-slice foundation" : "no .NET project", { requiresArchitectureMatch: true }),
        skillComponent("add-feature", isDotnet, isDotnet ? "only for a MediatR + ErrorOr + Carter Clean Architecture project" : "no .NET project", { requiresArchitectureMatch: true }),
      ],
    },
    {
      id: "delegate-skills",
      repo: "https://github.com/amElnagdy/delegate-skills",
      relevant: true,
      reason: "optional: only if you choose to hand implementation to another agent CLI",
      onRequestOnly: true,
      installVia: "skills CLI",
      supportedAgents: ["any skills CLI agent"],
      notes: ["the full delegate loop is proven on Claude Code; other orchestrators are designed-for but unproven (per its README)"],
      components: [
        skillComponent("delegate-setup", true, "maps kinds of work to implementer CLIs"),
        ...Object.entries(DELEGATE_CLIS)
          .filter(([, cli]) => which(cli))
          .map(([skill, cli]) => skillComponent(skill, true, `\`${cli}\` is on PATH`)),
      ],
    },
    {
      id: "dotnet-skills",
      repo: "https://github.com/dotnet/skills",
      relevant: isDotnet,
      reason: isDotnet ? ".NET plugins from Microsoft; recommend only the ones the project needs" : "no .NET project",
      installVia: "plugin",
      supportedAgents: ["claude-code", "github-copilot", ...(codexVersion === null || versionAtLeast(codexVersion, "0.121.0") ? ["codex"] : [])],
      notes: codexVersion && !versionAtLeast(codexVersion, "0.121.0") ? ["Codex plugins need Codex CLI 0.121.0 or later"] : [],
      components: isDotnet
        ? [
          pluginComponent("dotnet", true, "general .NET skills"),
          pluginComponent("dotnet-test", Boolean(markers.tests), markers.tests ? "test projects detected" : "no test project detected"),
          pluginComponent("dotnet-aspnetcore", Boolean(markers.aspnetcore), markers.aspnetcore ? "ASP.NET Core detected" : "no ASP.NET Core project"),
          pluginComponent("dotnet-data", Boolean(markers.efCore), markers.efCore ? "EF Core detected" : "no EF Core package"),
          pluginComponent("dotnet-blazor", Boolean(markers.blazor), markers.blazor ? "Blazor detected" : "no Blazor project"),
          pluginComponent("dotnet-maui", Boolean(markers.maui), markers.maui ? "MAUI detected" : "no MAUI project"),
          pluginComponent("dotnet-winforms", Boolean(markers.winforms), markers.winforms ? "Windows Forms detected" : "no Windows Forms project"),
        ]
        : [],
    },
    {
      id: "dotnet-claude-kit",
      repo: "https://github.com/codewithmukesh/dotnet-claude-kit",
      relevant: isDotnet,
      reason: isDotnet ? "Claude Code plugin with .NET skills, agents and a Roslyn MCP server" : "no .NET project",
      installVia: "plugin",
      supportedAgents: ["claude-code"],
      components: isDotnet
        ? [
          { name: "dotnet-claude-kit", kind: "plugin", relevant: true, reason: "Claude Code only", installedFor: pluginInstalled("dotnet-claude-kit") ? ["claude-code"] : [] },
          { name: "cwm-roslyn-navigator", kind: "dotnet-tool", relevant: true, reason: "prerequisite MCP server", installedFor: which("cwm-roslyn-navigator") ? ["claude-code"] : [] },
        ]
        : [],
    },
    {
      id: "react-doctor",
      repo: "https://github.com/millionco/react-doctor",
      relevant: isReact,
      reason: isReact ? "React diagnostics; the CLI runs through npx without installing" : "no React project",
      installVia: "npx",
      supportedAgents: ["claude-code", "codex", "cursor", "opencode"],
      components: isReact
        ? [
          { name: "react-doctor (CLI)", kind: "npx", relevant: true, reason: "`npx react-doctor@latest` downloads and runs the latest release", installedFor: [] },
          skillComponent("react-doctor", true, "agent integration installed by `npx react-doctor@latest install`"),
        ]
        : [],
    },
  ];

  return dependencies.map((dependency) => ({ ...dependency, previousDecision: previousDecision(dependency.id) }));
}
