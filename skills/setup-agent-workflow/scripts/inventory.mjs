#!/usr/bin/env node
// Read-only inventory for setup-agent-workflow. Prints one JSON object to stdout.
//
// Safety contract: never writes files, never installs, never authenticates, never touches the
// network, never runs project scripts. The only processes it starts are read-only git queries and
// `<tool> --version` probes of executables resolved from PATH outside the repository, run from a
// neutral directory with a timeout.
// Limit of that contract: git reads the repository's own configuration. The git queries here
// turn off optional locks, the file-system monitor and signature display, but git can still run
// a content filter that the repository configures. Inventory only a repository you trust.
//
// Usage: node inventory.mjs [--cwd <repo>] [--home <dir>] [--path <PATH string>] [--no-probe]
//   --home and --path simulate another machine in tests; --no-probe skips the version probes.
//   Flags also accept --key=value. An unknown flag, a missing value, or a --cwd that is not an
//   existing directory prints an error to stderr and exits with code 2 without printing JSON.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const USAGE = "node inventory.mjs [--cwd <repo>] [--home <dir>] [--path <PATH string>] [--no-probe]";
const KNOWN_FLAGS = { cwd: "value", home: "value", path: "value", "no-probe": "boolean", help: "boolean" };
const SCHEMA_VERSION = 1;

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(USAGE);
  process.exit(0);
}

const isWindows = process.platform === "win32";
// Windows and macOS file systems are case-insensitive by default; Linux is not.
const caseInsensitiveFs = isWindows || process.platform === "darwin";

// An empty value is what an unset shell variable expands to; it must not fall back to the
// directory the script happens to run in. (`--path ""` is valid: it means an empty PATH.)
for (const flag of ["cwd", "home"]) {
  if (args[flag] === "")
    fail(`--${flag} needs a value`);
}

const cwd = path.resolve(args.cwd ?? process.cwd());

// A mistyped path must not be reported as an empty new project.
if (!isDir(cwd))
  fail(`--cwd is not an existing directory: ${cwd}`);

const home = path.resolve(args.home ?? os.homedir());
// Claude Code keeps its user-level files in CLAUDE_CONFIG_DIR when that is set. An explicit --home
// simulates another machine, so the variable of this machine is ignored then.
const claudeDir = args.home === undefined && process.env.CLAUDE_CONFIG_DIR
  ? path.resolve(process.env.CLAUDE_CONFIG_DIR)
  : path.join(home, ".claude");
const searchPath = typeof args.path === "string" ? args.path : process.env.PATH ?? "";
const probe = !args["no-probe"];
// Things the inventory could not read. They are reported instead of being silently skipped.
const warnings = [];

const IGNORED_DIRS = new Set([
  ".git", "node_modules", "bin", "obj", "dist", "build", "out", ".next", ".nuxt", ".dart_tool",
  ".venv", "venv", "__pycache__", "vendor", "target", "TestResults", ".idea", ".vs", ".vscode",
  "coverage", ".scratch", ".gradle", "Pods", ".turbo", ".cache",
]);
const SOURCE_EXTENSIONS = new Set([
  ".cs", ".fs", ".vb", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".dart",
  ".py", ".go", ".java", ".kt", ".kts", ".rs", ".rb", ".php", ".swift", ".c", ".cc", ".cpp", ".h",
  ".hpp", ".scala", ".ex", ".exs", ".sql", ".tf", ".sh", ".ps1", ".razor", ".cshtml", ".xaml",
]);
const MANIFEST_NAMES = new Set([
  "package.json", "pubspec.yaml", "pyproject.toml", "requirements.txt", "go.mod", "Cargo.toml",
  "pom.xml", "build.gradle", "build.gradle.kts", "global.json", "Directory.Build.props",
  "Directory.Packages.props", "Makefile", "justfile", "Taskfile.yml", "compose.yaml",
  "docker-compose.yml", "Dockerfile", ".editorconfig", "tsconfig.json", "biome.json",
  "eslint.config.js", "eslint.config.mjs", ".eslintrc.json", ".eslintrc.js", ".prettierrc",
  "prettier.config.js", "ruff.toml", "analysis_options.yaml", "dotnet-tools.json",
]);
const MANIFEST_EXTENSIONS = new Set([".sln", ".slnx", ".csproj", ".fsproj", ".vbproj"]);
const MAX_ENTRIES = 20000;
const MAX_DEPTH = 6;
// Lock files in order of precedence, with the package manager each one belongs to.
const LOCKFILES = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lockb", "bun"],
  ["bun.lock", "bun"],
  ["package-lock.json", "npm"],
];
// Options for every git call: never take optional locks (so `git status` does not rewrite the
// index), never run a file-system monitor command configured in the repository, and never run
// a signature program for `git log`. See the limit stated in the safety contract above.
const GIT_SAFE_ARGS = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "log.showSignature=false"];

