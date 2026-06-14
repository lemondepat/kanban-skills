---
name: kanban-init
description: Scaffold a Kanban board from scratch in the current project — generate kanban.html (the bundled board template) and kanban.json (initial data), and wire the board's three routes into the host server if one is detected. Use this to drop the Kanban board into a new project; pairs with kanban-update / kanban-implement / kanban-brainstorm. Triggers when the user says "init the kanban", "set up a kanban", or "add the board to this project".
---

# /kanban-init

Stand up the whole Kanban board in the current project: copy out the board page `kanban.html` + initial data `kanban.json`, and if the project already has a server, wire the board into it (otherwise give the no-server way to open it). This is the bootstrapper for the board; once it's set up, use `kanban-brainstorm` (ideas → cards), `kanban-update` (scan code, mark done), and `kanban-implement` (build the cards you've lit up).

The board template ships inside this skill's `references/`, so it **does not depend on any existing board files in the target project** and can run in any new project.

## Steps

### 1. Pre-check: don't overwrite an existing board

Check whether `kanban.html` and `kanban.json` already exist in the project root.

- Neither exists → initialize normally.
- Either exists → **stop** and ask the user in one line: overwrite, skip that file, or abort. Never silently overwrite the user's existing board data (`kanban.json` may hold real tickets).

### 2. Infer the project identity (to fill template placeholders)

The template has two placeholders to replace, so multiple projects don't share one browser IndexedDB handle and the tab title stays readable:

- `__KANBAN_DB__` → IndexedDB database name, use `<project-slug>-kanban-v1`. The project slug is the project root directory name (lowercased, spaces/underscores → hyphens).
- `__KANBAN_TITLE__` → browser tab title, use `<project name> Kanban` (fall back to `Kanban` if no good name is available).

### 3. Generate kanban.html

Read `references/kanban.template.html`, replace the two placeholders with the values from step 2, and write to `kanban.html` in the project root.

Example replacement (you can also read the template string, replace, and persist with Write):

```bash
SLUG="$(basename "$PWD" | tr '[:upper:] ' '[:lower:]-' | tr '_' '-')"
sed -e "s/__KANBAN_DB__/${SLUG}-kanban-v1/" \
    -e "s/__KANBAN_TITLE__/${SLUG} Kanban/" \
    .claude/skills/kanban-init/references/kanban.template.html > kanban.html
```

> The `sed` path assumes the skill is installed at the project level (`.claude/skills/kanban-init/`), which is where `npx kanban-skills` installs it by default. If the skill lives elsewhere (e.g. user level `~/.claude/skills/kanban-init/`, or a plugin cache), change the template path accordingly.
> After generating, confirm `kanban.html` no longer contains any `__KANBAN_` placeholder.

### 4. Generate kanban.json

Copy `references/kanban.starter.json` to `kanban.json` in the project root. This is a valid empty board:

```json
{
  "colOrder": ["high", "mid", "low", "backlog"],
  "categories": [],
  "todo": [],
  "backlog": []
}
```

Optional: if the user has already named a few sections / initial tickets out loud, fill them into `categories` / `todo` / `backlog` following the schema (see end). Otherwise leave it empty — the user can add cards in the board, or run `/kanban-brainstorm`.

### 5. Detect and wire the server

Scan the project root to see if there's a host server to wire into:

```bash
ls server.mjs server.js app.mjs app.js 2>/dev/null; grep -rl "createServer\|express()" --include="*.mjs" --include="*.js" . 2>/dev/null | grep -v node_modules | head
```

- **Server found** → read `references/server-wiring.md` and insert the three routes `GET /kanban`, `GET /kanban.json`, `PUT /kanban.json` by server type (native Node / Express / serverless). Only add routes, before the static fallback, and don't touch other logic. **Crucially, include the localhost-only guard from that file** — the routes must only respond to loopback callers, because `PUT /kanban.json` lets a caller overwrite the data and the board must never be exposed once the app is deployed. After wiring, briefly state which file and section you inserted into.
- **No server** → don't force one. In the summary, give the user the two no-server options (see the end of `references/server-wiring.md`): ① open `kanban.html` directly in the browser and click "Open data file" to pick `kanban.json` (Chromium-based browsers only); ② run any static server yourself and visit it.

### 6. Delivery note

Give the user a short summary:

```
Board is set up:
  · kanban.html  (the board page, DB=<slug>-kanban-v1)
  · kanban.json  (empty starter board)
Server: <wired into server.mjs — visit http://localhost:<port>/kanban (localhost only)  /  no server detected, usage below>
Next: add tickets in the board (or run /kanban-brainstorm); then /kanban-update to mark done by scanning code, /kanban-implement to build the cards you've lit up.
```

Files stay in the working tree, **not committed** — the user decides when to commit.

## Boundaries & constraints

- **Don't overwrite existing data**: if `kanban.json` exists, ask first; never silently clobber real tickets.
- **Template is bundled**: the board page comes from this skill's `references/kanban.template.html`; do not read or depend on any old `kanban.html` that may exist in the target project.
- **Localhost-only routes**: when wiring into a server, always apply the loopback guard so the board is never reachable from a deployed/public address (see `references/server-wiring.md`).
- **Don't build a server**: if the project has no server, give the no-server usage; don't create a server file unless the user explicitly asks.
- **Don't commit**: generated files stay in the working tree.
- **Don't touch card state semantics**: this skill only produces the initial files; it doesn't participate in done/litBy/review state flow (that's kanban-update / kanban-implement / the board UI).

## kanban.json data schema (for reference when filling initial tickets)

Top level: `colOrder` (column order, fixed `["high","mid","low","backlog"]`), `categories` (array of section names, may be empty — when empty the board derives them from the tickets), `todo` (array), `backlog` (array).

`todo` item fields:
```json
{
  "section": "Core Flow", "title": "Card title", "description": "",
  "priority": "high",
  "done": false,
  "addedBy": null, "addedAt": null, "updatedBy": null, "updatedAt": null,
  "doneBy": null, "doneAt": null, "litBy": null, "litAt": null,
  "review": false, "reviewBy": null, "reviewAt": null
}
```
`priority` is `high` / `mid` / `low`, mapping to the board's high / medium / low priority columns respectively.

A card has three mutually exclusive active states: `litBy` set = **working** (amber); `review: true` = **review** (blue, usually set by `kanban-implement` when it finishes, with `reviewBy: "agent"`); `done: true` = **done** (grey). These field groups can all start at their defaults (`null` / `false`) and are written by board interactions or skills.

`backlog` items are the same as `todo` but **without** the `priority` field (they all go into the "Backlog" column).

Timestamps are ISO strings; they can all start as `null` and are filled in automatically by the page as the user interacts with the board.

## FAQ

| Symptom | Cause / fix |
|---------|-------------|
| Board stuck on welcome screen, not auto-loading | Not served from localhost, or `GET /kanban.json` isn't wired. Check the server routes or use "Open data file" mode |
| "Open data file" button does nothing | Browser isn't Chromium-based; Safari/Firefox don't support the File System Access API — use the local-server mode |
| Changes don't save | Serverless read-only filesystem, `PUT` fails; see server-wiring.md section 3 |
| `kanban.html` still contains `__KANBAN_` | Placeholders weren't fully replaced in step 3 — redo the replacement |
| Board reachable from a deployed URL | The localhost-only guard wasn't applied — see the security section of server-wiring.md and gate the routes |
