// Per-agent emit logic for kanban-skills.
// One canonical source (skills/<name>/SKILL.md, harness-neutral with "on Claude Code: X"
// asides) is transformed into each agent's command/prompt format at install time.

import {
  readFileSync, writeFileSync, mkdirSync, cpSync, existsSync,
  readdirSync, statSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

// Skills (besides kanban-init) carry no assets. kanban-init needs these three.
const ASSET_FILES = ["kanban.template.html", "kanban.starter.json", "server-wiring.md"];

export function listSkills(skillsSrc) {
  return readdirSync(skillsSrc).filter((name) => {
    const p = join(skillsSrc, name);
    return statSync(p).isDirectory() && existsSync(join(p, "SKILL.md"));
  });
}

// Parse `--- ... ---` frontmatter. Values are single-line. Returns { data, body }.
function parseSkill(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: md };
  const data = {};
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^([\w-]+):\s*(.*)$/);
    if (mm) data[mm[1]] = mm[2].trim();
  }
  return { data, body: m[2].replace(/^\n+/, "") };
}

// Rewrite kanban-init's bundled-asset path (references/) to a concrete dir for non-Claude agents.
function rewriteAssets(name, body, assetsRef) {
  if (name !== "kanban-init") return body;
  return body.split("references/").join(assetsRef.replace(/\/?$/, "/"));
}

function copyAssets(skillsSrc, destDir) {
  mkdirSync(destDir, { recursive: true });
  const refs = join(skillsSrc, "kanban-init", "references");
  for (const f of ASSET_FILES) cpSync(join(refs, f), join(destDir, f));
}

// ── Agent definitions ───────────────────────────────────────────────────────
// Each returns a list of { target, action } describing where files go.

