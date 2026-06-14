#!/usr/bin/env node
// kanban-skills — installer
// Copies the bundled Claude Code skills into a target .claude/skills/ directory.
// No runtime dependencies; pure Node.

import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync, cpSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_SRC = resolve(__dirname, "..", "skills");

const VERSION = "0.1.0";

function parseArgs(argv) {
  const opts = { user: false, force: false, help: false, list: false, version: false, dir: null };
  const positional = [];
  for (const a of argv) {
    if (a === "--user" || a === "-u" || a === "--global" || a === "-g") opts.user = true;
    else if (a === "--force" || a === "-f") opts.force = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else if (a === "--list" || a === "-l") opts.list = true;
    else if (a === "--version" || a === "-v" || a === "-V") opts.version = true;
    else if (a.startsWith("--dir=")) opts.dir = a.slice("--dir=".length);
    else positional.push(a);
  }
  opts.command = positional[0] || "install";
  return opts;
}

function listSkills() {
  return readdirSync(SKILLS_SRC).filter((name) => {
    const p = join(SKILLS_SRC, name);
    return statSync(p).isDirectory() && existsSync(join(p, "SKILL.md"));
  });
}

const HELP = `
kanban-skills — a lightweight Kanban skill set for Claude Code

Usage:
  npx kanban-skills [command] [options]

Commands:
  install        Copy the skills into .claude/skills/ (default)
  list           List the skills that would be installed

Options:
  --user, -g     Install to ~/.claude/skills/ (user level) instead of ./.claude/skills/
  --dir=<path>   Install into a custom directory (expects a .claude/skills/ layout under it)
  --force, -f    Overwrite skills that already exist
  --list, -l     List bundled skills and exit
  --version, -v  Print version
  --help, -h     Show this help

Examples:
  npx kanban-skills                # install into ./.claude/skills/ (this project)
  npx kanban-skills --user         # install into ~/.claude/skills/ (all projects)
  npx kanban-skills --force        # reinstall / upgrade, overwriting existing copies
`;

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.version) {
    console.log(VERSION);
    return;
  }
  if (opts.help) {
    console.log(HELP);
    return;
  }

  const skills = listSkills();

  if (opts.list || opts.command === "list") {
    console.log("Bundled skills:");
    for (const s of skills) console.log("  - " + s);
    return;
  }

  // Resolve target .claude/skills directory
  let base;
  if (opts.dir) base = resolve(opts.dir);
  else if (opts.user) base = homedir();
  else base = process.cwd();
  const targetDir = join(base, ".claude", "skills");

  mkdirSync(targetDir, { recursive: true });

  const installed = [];
  const skipped = [];
  for (const skill of skills) {
    const dest = join(targetDir, skill);
    if (existsSync(dest) && !opts.force) {
      skipped.push(skill);
      continue;
    }
    cpSync(join(SKILLS_SRC, skill), dest, { recursive: true, force: true });
    installed.push(skill);
  }

  console.log("");
  console.log("kanban-skills → " + targetDir);
  if (installed.length) console.log("  installed: " + installed.join(", "));
  if (skipped.length) {
    console.log("  skipped (already exist, use --force to overwrite): " + skipped.join(", "));
  }
  console.log("");
  console.log("Next steps:");
  console.log("  1. In Claude Code, run /kanban-init to scaffold the board (kanban.html + kanban.json).");
  console.log("  2. Add cards (or run /kanban-brainstorm), light one up, then /kanban-implement.");
  if (!opts.user) {
    console.log("");
    console.log("  Tip: project-level skills land in .claude/skills/ — add that to .gitignore if you");
    console.log("  don't want to commit them, or commit them to share the workflow with a teammate.");
  }
  console.log("  Skills are picked up live — no need to restart Claude Code (run /reload-plugins if not).");
}

main();
