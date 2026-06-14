---
name: kanban-brainstorm
description: Talk with the user to turn ideas / goals into structured cards in kanban.json, and also reshape existing cards on the board (split big cards into subcards, fill in card descriptions). Adaptive depth: when the requirement is clear, draft cards directly and confirm in one pass; when it is vague or oversized, clarify one question at a time before drafting cards. New cards are never assigned (whoever does it lights it up on the board). It is the mirror of kanban-implement (card → code), turning ideas → cards, and pairs with kanban-update / kanban-init. Triggers when the user says "help me break X into cards", "plan what to do next phase", "split this card / add a description".
---

# /kanban-brainstorm

Talk with the user to turn the work in their head into structured, independently completable cards in `kanban.json`, and also reshape existing cards. It is the reverse of `kanban-implement`: implement turns "lit cards" into code, brainstorm turns "ideas" into cards.

The core is **adaptiveness**: if the requirement is clear enough (you can write the four elements "section / title / priority / description" without guessing) then draft directly and confirm in one pass to write; if it is vague or oversized then clarify one question at a time first. It **only handles "defining" cards, never participates in execution-state transitions** (does not touch `done`/`review`/`litBy`), and **does not assign** — whoever does it goes to the board and lights it up.

## Steps

### 1. Read board context

Read the project-root `kanban.json` to get:

- `categories` (existing section names) — prefer reusing them when drafting cards, to keep categorization consistent.
- The `title` of existing cards in `todo` / `backlog` — to avoid drafting duplicate cards.
- `colOrder` — fixed as `["high","mid","low","backlog"]`, to understand the priority-to-column mapping.

If `kanban.json` does not exist → stop and prompt the user to run `/kanban-init` first.

### 2. Determine input type + depth (adaptive)

First recognize which category the user's input falls into this time:

- **A single feature / goal** → break it into a few cards.
- **Global planning** ("help me think about what to do next phase", "what's this project still missing") → produce a batch of cards covering multiple sections.
- **Pointing at an existing card** ("split this big card", "add a description to this one") → reshape the existing card (see Step 4).

Then judge clarity, with the sole criterion: **can you write each card's four elements "section / title / priority / description" without guessing**.

- Yes → go directly to Step 4 to draft.
- No (vague requirement, fuzzy goal, oversized scope with unclear boundaries) → go to Step 3 to clarify.

> Adaptive means this step judges and switches on its own. When the requirement is clear, don't waste the user's time forcing questions for the sake of process; when it's vague, don't force-guess a pile of nonsensical cards either.

### 3. (As needed) Clarify one at a time

Enter only when Step 2 judges it vague. Ask one question at a time (multiple-choice preferred, open-ended is fine too), and probe the goal until it **can be turned into a card**. Focus on four directions:

- What the real problem to solve is (not the surface feature).
- Boundaries: how far this goes, what it doesn't do.
- Priority cues: urgent or not, core or exploratory.
- Which section it belongs to (against the `categories` from Step 1).

Stop once you've asked enough, don't over-probe. For a **genuinely complex goal that needs architecture / solution design**, you can invoke `superpowers:brainstorming` for a round of in-depth design, then turn its output into cards — but routine card-splitting doesn't need it.

### 4. Draft cards

Define the four elements for each card:

- **section**: prefer reusing an existing section from `categories`; only propose a new section when there really isn't a suitable one, and note "this is a new section" at confirmation time.
- **title**: one sentence, verb-first, at a granularity one person can complete independently. If too big, keep splitting into multiple cards; exploratory prefixes like `[spike]` can be kept to follow the project's convention.
- **priority**: `high`/`mid`/`low` → goes into the corresponding `todo` column; exploratory / non-urgent / idea-like → goes into `backlog` (backlog cards carry **no** `priority`). Give a one-sentence rationale for each.
- **description**: supplementary context, acceptance points, related info (can be empty).

When **reshaping an existing card**, spell out the change clearly:

- **Split a card**: `split [section] original card title → subcards a / b / c`. The handling of the original big card = **by default replace it with the subcards (delete the original)**, but this **must be stated clearly at confirmation in Step 5**, and the user can change it to keep the original. Never silently delete a card.
- **Add a description / reword**: `add a description to a card in [section]: …`, located by exact match on `title`.

