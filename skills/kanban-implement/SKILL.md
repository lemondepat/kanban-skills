---
name: kanban-implement
description: Reads the tickets the current user has marked as "working" (lit up) in kanban.json, automatically figures out how to implement them and does so fully autonomously with the help of installed companion skills (including code changes), self-verifies according to the type of change (spin up a dedicated port and view UI changes in the browser, write and pass tests for backend changes), and finally produces an acceptance checklist. Changes are left in the working tree without committing; cards that are successfully implemented are set to "review" by this skill, waiting for the user to review them on the board and manually mark them done.
---

# /kanban-implement

Reads the tickets **the current user has lit up (working)** on the board, automatically figures out which installed companion skills to enlist, implements them fully autonomously, and finally hands the user an acceptance checklist. Complements `kanban-update` (the reverse: scan the code and mark tickets done); neither writes the fields the other is responsible for.

## Steps

### 1. Find work + confirm identity

The board is collaborative, so `litBy` may be someone else. The board username comes from the browser's `localStorage('triage-username')` (the CLI can't read it), and it's not the same as `git config user.name`. Therefore, determine identity **by who actually appears as the lighter on the board**.

1. If `kanban.json` does not exist → stop and tell the user.
2. Read `kanban.json` and take all tickets where `litBy ≠ null` and `done ≠ true` (scan both the `todo` and `backlog` arrays). Command:

   ```bash
   node -e "const d=require('./kanban.json');const all=[...(d.todo||[]),...(d.backlog||[])];const lit=all.filter(t=>t.litBy&&!t.done);console.log(JSON.stringify({byUser:[...new Set(lit.map(t=>t.litBy))],lit:lit.map(t=>({section:t.section,title:t.title,litBy:t.litBy}))},null,2))"
   ```

3. Branch by distinct `litBy`:
   - **0 people** → stop and prompt: "There are no lit (working) cards on the board. Go to /kanban and light up the cards you want to work on first, then come back."
   - **Only 1 person** → assume that's the user. List all the cards they've lit up and confirm with a single sentence: "Working on these, right?"
   - **Multiple people** → ask the user a multiple-choice question (on Claude Code: the `AskUserQuestion` tool; on other agents, present a numbered list and wait for their pick): "On the board, <list of names> each lit up cards. Whose do you want to work on?" and take only the selected person's cards.
4. Lock in the "user's set" of working tickets (record each one's `section`/`title`/which array it's in) and proceed to step 2.

### 2. Detect equipment (available companion skills)

List the companion skills/tools that are **actually available** right now in your harness (on Claude Code, e.g. `superpowers:brainstorming`, `superpowers:writing-plans`, `superpowers:test-driven-development`, `frontend-design`). Discover them however your harness exposes available skills/commands (on Claude Code: the available-skills section of the system-reminder); no external command enumeration is needed. **Do not hardcode a mapping table** — once listed, judge for yourself which ones to chain together based on the nature of each ticket.

### 3. Produce an overall plan (all at once, one user confirmation)

For each locked-in ticket, infer three things, aggregate them into a single overview, and present it to the user **all at once** for a single confirmation:

1. **What to implement** — expand terse phrases like "manually add a card" into a concrete change description.
2. **Which path to take** — which skill(s) to call and how to break it down.
3. **Which files are expected to be touched** — for the conflict grouping in step 4.

For tickets that are ambiguous in meaning or exploratory (e.g. starting with `[spike]`), flag them and ask the user **at this step**; don't leave them to stall the execution phase.

> Why brainstorming goes in this step: `brainstorming` is interactive (one question at a time), which conflicts with "fully autonomous execution." Its work is done all at once here in "produce the overall plan + one user confirmation"; the step 4 execution phase only chains the more automation-friendly skills.

The overview is best presented as a table: one row per ticket, columns = `section/title | what to implement | path (skill) | expected files | parallel batch`. Only proceed to step 4 after the user confirms.

### 4. Execute (smart grouping: parallelize non-conflicting, serialize conflicting)

After the user confirms the overall plan, execute fully autonomously, scheduling by file-conflict grouping.

