# kanban-skills

**A lightweight, agent-agnostic Kanban skill set — a tiny Jira for 1–2 people, where AI agents pick up and ship the cards.**

Works with [Claude Code](https://claude.com/claude-code), Codex CLI, OpenCode, Gemini CLI, and any agent that reads `AGENTS.md`. One source, installed into each agent's native command format.

Zero infrastructure: no server, no database, no daemon. The whole board is **one HTML file + one JSON file**, and the workflow is **four skills/commands**. The agent reads and writes the JSON directly — the file *is* the database, the agent *is* the backend.

> English · [中文](README.zh-CN.md)

---

## Why

Most "AI agent kanban" tools are full web apps (servers, SQLite, WebSockets, git-worktree orchestration). That's overkill when you're vibe-coding fast, solo or as a pair. `kanban-skills` keeps the complexity at the level the job actually needs:

- **One JSON file** holds your board (`kanban.json`) — diffable, git-friendly, editable by hand or by the agent.
- **One HTML file** is the board UI (`kanban.html`) — drag, edit, light up cards. No build step.
- **Four skills** drive the loop. They run *inside* your coding agent, so there's no separate process to keep alive.

## The loop

```
kanban-init        scaffold the board (html + json)
kanban-brainstorm  ideas → cards          [input]
kanban-implement   lit cards → code → review   [build]
kanban-update      code → done            [reconcile]
```

A card flows through three mutually-exclusive active states:

```
idle ──(double-click / ⚡)── working ──(agent done / 🔍)── review ──(✓)── done
       amber                          blue                       grey
```

- **working** (`litBy`) — someone picked it up.
- **review** (`review`) — finished and waiting for a human to check it. `kanban-implement` sets this to `reviewBy: "agent"` so you can see at a glance that a machine did it.
- **done** (`done`) — you clicked ✓ after reviewing.

## Install

### npm (npx) — any agent

One installer, pick your agent with `--agent`:

```bash
npx kanban-skills                       # Claude Code (default), this project
npx kanban-skills --agent codex         # Codex CLI (user-level)
npx kanban-skills --agent opencode      # OpenCode
npx kanban-skills --agent gemini        # Gemini CLI
npx kanban-skills --agent generic       # AGENTS.md + prompts/ (any AGENTS.md-aware agent)
npx kanban-skills --agent all           # every supported agent
npx kanban-skills --user                # install at user level where supported
```

Where each agent gets its commands:

| Agent | Installed to | Invoke |
|-------|--------------|--------|
| Claude Code | `.claude/skills/<name>/SKILL.md` | auto + `/name` |
| Codex CLI | `~/.codex/prompts/<name>.md` (user-level) | `/name` |
| OpenCode | `.opencode/commands/<name>.md` | `/name` |
| Gemini CLI | `.gemini/commands/<name>.toml` | `/name` (`/commands reload`) |
| Any other | `.kanban-skills/prompts/*.md` + `AGENTS.md` | point the agent at the prompt |

Re-run to upgrade. Commands are picked up live by most agents (Codex: restart; Gemini: `/commands reload`).

### Claude Code plugin

Or, on Claude Code, add this repo as a marketplace and install the plugin:

```
/plugin marketplace add lemondepat/kanban-skills
/plugin install kanban-skills@kanban-skills
```

## Quickstart

1. Install (above), then in Claude Code run **`/kanban-init`** — it scaffolds `kanban.html` + `kanban.json` and, if your project has a server, wires in three localhost-only routes.
2. Open the board (`http://localhost:<port>/kanban`, or open `kanban.html` directly in a Chromium browser and pick `kanban.json`).
3. Add cards yourself, or run **`/kanban-brainstorm`** and describe a goal — the agent turns it into structured cards.
4. **Light up** a card you want done (double-click), then run **`/kanban-implement`** — the agent builds it, self-verifies, and moves it to **review**.
5. Review the diff, click **✓**. Or run **`/kanban-update`** to scan the codebase and mark finished work done.

## The skills

| Skill | Direction | What it does |
|-------|-----------|--------------|
| `kanban-init` | bootstrap | Scaffolds the board; wires localhost-only routes into an existing server |
| `kanban-brainstorm` | input | Talks with you to turn ideas/goals into structured cards (and decompose existing ones) |
| `kanban-implement` | build | Builds the cards you've lit up, self-verifies, sets them to **review** |
| `kanban-update` | reconcile | Scans the code, asks you to confirm, marks cards **done** |

## Security

The board is a **local tool**. When `/kanban-init` wires routes into your server, it applies a **loopback-only guard**: the routes (including `PUT /kanban.json`, which can overwrite your data) only respond to `127.0.0.1` / `::1`, checked via the real TCP peer address (never the spoofable `X-Forwarded-For`). Once your app is deployed, those routes return `404` by design — your board is never public.

## Requirements

- A coding agent: [Claude Code](https://claude.com/claude-code), Codex CLI, OpenCode, Gemini CLI, or any agent that reads `AGENTS.md`
- Node.js ≥ 18 (for the `npx` installer only)
- A Chromium-based browser if you use the no-server "Open data file" mode (the File System Access API)

## License

MIT © lemondepat