// Where each agent reads skills, per the skills CLI agents table (vercel-labs/skills docs/agents.md).
const SKILL_LOCATIONS = [
  { scope: "user:.claude", dir: () => path.join(claudeDir, "skills"), agents: ["claude-code"] },
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
  schemaVersion: SCHEMA_VERSION,
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
  warnings,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

function fail(message) {
  process.stderr.write(`inventory: ${message}\nUsage: ${USAGE}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (!token.startsWith("--"))
      fail(`unexpected argument: ${token}`);

    const equals = token.indexOf("=");
    const key = equals === -1 ? token.slice(2) : token.slice(2, equals);

    if (!Object.prototype.hasOwnProperty.call(KNOWN_FLAGS, key))
      fail(`unknown flag: --${key}`);

    if (KNOWN_FLAGS[key] === "boolean") {
      if (equals !== -1)
        fail(`--${key} takes no value`);

      out[key] = true;
      continue;
    }

    if (equals !== -1) {
      out[key] = token.slice(equals + 1);
      continue;
    }

    const next = argv[i + 1];

    // An empty string is a valid value (`--path ""`); another flag or nothing is not.
    if (next === undefined || next.startsWith("--"))
      fail(`--${key} needs a value`);

    out[key] = next;
    i++;
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
    return JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

// Lists a directory, sorted. A directory that can't be read is reported, not fatal.
function listDir(dir) {
  try {
    return fs.readdirSync(dir).sort();
  } catch (error) {
    warnings.push(`could not read ${dir}: ${error.code ?? error.message}`);
    return [];
  }
}

// The real location of a path: symlinks resolved, and case folded only where the file system
// ignores case. A path that doesn't exist yet is compared as written.
function canonical(p) {
  let resolved;

  try {
    // .native also expands Windows 8.3 short names, which git reports in their long form.
    resolved = fs.realpathSync.native(p);
  } catch {
    resolved = path.resolve(p);
  }

  return caseInsensitiveFs ? resolved.toLowerCase() : resolved;
}

function isInside(child, parent) {
  const relative = path.relative(canonical(parent), canonical(child));
  return relative === ""
    || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
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
    return execFileSync(gitPath, [...GIT_SAFE_ARGS, ...gitArgs], {
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

// Asks git whether cwd is inside a work tree, and tells "not a repository" apart from a query
// that failed (a timeout, or git refusing the directory as "dubious ownership"). A failed query
// must not be reported as a folder without git.
function gitRepoState() {
  const result = spawnSync(gitPath, [...GIT_SAFE_ARGS, "rev-parse", "--is-inside-work-tree"], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: 15000,
    // git translates its messages; the "not a git repository" check below needs the English one.
    env: { ...process.env, LC_ALL: "C", LANGUAGE: "C" },
  });

  if (result.error)
    return { isRepo: false, error: result.error.code ?? result.error.message };

  if (result.status === 0)
    return { isRepo: (result.stdout ?? "").trim() === "true" };

  const stderr = (result.stderr ?? "").trim();

  // The whole output is checked: git may print a `warning:` line before the `fatal:` one.
  if (/not a git repository/i.test(stderr))
    return { isRepo: false };

  const lines = stderr.split(/\r?\n/);
  const message = lines.find((line) => /^fatal:/i.test(line)) ?? lines[0] ?? "";

  return { isRepo: false, error: stripCredentials(message).slice(0, 200) || `git exited with code ${result.status}` };
}

// Removes credentials embedded in a remote URL (https://user:token@host/...), so a token never
// reaches the report, the agent's context or a generated document. Everything up to the last `@`
// before the path is dropped, because a password may itself contain `@`.
function stripCredentials(text) {
  return (text ?? "").replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s]*@/gi, "$1");
}

function gitInfo() {
  if (!gitPath)
    return { isRepo: false, gitMissing: true };

  if (isInside(gitPath, cwd))
    return { isRepo: false, gitError: "git resolves to a file inside the repository; not executed" };

  const state = gitRepoState();

  if (!state.isRepo)
    return state.error ? { isRepo: false, gitError: state.error } : { isRepo: false };

  const remotes = (git("remote", "-v") ?? "")
    .split(/\r?\n/)
    .filter((line) => line.endsWith("(fetch)"))
    .map((line) => {
      const [name, rawUrl] = line.split(/\s+/);
      const url = stripCredentials(rawUrl);
      return { name, url, host: hostOf(url) };
    });
  const refs = (git("for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes") ?? "")
    .split(/\r?\n/)
    .filter((ref) => ref && !/^refs\/remotes\/[^/]+\/HEAD$/.test(ref));
  const branches = refs.map((ref) => ref.replace(/^refs\/(heads|remotes)\//, ""));
  // Only a remote-tracking ref carries a remote name to drop: `origin/dev` is the branch `dev`,
  // but the local branch `feature/dev` is not.
  const branchNames = new Set(refs.map((ref) => (ref.startsWith("refs/remotes/")
    ? ref.replace(/^refs\/remotes\/[^/]+\//, "")
    : ref.replace(/^refs\/heads\//, ""))));
  const root = git("rev-parse", "--show-toplevel");
  const status = git("status", "--porcelain");

  return {
    isRepo: true,
    root,
    // False when --cwd is a subdirectory of a larger repository: the files below are looked up
    // under cwd, not under the repository root. null: the root could not be read.
    cwdIsRoot: root === null ? null : canonical(root) === canonical(cwd),
    currentBranch: git("branch", "--show-current"),
    remotes,
    branches,
    hasMain: branchNames.has("main"),
    hasMaster: branchNames.has("master"),
    hasDev: branchNames.has("dev") || branchNames.has("develop"),
    commitCount: Number.parseInt(git("rev-list", "--count", "HEAD") ?? "0", 10) || 0,
    recentCommitSubjects: (git("log", "-15", "--format=%s") ?? "").split(/\r?\n/).filter(Boolean),
    // null: the status could not be read (for example a timeout). Unknown is not clean.
    dirty: status === null ? null : status.length > 0,
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
  const result = { sourceFiles: 0, sourceByExtension: {}, manifests: [], packageJsons: [], truncated: false, depthLimited: false };
  let seen = 0;
  const stack = [{ dir: root, depth: 0 }];
  // The same order on every operating system, whatever order the file system lists entries in.
  const finish = () => {
    result.manifests.sort();
    result.packageJsons.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    return result;
  };

  while (stack.length > 0) {
    const { dir, depth } = stack.pop();
    let entries;

    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      warnings.push(`could not read ${dir}: ${error.code ?? error.message}`);
      continue;
    }

    for (const entry of entries) {
      if (++seen > MAX_ENTRIES) {
        result.truncated = true;
        return finish();
      }

      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name))
          continue;

        // A directory below the depth limit is skipped; say so, because a count of zero source
        // files then proves nothing (Java and Kotlin sources often sit deeper than this).
        if (depth < MAX_DEPTH)
          stack.push({ dir: full, depth: depth + 1 });
        else
          result.depthLimited = true;

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

  return finish();
}

// The package manager whose lock file is nearest: in the package's own directory, or in a parent
// up to the inventoried root (a workspace keeps one lock file at its root).
function lockfilePackageManager(dir) {
  let current = dir;

  for (;;) {
    const found = LOCKFILES.find(([lock]) => exists(path.join(current, lock)));

    if (found)
      return found[1];

    const parent = path.dirname(current);

    if (current === cwd || parent === current)
      return null;

    current = parent;
  }
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function describePackageJson(file) {
  // A package.json that isn't a JSON object (or can't be parsed) is described as an empty one.
  const pkg = plainObject(readJson(file));
  const dir = path.dirname(file);
  // peerDependencies count: a component library lists react there, not under dependencies.
  const deps = {
    ...plainObject(pkg.dependencies),
    ...plainObject(pkg.devDependencies),
    ...plainObject(pkg.peerDependencies),
  };
  // The package's own lock file, then its packageManager field, then a lock file in a parent
  // directory (a workspace package has none of its own).
  const packageManager = LOCKFILES.find(([lock]) => exists(path.join(dir, lock)))?.[1]
    ?? (typeof pkg.packageManager === "string" ? pkg.packageManager.split("@")[0] : null)
    ?? (dir === cwd ? null : lockfilePackageManager(path.dirname(dir)));
  const frameworks = ["react", "next", "vite", "react-native", "expo", "vue", "svelte", "@angular/core", "express", "@nestjs/core", "vitest", "jest", "@playwright/test", "typescript"]
    .filter((name) => Object.prototype.hasOwnProperty.call(deps, name));

  return {
    path: rel(file),
    name: typeof pkg.name === "string" ? pkg.name : null,
    packageManager,
    scripts: plainObject(pkg.scripts),
    frameworks,
    workspaces: Boolean(pkg.workspaces),
  };
}

function detectStacks(t) {
  const stacksFound = [];
  const has = (predicate) => t.manifests.filter(predicate);
  const dotnet = has((m) => /\.(sln|slnx|csproj|fsproj|vbproj)$/i.test(m));

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
  const files = t.manifests.filter((m) => /\.(csproj|fsproj|vbproj)$|(^|\/)Directory\.(Build|Packages)\.props$/i.test(m));

  if (files.length === 0)
    return null;

  const text = files.map((m) => readText(path.join(cwd, m)) ?? "").join("\n");
  const globalJson = readJson(path.join(cwd, "global.json"));
  const markers = {
    aspnetcore: /Sdk=["']Microsoft\.NET\.Sdk\.Web["']|Microsoft\.AspNetCore\./.test(text),
    efCore: /Microsoft\.EntityFrameworkCore/.test(text),
    // Matched against the name of a referenced package (or the MSTest project SDK), not anywhere
    // in the file: a bare /TUnit/i also matches a project named "Crm.Opportunities".
    tests: /<PackageReference\b[^>]*\bInclude\s*=\s*["'](?:Microsoft\.NET\.Test\.Sdk|xunit|MSTest|NUnit|TUnit)[\w.]*["']|Sdk\s*=\s*["']MSTest\.Sdk/i.test(text),
    blazor: /Sdk=["']Microsoft\.NET\.Sdk\.BlazorWebAssembly["']|Microsoft\.AspNetCore\.Components/.test(text),
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
  const walkCut = t.truncated || t.depthLimited;

  return {
    mode,
    // Ambiguous: a little code in a young repository, or no recognised source file although the
    // walk was cut short or the repository already has history (source in a language this script
    // does not count, or deeper than it walks). "new" must then be confirmed, not assumed.
    ambiguous: (t.sourceFiles > 0 && t.sourceFiles < 10 && commitCount <= 3)
      || (t.sourceFiles === 0 && (walkCut || commitCount > 3)),
    sourceFiles: t.sourceFiles,
    sourceByExtension: t.sourceByExtension,
    walkTruncated: t.truncated,
    depthLimited: t.depthLimited,
  };
}

function findCi() {
  const found = [];
  const workflows = path.join(cwd, ".github", "workflows");

  if (isDir(workflows)) {
    for (const name of listDir(workflows)) {
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
  // Headings and imports are read from prose only: inside a fenced code block `# comment` is not
  // a heading and `@decorator` is not an import.
  const prose = [];
  let fence = null;

  for (const line of lines) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/)?.[1];

    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length)
        fence = null;
      continue;
    }

    if (marker) {
      fence = marker;
      continue;
    }

    prose.push(line);
  }

  return {
    exists: true,
    lines: lines.length,
    headings: prose.filter((line) => /^#{1,3}\s/.test(line)).map((line) => line.trim()),
    imports: prose.filter((line) => /^@\S+/.test(line.trim())).map((line) => line.trim()),
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
    ? listDir(dir).filter((name) => name.toLowerCase().endsWith(".md"))
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
  const match = text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/);
  const block = match?.[1] ?? "";

  return {
    name: block.match(/^name:\s*["']?([^"'\r\n]+)["']?\s*$/m)?.[1]?.trim() ?? null,
    userOnly: /^disable-model-invocation:\s*true\s*$/m.test(block),
  };
}