const AGENTS = {
  claude: {
    label: "Claude Code",
    install({ skillsSrc, skills, scope }) {
      const base = scope === "user" ? homedir() : process.cwd();
      const root = join(base, ".claude", "skills");
      mkdirSync(root, { recursive: true });
      const written = [];
      for (const name of skills) {
        // Claude uses the canonical skill dir as-is (SKILL.md + references/).
        cpSync(join(skillsSrc, name), join(root, name), { recursive: true, force: true });
        written.push(join(root, name, "SKILL.md"));
      }
      return { dir: root, written };
    },
  },

  codex: {
    label: "Codex CLI",
    // Codex custom prompts are user-level only (~/.codex/prompts).
    install({ skillsSrc, skills }) {
      const dir = join(homedir(), ".codex", "prompts");
      mkdirSync(dir, { recursive: true });
      const assetsDir = join(homedir(), ".kanban-skills");
      const written = [];
      let assetsCopied = false;
      for (const name of skills) {
        const { data, body } = parseSkill(readFileSync(join(skillsSrc, name, "SKILL.md"), "utf8"));
        if (name === "kanban-init") { copyAssets(skillsSrc, assetsDir); assetsCopied = true; }
        const out = rewriteAssets(name, body, assetsDir);
        const fm = `---\ndescription: ${JSON.stringify(data.description || name)}\n---\n\n`;
        const file = join(dir, `${name}.md`);
        writeFileSync(file, fm + out);
        written.push(file);
      }
      return { dir, written, assetsDir: assetsCopied ? assetsDir : null, note: "Codex prompts are user-level (~/.codex/prompts); deprecated but functional." };
    },
  },

  opencode: {
    label: "OpenCode",
    install({ skillsSrc, skills, scope }) {
      const base = scope === "user" ? join(homedir(), ".config", "opencode") : join(process.cwd(), ".opencode");
      const dir = join(base, "commands");
      mkdirSync(dir, { recursive: true });
      const assetsDir = scope === "user" ? join(homedir(), ".kanban-skills") : join(process.cwd(), ".kanban-skills");
      const assetsRef = scope === "user" ? assetsDir : ".kanban-skills";
      const written = [];
      let assetsCopied = false;
      for (const name of skills) {
        const { data, body } = parseSkill(readFileSync(join(skillsSrc, name, "SKILL.md"), "utf8"));
        if (name === "kanban-init") { copyAssets(skillsSrc, assetsDir); assetsCopied = true; }
        const out = rewriteAssets(name, body, assetsRef);
        const fm = `---\ndescription: ${JSON.stringify(data.description || name)}\n---\n\n`;
        const file = join(dir, `${name}.md`);
        writeFileSync(file, fm + out);
        written.push(file);
      }
      return { dir, written, assetsDir: assetsCopied ? assetsDir : null };
    },
  },

  gemini: {
    label: "Gemini CLI",
    install({ skillsSrc, skills, scope }) {
      const base = scope === "user" ? join(homedir(), ".gemini") : join(process.cwd(), ".gemini");
      const dir = join(base, "commands");
      mkdirSync(dir, { recursive: true });
      const assetsDir = scope === "user" ? join(homedir(), ".kanban-skills") : join(process.cwd(), ".kanban-skills");
      const assetsRef = scope === "user" ? assetsDir : ".kanban-skills";
      const written = [];
      let assetsCopied = false;
      for (const name of skills) {
        const { data, body } = parseSkill(readFileSync(join(skillsSrc, name, "SKILL.md"), "utf8"));
        if (name === "kanban-init") { copyAssets(skillsSrc, assetsDir); assetsCopied = true; }
        let out = rewriteAssets(name, body, assetsRef);
        out = out.split("'''").join("''  '"); // guard: keep TOML literal delimiter unambiguous
        const desc = JSON.stringify(data.description || name);
        const content = `description = ${desc}\nprompt = '''\n${out}\n'''\n`;
        const file = join(dir, `${name}.toml`);
        writeFileSync(file, content);
        written.push(file);
      }
      return { dir, written, assetsDir: assetsCopied ? assetsDir : null };
    },
  },

  generic: {
    label: "Generic (AGENTS.md)",
    install({ skillsSrc, skills, scope }) {
      const base = scope === "user" ? homedir() : process.cwd();
      const kdir = join(base, ".kanban-skills");
      const promptsDir = join(kdir, "prompts");
      mkdirSync(promptsDir, { recursive: true });
      const assetsRef = scope === "user" ? kdir : ".kanban-skills";
      const written = [];
      const entries = [];
      let assetsCopied = false;
      for (const name of skills) {
        const { data, body } = parseSkill(readFileSync(join(skillsSrc, name, "SKILL.md"), "utf8"));
        if (name === "kanban-init") { copyAssets(skillsSrc, kdir); assetsCopied = true; }
        const out = rewriteAssets(name, body, assetsRef);
        const file = join(promptsDir, `${name}.md`);
        writeFileSync(file, `# /${name}\n\n${data.description || ""}\n\n${out}`);
        written.push(file);
        entries.push({ name, description: data.description || "" });
      }
      const agentsMd = join(base, "AGENTS.md");
      writeAgentsBlock(agentsMd, entries);
      written.push(agentsMd);
      return { dir: promptsDir, written, assetsDir: assetsCopied ? kdir : null };
    },
  },
};

const START = "<!-- kanban-skills:start -->";
const END = "<!-- kanban-skills:end -->";

function writeAgentsBlock(file, entries) {
  const lines = [
    START,
    "## kanban-skills (workflow commands)",
    "",
    "This project uses [kanban-skills](https://github.com/lemondepat/kanban-skills). When the user invokes one of these commands, read the matching prompt file under `.kanban-skills/prompts/` and follow it exactly:",
    "",
    ...entries.map((e) => `- \`/${e.name}\` → \`.kanban-skills/prompts/${e.name}.md\` — ${e.description}`),
    "",
    END,
  ];
  const block = lines.join("\n");
  let content = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (content.includes(START) && content.includes(END)) {
    content = content.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
  } else {
    content = (content.trim() ? content.trimEnd() + "\n\n" : "") + block + "\n";
  }
  writeFileSync(file, content);
}

export const AGENT_NAMES = Object.keys(AGENTS);

export function installAgent(agent, ctx) {
  const def = AGENTS[agent];
  if (!def) throw new Error(`Unknown agent: ${agent}`);
  return { label: def.label, ...def.install(ctx) };
}
