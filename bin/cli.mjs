#!/usr/bin/env node
// kanban-skills — installer
// Installs the bundled Kanban skills into one or more coding agents.
// One canonical source (skills/) → emitted into each agent's command/prompt format.
// No runtime dependencies; pure Node.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { listSkills, installAgent, AGENT_NAMES } from "./agents.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_SRC = resolve(__dirname, "..", "skills");
const VERSION = "0.1.3";

const TARGETABLE = ["claude", "codex", "opencode", "gemini", "generic"];

function parseArgs(argv) {
  const opts = { user: false, project: false, help: false, list: false, version: false, agents: [] };
  const positional = [];
  for (const a of argv) {
    if (a === "--user" || a === "-u" || a === "--global" || a === "-g") opts.user = true;
    else if (a === "--project" || a === "-p" || a === "--local") opts.project = true;
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
  opts.scopeExplicit = opts.user || opts.project;
  return opts;
}

function ask(question) {
  return new Promise((res) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (a) => { rl.close(); res(a); });
  });
}

// Resolve install scope: explicit flag wins; else ask interactively on a TTY; else default project.
async function resolveScope(opts) {
  if (opts.scopeExplicit) return opts.user ? "user" : "project";
  if (!process.stdin.isTTY) return "project";
  const ans = (await ask(
    "\nWhere should the skills be installed?\n" +
    "  1) This project   — .claude/skills/ etc. (committable, per-repo)\n" +
    "  2) User level     — ~/.claude/skills/ etc. (all your projects)\n" +
    "Choose [1]: "
  )).trim().toLowerCase();
  return ans === "2" || ans === "user" || ans === "u" ? "user" : "project";
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
  --project, -p  Install into this project (.* dirs in the repo)
  --user, -g     Install at user level where supported (~/.* instead of project)
  --list, -l     List bundled skills and exit
  --version, -v  Print version
  --help, -h     Show this help

If neither --project nor --user is given, you'll be asked interactively
(defaults to project level when not running in a terminal).

Examples:
  npx kanban-skills                       # Claude Code, this project
  npx kanban-skills --agent codex         # Codex CLI (user-level)
  npx kanban-skills --agent opencode,gemini
  npx kanban-skills --agent all           # every supported agent
  npx kanban-skills --user                # Claude Code, all your projects
`;

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.version) return void console.log(VERSION);
  if (opts.help) return void console.log(HELP);

  const skills = listSkills(SKILLS_SRC);

  if (opts.list) {
    console.log("Bundled skills:");
    for (const s of skills) console.log("  - " + s);
    return;
  }

  const scope = await resolveScope(opts);
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

main().catch((err) => {
  console.error("kanban-skills: " + (err && err.message ? err.message : err));
  process.exit(1);
});
