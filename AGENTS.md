# AGENTS.md — kanban-skills (contributor guide)

This repo is the **source** for `kanban-skills`: a lightweight, agent-agnostic Kanban skill set distributed via npm and as a Claude Code plugin. (This file is for people/agents *working on this repo*. End users get a generated `AGENTS.md` in their own project when they install with `--agent generic`.)

## Layout

```
skills/                 canonical source of truth (one set, harness-neutral)
  kanban-init/          scaffolds the board; bundles references/ (template, starter, server-wiring)
  kanban-brainstorm/    ideas → cards
  kanban-implement/     lit cards → code → review
  kanban-update/        code → done
bin/
  cli.mjs               npx entry; --agent flag
  agents.mjs            per-agent emit (transforms skills/ into each agent's format)
.claude-plugin/
  plugin.json           Claude Code plugin manifest
  marketplace.json      marketplace listing (source: ./)
README.md / README.zh-CN.md
```

## One source → multi-emit

`skills/<name>/SKILL.md` is the single source. Bodies are **harness-neutral with "on Claude Code: X" asides** so they work everywhere and degrade gracefully. At install time, `bin/agents.mjs` transforms each skill into the target agent's convention:

| Agent | Output | Frontmatter |
|-------|--------|-------------|
| claude | `.claude/skills/<name>/SKILL.md` (+ references/) | unchanged (copied as-is) |
| codex | `~/.codex/prompts/<name>.md` (user-level) | `description` |
| opencode | `.opencode/commands/<name>.md` | `description` |
| gemini | `.gemini/commands/<name>.toml` | TOML `description` + `prompt` (`'''` literal) |
| generic | `.kanban-skills/prompts/<name>.md` + `AGENTS.md` block | none |

`kanban-init` bundles board assets in `skills/kanban-init/references/`. For non-Claude agents the installer copies them to `.kanban-skills/` and rewrites the `references/` path in the emitted command.

## Editing rules

- **Edit `skills/` only** — never hand-edit emitted output; it's regenerated.
- Keep bodies harness-neutral: when a step needs a Claude-specific tool, phrase it generically and add an `(on Claude Code: …)` aside.
- The data contract (English keys: `section`, `title`, `description`, `priority`; values `high`/`mid`/`low`) and card states (`litBy` = working, `review` = review, `done` = done) must stay consistent across `skills/` and `kanban.template.html`.
- The board (`kanban.template.html`) and data (`kanban.json`) are agent-agnostic — no agent-specific code there.

## Test

```bash
node --check bin/cli.mjs && node --check bin/agents.mjs   # syntax
node bin/cli.mjs --list                                    # list skills
HOME=$(mktemp -d) node bin/cli.mjs --agent all             # emit all formats into a temp home
npm pack --dry-run                                          # what ships
claude plugin validate .                                    # plugin/marketplace manifest
```

When changing the board template, also re-verify the inline `<script>` parses and the four card states (idle / working / review / done) render with the right class + badge.
