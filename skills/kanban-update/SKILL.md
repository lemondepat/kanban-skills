---
name: kanban-update
description: Scan the codebase, compare against the unfinished tickets in kanban.json, determine which features have already been implemented, have the user confirm via a CLI multi-select interaction, and write the result directly back to kanban.json.
---

# /kanban-update

Scan the codebase, compare against the unfinished tickets in the kanban, and determine which features have already been implemented. Ask the user to confirm via a CLI multi-select, then write the result directly back to `kanban.json`.

## Steps

### 1. Read unfinished tickets

Read `kanban.json` and extract all items with `done: false` (scan both the todo and backlog arrays).

Group the tickets by `section`, recording each one's `title`, the array it belongs to (todo/backlog), and its index within that array — you'll need these when writing back later.

If `kanban.json` does not exist, stop and notify the user.

### 2. Gather the current state of the code

Run the following commands in parallel and keep the results in context:

```bash
# Last 60 commits, to understand what has been done recently
git log --oneline -60

# List of primary source files
find web/ ios/ -type f \( -name "*.js" -o -name "*.mjs" -o -name "*.swift" -o -name "*.html" \) | sort
```

For larger module files (such as `web/views.js`, `web/tasks.js`, etc.), read key fragments on demand to determine whether a given feature exists — do not blindly read them in full. Use grep for targeted searches:

```bash
grep -r "keyword" web/ --include="*.js" -l
```

Be careful to distinguish:
- The code containing a feature ≠ the feature being finished
- A commit message mentioning it ≠ a complete implementation
- A variable/constant definition ≠ the feature being usable

### 3. Judge each ticket, in three tiers

Place each ticket into one of the following three tiers:

- **Tier A (almost certainly implemented)**: direct evidence found in the code (function/UI element exists, relevant commit landed)
- **Tier B (possibly implemented, uncertain)**: there are relevant signs but completeness or effectiveness is uncertain
- **Tier C (no implementation found)**: no relevant traces in the code

### 4. Output a brief

Output a concise text summary that includes:
- How many tickets are in each of A/B/C
- The title of each Tier A ticket + one line of evidence (filename + function name, or commit)
- The title of each Tier B ticket + the signs + the open questions
- For Tier C, only a section-level summary, not a per-ticket listing

### 5. Get the operating user's name

Get the operator's name via `git config user.name` and write it as `doneBy`. If it cannot be obtained, use `"cli"`.

### 6. Interactively confirm Tier A tickets

If the number of Tier A tickets > 0, confirm with the user via a multiple-choice prompt (on Claude Code: the `AskUserQuestion` tool with multi-select; on other agents, present a numbered list and let them pick several).

If your prompt UI caps the number of options (on Claude Code, `AskUserQuestion` shows at most 4), **ask in batches** within that cap, and label each batch with the current progress (e.g. "Batch 1 of 3").

Each option's `label` format: `[section] title (truncated to 30 chars)`

`multiSelect: true`, question text: `The following are almost certainly implemented — which do you confirm as done? (multi-select; leave unsure ones unselected)`

**If the user selects none (or selects Other and writes 0/none/skip), skip the write and continue to the next batch.**

### 7. Interactively confirm Tier B tickets

If the number of Tier B tickets > 0, likewise confirm via a multi-select prompt in batches, with the question text:
`The following are possibly implemented — which do you confirm as done? (leave unsure ones unselected)`

### 8. Write back to kanban.json

Write all the tickets the user confirmed (Tier A + the selected Tier B ones) back to `kanban.json` together:

- `done: true`
- `doneBy: <git user name>`
- `doneAt: <current ISO time>`
- `updatedBy: <git user name>`
- `updatedAt: <current ISO time>`
- Clean up intermediate states along the way: `review: false` / `reviewBy: null` / `reviewAt: null` / `litBy: null` / `litAt: null` (once a card is done it should no longer carry "review" or "working")

Read the current `kanban.json` → find the corresponding item (match exactly by `title`, because indices may shift due to filtering) → modify the fields → write back to the file (preserving 2-space indentation).

### 9. Output the result

```
Marked done: X tickets
  ✓ [section] title
  ✓ ...

Unchanged: Y tickets (user skipped or did not confirm)
```

---

## Notes

- Evidence must be specific: filename + function name, or commit hash — do not write vague descriptions like "there's related logic in the code"
- Tickets in the backlog (Backlog) are usually exploratory ideas, so the bar should be stricter — only count as Tier A when the core feature has fully landed
- Locate items by exact match on the `title` field, not by array index (because done:true items are filtered out on display, so indices may not line up)
- Validate the JSON's correctness before writing back; do not corrupt the file