### 5. List + confirm in one pass

Present all drafted cards in a table at once and ask the user to **confirm in one pass**. Suggested columns:

| Action | section | title | priority/column | description summary |
|--------|---------|-------|-----------------|---------------------|
| Create | Core Flow | … | high / todo | … |
| Split (replace original X) | Design & Experience | …(subcard) | mid / todo | … |
| Add description | iOS/Platform | …(existing card) | — | … |

For anything involving a new section or splitting that deletes the original card, point it out separately below the table. Ask the user in one sentence: **which ones to keep, which to drop, whether section/priority/wording should change**. If the user hasn't confirmed any single card, stop and don't write.

### 6. Write back to kanban.json

Read the current `kanban.json` → modify according to the confirmed result from Step 5 → write back (keep 2-space indentation, valid JSON).

**Operator name**: take `git config user.name`; if unavailable, use `"cli"`.

**New cards**, push to the target array, with fields as follows (**no `litBy`, no assignment**):

```json
{
  "section": "<section>", "title": "<title>", "description": "<description or empty string>",
  "priority": "high",
  "done": false,
  "addedBy": "<operator>", "addedAt": "<ISO time>",
  "updatedBy": "<operator>", "updatedAt": "<ISO time>",
  "doneBy": null, "doneAt": null,
  "litBy": null, "litAt": null,
  "review": false, "reviewBy": null, "reviewAt": null
}
```

> `backlog` cards **drop** the `priority` field; everything else is the same.

**Reshaping existing cards**:

- Split (replace): remove the original big card from its array, push the new subcards (subcard fields as above). If the user chooses to keep it, keep the original card and only push the subcards.
- Add description: locate the item by exact match on `title`, change `description`, and update `updatedBy`/`updatedAt`.

**Never modify** the execution-state fields `done`/`doneBy`/`doneAt`/`litBy`/`litAt`/`review`/`reviewBy`/`reviewAt` (on creation they take the defaults above; when reshaping existing cards, leave them as-is).

### 7. Summary

Give a brief result:

```
This pass: added X, reshaped Y
  + [section] new card title (priority/column)
  ✂ [section] split original card → subcard a / subcard b (original replaced)
  ✎ [section] added a description to a card
Next step: go to the board and light up the cards you want to do; afterwards you can use /kanban-implement to let the agent implement the lit cards.
```

The file stays in the working tree, **not committed**.

## Boundaries & constraints

- **No assignment**: new cards never write `litBy` and add no assignee concept. "Who does what" is decided by people lighting cards up on the board (litBy), not at the card-drafting stage.
- **Only touch "definition" fields**: this skill only reads/writes `title`/`section`/`description`/`priority`/`addedBy`/`addedAt`/`updatedBy`/`updatedAt`. **Never** touch execution-state fields like `done`/`review`/`litBy` — those are the responsibility of board interaction, `kanban-update`, and `kanban-implement`.
- **Confirm before writing back**: don't write `kanban.json` before the user confirms in Step 5, and don't silently overwrite existing cards.
- **No silent deletion when splitting**: replacing the original big card must be stated clearly at confirmation, with the user deciding to keep or replace.
- **No commit**: generated / modified content stays in the working tree, the user decides when to commit.
- **No over-clarifying**: when the requirement is clear, draft cards directly; clarify only when vague, and stop once you've asked enough.

## Relationship to other skills

| Skill | Direction | Responsibility |
|-------|-----------|----------------|
| kanban-init | Bootstrap | Build the board (html + json) |
| **kanban-brainstorm** | **Input** | **Idea → card (this skill)** |
| kanban-implement | Execute | Lit card → code → review |
| kanban-update | Backfill | Scan code → mark done |

## Notes

- Prefer reusing `categories`, create few new sections — section explosion makes the board messy.
- Card granularity should err small rather than big: one card = something one person can finish and accept independently. Big cards with unclear boundaries should be split or clarified first.
- Before drafting cards, deduplicate against existing cards' `title` — don't redraft work that already exists.
- Validate JSON validity before and after writing back, and locate existing cards by exact match on `title` (not by index — the board filters on display, so indices are unreliable).
