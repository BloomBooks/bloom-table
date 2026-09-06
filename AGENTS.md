# bloom-table — project instructions for agents

A TypeScript library for editing tables in plain HTML. Solo side project, one developer, no
team process around it. It is not part of Bloom's YouTrack and board workflow, so several
team-wide conventions do not apply here. The overrides are below.

## Issue tracker: there is none

**This project does not use an issue tracker.** No YouTrack, no GitHub Issues, no cards. There
are no ticket ids, so no id format exists, and no tracker skill talks to anything.

Every skill that wants a tracker skips its tracker steps here and notes the skip once. That
covers `preflight` (the PR-link comment, the QA test-ideas comment, the report link) and
`pr-ready-for-human` (the card link and the ready-for-peer-review state). Do not go looking for
a card, and do not ask which tracker this repo uses: the answer is none, permanently.

Where a skill would have posted to a card, put the text in the PR instead, or in the chat report.

## Branch names carry no ticket id

The team rule "branch names start with the ticket id" cannot apply, because there are no ids.
Name a branch after the work in 2 to 4 words: `nested-table-scroll`, `menu-grip-strip`. Review
branches follow the pattern in the next section.

## Code review: Devin reviews a pull request, so every review needs one

Most of this project's history landed straight on `master` with no pull request, and Devin only
reviews a pull request. So a review here means building a pull request whose diff is the code we
want read, even when that code is already merged.

### Devin needs a manual trigger here

This repo has no `pr-automation.yml`, so nothing triggers Devin when you push. A review starts
only when someone loads the review page. Load it through the `chrome-devtools` CLI in an
unauthenticated isolated context, which consumes no credits:

```
chrome-devtools start &
chrome-devtools new_page "https://app.devin.ai/review/BloomBooks/bloom-table/pull/<n>" \
  --isolatedContext "devin-noauth" &
```

Then close the tab. Reading the state needs no browser at all: both
`https://app.devin.ai/api/pr-review/jobs` and `.../job-result/<job>/<version>` answer plain
`curl --compressed`. A review of a 3000-line slice took about 8 minutes.

### The `reviewed` marker branch

The branch `reviewed` on `origin` is a marker, not a line of development. It points at the last
commit whose code Devin has reviewed. It holds no work of its own and it is never merged into
`master`.

Advance it by force-pushing the new marker commit after a review finishes:

```
git push --force origin <reviewed-commit>:reviewed
```

### Reviewing new work (the normal case, from now on)

1. Branch off `master`, do the work, commit.
2. Run `/preflight`. It gates, pushes, opens a draft pull request against `master`, and drives
   Devin plus CI to a terminal state.
3. After your own review, run `/pr-ready-for-human`, or just merge it.
4. Advance `reviewed` to the merge commit.

### Reviewing code that is already on `master` (the backlog)

Take one slice of history at a time, oldest first. For each slice:

1. Create a branch at the slice's last commit: `git branch review-<n> <slice-end-sha>`.
2. Push it, and open a **draft** pull request with head `review-<n>` and base `reviewed`. The
   diff is then exactly the slice.
3. Run the `devin-review` skill on that pull request. Collect the findings.
4. **Do not run the local quality gate or apply fixes on the review branch.** It is an old tree.
   A fix made there cannot merge forward and a gate failure there is history, not a defect to
   chase.
5. Apply each finding that still matters to the **current** `master`, on a normal work branch
   with a normal `/preflight`. Dismiss any finding whose code no longer exists, and say so on
   the review thread.
6. Advance `reviewed` to the slice's last commit, close the review pull request without merging,
   and delete `review-<n>`.

The backlog starts at `ae05734`. Everything before that commit was already reviewed by a
multi-agent pass on 2026-08-12; `CODE-REVIEW-FINDINGS.md` records it, and commit `ad35520`
applied its 49 confirmed bug fixes.

Backlog slices, oldest first:

| Slice | Range | Size | Contents |
| --- | --- | --- | --- |
| 1 | `ae05734`..`ad35520` | 47 files, 3409 insertions | The 49 bug fixes from the 2026-08-12 review |
| 2 | `ad35520`..`7315f2f` | 49 files, 4559 insertions | Grid-model refactor, module decomposition, decider batch |
| 3 | `7315f2f`..`4cdf256` | 40 files, 2226 insertions | e2e suite rebuild, menu scrolling, nested tables |
| 4 | `4cdf256`..`master` | 31 files, 2319 insertions | Nested table rendering, hover outlines, rounded corners, debug info, grip strip |

Slice 4 ends at the current `master`, so review it with a full `/preflight` on a branch at
`master`, not with the backlog procedure above.

## Toolchain

- Package manager: **pnpm**. Node 22.13 or later (pnpm 11 needs it).
- Typecheck: `pnpm typecheck` (`tsc --noEmit`).
- Unit tests, non-watch: `pnpm test` (`vp test run`). Never run `vp test` without `run`.
  Add a path to run one file: `pnpm test src/history.test.ts`.
- **Never run `npx vitest`.** It resolves a vitest from the npx cache instead of the
  workspace one, and that copy cannot find `happy-dom`, so every worker dies with
  `Error: Cannot find package 'happy-dom'`. Nothing in the message says the wrong vitest is
  running, so it reads as a broken dev-dependency install.
- End-to-end tests: `pnpm e2e` (Playwright). Never run `pnpm e2e:ui`; it does not exit.
- An e2e spec must take library objects from `window.bloomTableTestHooks`, which
  `demo/ui-harness.tsx` publishes, and never import library source through
  `page.addScriptTag`. A dev server that has been running across source edits serves the
  harness an HMR-versioned copy of a module and the injected script the plain one, so a
  singleton becomes two objects and the spec fails as if the feature were broken.
- Build: `pnpm build` (`vp pack`). Never run `build:watch` in a session.
- **There is no lint script.** A skill that expects one records "no lint step in this project"
  and moves on.

## Commits

End every commit message with the trailer that names the model:

```
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

Use the model actually running, not that name literally.
