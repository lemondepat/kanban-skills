# kanban-skills

**A lightweight Kanban skill set for [Claude Code](https://claude.com/claude-code) — a tiny Jira for 1–2 people, where AI agents pick up and ship the cards.**

Zero infrastructure: no server, no database, no daemon. The whole board is **one HTML file + one JSON file**, and the workflow is **four skills**. The agent reads and writes the JSON directly — the file *is* the database, the agent *is* the backend.

> English below · [中文见下方](#中文)

---

## Why

Most "AI agent kanban" tools are full web apps (servers, SQLite, WebSockets, git-worktree orchestration). That's overkill when you're vibe-coding fast, solo or as a pair. `kanban-skills` keeps the complexity at the level the job actually needs:

- **One JSON file** holds your board (`kanban.json`) — diffable, git-friendly, editable by hand or by the agent.
- **One HTML file** is the board UI (`kanban.html`) — drag, edit, light up cards. No build step.
- **Four skills** drive the loop. They run *inside* Claude Code, so there's no separate process to keep alive.

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

### Option A — npm (npx)

Install the skills into the current project's `.claude/skills/`:

```bash
npx kanban-skills
```

Or install for all your projects (user level, `~/.claude/skills/`):

```bash
npx kanban-skills --user
```

Re-run with `--force` to upgrade. Skills are picked up live — no restart needed.

### Option B — Claude Code plugin

Add this repo as a marketplace, then install the plugin:

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

- [Claude Code](https://claude.com/claude-code)
- Node.js ≥ 18 (for the `npx` installer only)
- A Chromium-based browser if you use the no-server "Open data file" mode (the File System Access API)

## License

MIT © lemondepat

---

<a name="中文"></a>

# kanban-skills（中文）

**一套面向 [Claude Code](https://claude.com/claude-code) 的轻量 Kanban 技能集——给 1～2 个人用的迷你 Jira，AI agent 直接领卡、把卡做完。**

零基础设施：没有服务器、没有数据库、没有常驻进程。整个看板就是**一个 HTML + 一个 JSON**，工作流就是**四个 skill**。agent 直接读写这个 JSON——**文件就是数据库，agent 就是后端**。

## 为什么

市面上大多数「AI agent 看板」都是完整的 Web 应用（服务、SQLite、WebSocket、git worktree 编排）。当你一个人或两个人在飞快 vibe coding 时，那套太重了。`kanban-skills` 把复杂度压到这件事真正需要的程度：

- **一个 JSON 文件**装下整个看板（`kanban.json`）——可 diff、对 git 友好、人和 agent 都能改。
- **一个 HTML 文件**就是看板界面（`kanban.html`）——拖拽、编辑、点亮卡片，无需构建。
- **四个 skill**驱动闭环。它们跑在 Claude Code *内部*，没有额外进程要维护。

## 闭环

```
kanban-init        搭看板（html + json）
kanban-brainstorm  想法 → 卡          [输入]
kanban-implement   点亮的卡 → 代码 → 待验   [执行]
kanban-update      代码 → 完成        [回填]
```

每张卡有三种互斥的活跃态：

```
闲置 ──(双击 / ⚡)── 在做 ──(agent 做完 / 🔍)── 待验 ──(✓)── 完成
       橙                    蓝                       灰
```

- **在做**（`litBy`）——有人领了这张卡。
- **待验**（`review`）——做完了，等人来验。`kanban-implement` 会把它置成 `reviewBy: "agent"`，让你一眼看出是机器做的。
- **完成**（`done`）——你 review 后点了 ✓。

## 安装

### 方式 A — npm（npx）

把 skills 装进当前项目的 `.claude/skills/`：

```bash
npx kanban-skills
```

或装到用户级、对所有项目生效（`~/.claude/skills/`）：

```bash
npx kanban-skills --user
```

加 `--force` 重装升级。skills 即时生效，无需重启。

### 方式 B — Claude Code 插件

把本仓库加为 marketplace，再安装插件：

```
/plugin marketplace add lemondepat/kanban-skills
/plugin install kanban-skills@kanban-skills
```

## 快速上手

1. 安装后，在 Claude Code 里运行 **`/kanban-init`**——它会生成 `kanban.html` + `kanban.json`，若项目有服务器还会挂上三个**只允许 localhost** 的路由。
2. 打开看板（`http://localhost:<端口>/kanban`，或用 Chromium 浏览器直接打开 `kanban.html` 选 `kanban.json`）。
3. 自己加卡，或运行 **`/kanban-brainstorm`** 说一个目标——agent 帮你拆成结构化卡片。
4. **点亮**你要做的卡（双击），运行 **`/kanban-implement`**——agent 做完、自证，并把卡移到**待验**。
5. 看一眼 diff，点 **✓**；或运行 **`/kanban-update`** 扫代码库、确认后标完成。

## 四个 skill

| Skill | 方向 | 作用 |
|-------|------|------|
| `kanban-init` | 引导 | 搭看板；把只允许 localhost 的路由挂到已有服务器 |
| `kanban-brainstorm` | 输入 | 跟你对话，把想法/目标变成结构化卡片（也能拆已有卡） |
| `kanban-implement` | 执行 | 实现你点亮的卡、自证、置为**待验** |
| `kanban-update` | 回填 | 扫代码、请你确认、标卡**完成** |

## 安全

看板是**本地工具**。`/kanban-init` 往服务器挂路由时会加**只允许回环地址的守卫**：这些路由（含能覆写数据的 `PUT /kanban.json`）只对 `127.0.0.1` / `::1` 响应，且用真实 TCP 对端地址判断（绝不信任可伪造的 `X-Forwarded-For`）。一旦你的 app 部署上线，这些路由按设计返回 `404`——你的看板永远不会被公开。

## 依赖

- [Claude Code](https://claude.com/claude-code)
- Node.js ≥ 18（仅 `npx` 安装器需要）
- 用无服务器的「打开数据文件」模式时，需要 Chromium 系浏览器（File System Access API）

## 许可

MIT © lemondepat
