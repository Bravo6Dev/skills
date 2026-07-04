# AI Skills Collection

A collection of reusable AI agent skills for tools such as Claude Code and Cursor.

These skills provide structured instructions, conventions, workflows, and best practices that can be installed into your AI coding environment and reused across projects.

---

## Installation

Install all skills from this repository:

```bash
npx skills add Bravo6Dev/skills
```

---

## Install a Specific Skill

Install a single skill:

```bash
npx skills add Bravo6Dev/skills --skill <skill-name>
```

Example:

```bash
npx skills add Bravo6Dev/skills --skill git-conventions
```

---

## Install for a Specific Agent

If multiple agents are supported, specify the target agent explicitly:

```bash
npx skills add Bravo6Dev/skills --skill <skill-name> --agent <agent-name>
```

Example:

```bash
npx skills add Bravo6Dev/skills --skill git-conventions --agent claude-code
```

## Install Globally

Install skills globally for all projects:

```bash
npx skills add Bravo6Dev/skills --global
```

---

## Available Skills

| Skill                | Description                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `git-conventions`    | Git branching strategy, commit message conventions, pull request workflow, and repository hygiene rules. |
| `react-architecture` | React project architecture and folder structure conventions.                                             |

---

## Repository Structure

```text
skills/
├── git-conventions/
│   ├── SKILL.md
│   └── references/
```

Each skill contains:

* `SKILL.md` — Main instructions and behavior.
* `references/` — Additional examples, documentation, and supporting material.

---

## Updating Skills

After updating a skill, users can reinstall it using:

```bash
npx skills add Bravo6Dev/skills --skill git-conventions --force
```

---

## Contributing

Contributions are welcome.

When adding a new skill:

1. Create a new folder under `skills/`.
2. Add a `SKILL.md` file.
3. Add a `references/` folder if supporting documentation is needed.
4. Update the Available Skills table in this README.

---

## Current Focus

This repository currently contains:

* Git workflow and commit conventions.

More skills will be added over time, including project architecture, code review, backend development, and engineering workflows.