function findSkills() {
  // No prototype: a skill may be named `constructor`, `toString` or `__proto__`, and those names
  // must be ordinary keys, not inherited members of Object.prototype.
  const found = Object.create(null);
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

    for (const entry of listDir(dir)) {
      const skillFile = path.join(dir, entry, "SKILL.md");

      if (!exists(skillFile))
        continue;

      const meta = frontmatter(skillFile);
      add(`${prefix}${meta.name ?? entry}`, meta.userOnly, scope, agents);
    }
  };

  for (const location of SKILL_LOCATIONS)
    scanDir(location.dir(), location.scope, location.agents);

  for (const plugin of enabledClaudePluginEntries()) {
    // Without an install path there is nothing to scan; joining "" with "skills" would scan the
    // `skills` folder of whatever directory the script was started in.
    if (!plugin.installPath)
      continue;

    scanDir(path.join(plugin.installPath, "skills"), `plugin:${plugin.plugin}`, ["claude-code"], `${plugin.plugin}:`);
  }

  const sorted = Object.create(null);

  for (const name of Object.keys(found).sort((a, b) => a.localeCompare(b)))
    sorted[name] = found[name];

  return sorted;
}

function enabledClaudePluginEntries() {
  const installed = plainObject(readJson(path.join(claudeDir, "plugins", "installed_plugins.json")));
  // Claude Code reads enabledPlugins from the user settings, then the project's shared settings,
  // then the project's local settings; a later file wins for the keys it sets.
  const enabled = Object.assign(
    Object.create(null),
    ...[
      path.join(claudeDir, "settings.json"),
      path.join(cwd, ".claude", "settings.json"),
      path.join(cwd, ".claude", "settings.local.json"),
    ].map((file) => plainObject(plainObject(readJson(file)).enabledPlugins)),
  );
  const entries = [];

  for (const [key, list] of Object.entries(plainObject(installed.plugins))) {
    const [plugin, marketplace] = key.split("@");

    for (const entry of Array.isArray(list) ? list : []) {
      if (!entry || typeof entry !== "object")
        continue;

      const forThisRepo = typeof entry.projectPath === "string" && canonical(entry.projectPath) === canonical(cwd);

      if (entry.scope !== "user" && !forThisRepo)
        continue;

      entries.push({
        key,
        plugin,
        marketplace: marketplace ?? null,
        scope: entry.scope ?? null,
        version: entry.version ?? null,
        enabled: enabled[key] !== false,
        installPath: typeof entry.installPath === "string" ? entry.installPath : "",
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