> **On Claude Code:** drive this execution step with `/goal` to force it to run autonomously through to completion — don't stop to ask for confirmation mid-build (the plan was already confirmed in step 3). On other agents this aside doesn't apply; just proceed with the steps below.

Scheduling:

1. Take the "set of files expected to be touched" annotated for each ticket in step 3.
2. Tickets whose file sets **do not intersect** go into the same parallel batch; those that **do intersect** are split into different batches and serialized.
   - In practice: greedy batching — try to fit each ticket into an existing batch one by one; if its files intersect with any ticket already in that batch, start a new batch.
3. Within the same parallel batch, if your harness supports parallel sub-agents (on Claude Code: the `Agent` tool, one agent per ticket; on OpenCode: a command with `subtask`), write the tickets concurrently; if it doesn't, implement them one at a time. Different batches are executed sequentially, batch by batch.
4. Each implementation sub-agent's task description must include: the concrete change description for that ticket, the skill path to follow, and **permission to touch only the designated file set** (to prevent out-of-bounds edits that cause hidden conflicts).
5. All changes land in the **main working tree** (do not use a git worktree).

As soon as each ticket is implemented, immediately "self-verify + explain" it per step 5.

### 5. Per-ticket "self-verify + explain"

See the detailed recipe in `references/verification.md` under this skill's directory (read it when you reach this step). Key points:
- **Self-verify**: UI changes → spin up a dedicated port + actually view it in the browser; backend/logic changes → write enough tests to pass them, and hit the real endpoint when necessary; only when neither is possible, fall back to "needs manual verification" and state why.
- **Explain**: each ticket must come with a change list (file/function/what changed/why); for backend this is a hard requirement.

### 6. Set successful cards to "review" (write back to kanban.json)

For each ticket that is **successfully implemented and passes self-verification**, this skill (the main flow, not a sub-agent) writes back to `kanban.json`, setting it to "review" status — giving the user a prominent hint: "This one was done by an Agent, waiting for you to review."

> **The write-back must be done serially in the main flow; do not let parallel sub-agents write `kanban.json`** (it would race / overwrite). Sub-agents only change code; status is written uniformly by the main flow.

For each successful card, locate the item in `todo` / `backlog` by exact `title` match, and change these fields:

- `review: true`
- `reviewBy: "agent"` — always write `"agent"`, so the board badge shows "🔍 review · agent", making it obvious at a glance that a machine did it
- `reviewAt: <current ISO time>`
- `litBy: null` / `litAt: null` — clear "working"; review and working are mutually exclusive
- `updatedBy: "agent"` / `updatedAt: <current ISO time>`

**Never touch `done` / `doneBy` / `doneAt`** — whether something is done is decided by the user manually on the board after review. Cards that fail / don't pass self-verification are **not written back** and are left as-is (still lit); flag them in red in the checklist.

Keep the JSON valid with 2-space indentation before and after the write-back.

### 7. Deliver the acceptance checklist

Aggregate all tickets, one paragraph each, in the format:

```
▸ [section] ticket title
  Type: frontend / backend / mixed
  What changed:
    · <file> <function> — <change> (<why>)
  Self-verification: <port spun up + what was confirmed in the browser / new test names + whether all green + real endpoint results>
  You need to verify yourself: <none / specific items>
```

Flag failed tickets separately (e.g. `❌ [section] ticket title — failure reason: …`); they don't affect the delivery of the other tickets.

## Boundaries and constraints

- **No commit**: all changes are left in the working tree; the user decides whether to commit after reading the checklist.
- **Failure isolation**: a single ticket failing to implement / not passing self-verification → doesn't affect the others; flag it in red in the checklist with the reason; failed cards are not written back (stay lit).
- **Only write "review", never touch "done"**: this skill only writes `review` / `reviewBy` / `reviewAt` (and clears `litBy` / `litAt`) for successful cards; it **never** modifies `done` / `doneBy` / `doneAt` — done is set by the user manually after review.
- **Serial write-back**: `kanban.json` is written only by the main flow, serially; parallel sub-agents never touch `kanban.json`, to prevent races.
- **brainstorming is not triggered during the execution phase**: its work is done all at once in step 3 when producing the overall plan.
- **No git worktree**: changes land directly in the main working tree.
