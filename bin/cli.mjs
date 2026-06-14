#!/usr/bin/env node
// kanban-skills — installer
// Installs the bundled Kanban skills into one or more coding agents.
// One canonical source (skills/) → emitted into each agent's command/prompt format.
// No runtime dependencies; pure Node.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { listSkills, installAgent, AGENT_NAMES } from "./agents.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_SRC = resolve(__dirname, "..", "skills");
const VERSION = "0.1.0";

const TARGETABLE = ["claude", "codex", "opencode", "gemini", "generic"];

function parseArgs(argv) {
  const opts = { user: false, help: false, list: false, version: false, agents: [] };
  const positional = [];
  for (const a of argv) {
    if (a === "--user" || a === "-u" || a === "--global" || a === "-g") opts.user = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else if (a === "--list" || a === "-l") opts.list = true;
    else if (a === "--version" || a === "-v" || a === "-V") opts.version = true;
    else if (a.startsWith("--agent=")) opts.agents.push(...a.slice("--agent=".length).split(","));
    else if (a.startsWith("--agents=")) opts.agents.push(...a.slice("--agents=".length).split(","));
    else positional.push(a);
  }
  // `--agent` followed by a value (space-separated)
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === "--agent" || argv[i] === "--agents") && argv[i + 1]) {
      opts.agents.push(...argv[i + 1].split(","));
    }
  }
  // positional that is a known agent (e.g. `npx kanban-skills codex`)
  for (const p of positional) {
    if (TARGETABLE.includes(p) || p === "all") opts.agents.push(p);
  }
  if (opts.agents.includes("all")) opts.agents = [...TARGETABLE];
  opts.agents = [...new Set(opts.agents.filter((a) => TARGETABLE.includes(a)))];
  if (opts.agents.length === 0) opts.agents = ["claude"]; // default
  return opts;
}

const HELP = `
kanban-skills — a lightweight, agent-agnostic Kanban skill set

Usage:
  npx kanban-skills [--agent <name[,name]>] [options]

Agents (one source, emitted per agent):
  claude     .claude/skills/<name>/SKILL.md            (default)
  codex      ~/.codex/prompts/<name>.md                (user-level only)
  opencode   .opencode/commands/<name>.md
  gemini     .gemini/commands/<name>.toml
  generic    .kanban-skills/prompts/<name>.md + AGENTS.md   (any AGENTS.md-aware agent)
  all        install for every agent above

Options:
  --agent <a,b>  Target agent(s), comma-separated (default: claude)
  --user, -g     Install at user level where supported (~/.* instead of project)
  --list, -l     List bundled skills and exit
  --version, -v  Print version
  --help, -h     Show this help

Examples:
  npx kanban-skills                       # Claude Code, this project
  npx kanban-skills --agent codex         # Codex CLI (user-level)
  npx kanban-skills --agent opencode,gemini
  npx kanban-skills --agent all           # every supported agent
  npx kanban-skills --user                # Claude Code, all your projects
`;

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.version) return void console.log(VERSION);
  if (opts.help) return void console.log(HELP);

  const skills = listSkills(SKILLS_SRC);

  if (opts.list) {
    console.log("Bundled skills:");
    for (const s of skills) console.log("  - " + s);
    return;
  }

  const scope = opts.user ? "user" : "project";
  console.log("");
  for (const agent of opts.agents) {
    const res = installAgent(agent, { skillsSrc: SKILLS_SRC, skills, scope });
    console.log(`✓ ${res.label} → ${res.dir}`);
    console.log("    " + skills.join(", "));
    if (res.assetsDir) console.log("    board assets → " + res.assetsDir);
    if (res.note) console.log("    note: " + res.note);
  }

  console.log("");
  console.log("Next steps:");
  console.log("  1. Run /kanban-init to scaffold the board (kanban.html + kanban.json).");
  console.log("  2. Add cards (or /kanban-brainstorm), light one up, then /kanban-implement.");
  console.log("  Commands are picked up live by most agents (Codex: restart; Gemini: /commands reload).");
}

main();
