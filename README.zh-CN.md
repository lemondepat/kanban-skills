# kanban-skills

**一套与 agent 无关的轻量 Kanban 技能集——给 1～2 个人用的迷你 Jira，AI agent 直接领卡、把卡做完。**

支持 [Claude Code](https://claude.com/claude-code)、Codex CLI、OpenCode、Gemini CLI，以及任何读 `AGENTS.md` 的 agent。一份源，安装时转成各家原生命令格式。

零基础设施：没有服务器、没有数据库、没有常驻进程。整个看板就是**一个 HTML + 一个 JSON**，工作流就是**四个 skill / 命令**。agent 直接读写这个 JSON——**文件就是数据库，agent 就是后端**。

> [English](README.md) · 中文

## 为什么

市面上大多数「AI agent 看板」都是完整的 Web 应用（服务、SQLite、WebSocket、git worktree 编排）。当你一个人或两个人在飞快 vibe coding 时，那套太重了。`kanban-skills` 把复杂度压到这件事真正需要的程度：

- **一个 JSON 文件**装下整个看板（`kanban.json`）——可 diff、对 git 友好、人和 agent 都能改。
- **一个 HTML 文件**就是看板界面（`kanban.html`）——拖拽、编辑、点亮卡片，无需构建。
- **四个 skill**驱动闭环。它们跑在你的 coding agent *内部*，没有额外进程要维护。

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

### npm（npx）— 任意 agent

一个安装器，用 `--agent` 选目标：

```bash
npx kanban-skills                       # Claude Code（默认），当前项目
npx kanban-skills --agent codex         # Codex CLI（用户级）
npx kanban-skills --agent opencode      # OpenCode
npx kanban-skills --agent gemini        # Gemini CLI
npx kanban-skills --agent generic       # AGENTS.md + prompts/（任何读 AGENTS.md 的 agent）
npx kanban-skills --agent all           # 全部支持的 agent
npx kanban-skills --user                # 支持的地方装到用户级
```

如果不传 `--project` 或 `--user`，安装器会**交互询问**装到当前项目（`.claude/skills/` 等，可随仓库提交）还是用户级（`~/.claude/skills/`，对所有项目生效）。传 flag 即可跳过询问（如 CI 场景）。

各 agent 命令装到哪里：

| Agent | 安装位置 | 调用 |
|-------|----------|------|
| Claude Code | `.claude/skills/<name>/SKILL.md` | 自动 + `/name` |
| Codex CLI | `~/.codex/prompts/<name>.md`（用户级） | `/name` |
| OpenCode | `.opencode/commands/<name>.md` | `/name` |
| Gemini CLI | `.gemini/commands/<name>.toml` | `/name`（`/commands reload`） |
| 其它任意 | `.kanban-skills/prompts/*.md` + `AGENTS.md` | 让 agent 读对应提示词 |

重跑即升级。多数 agent 即时生效（Codex 需重启；Gemini 用 `/commands reload`）。

### Claude Code 插件

或者在 Claude Code 上把本仓库加为 marketplace 再装插件：

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

- 一个 coding agent：[Claude Code](https://claude.com/claude-code)、Codex CLI、OpenCode、Gemini CLI，或任何读 `AGENTS.md` 的 agent
- Node.js ≥ 18（仅 `npx` 安装器需要）
- 用无服务器的「打开数据文件」模式时，需要 Chromium 系浏览器（File System Access API）

## 许可

MIT © lemondepat
