# Plan 002: Make `attachTable`/`detachTable` symmetric and leak-free, with lifecycle tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a6732ed..HEAD -- src/attach.ts src/text-editing.ts src/ProximityDiv.ts`
> If any of these changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (resource leak) + tests
- **Planned at**: commit `a6732ed`, 2026-06-12

## Why this matters

`attachTable` wires several listeners onto a grid; `detachTable` is supposed to be
its inverse. Today it is not. `attachTextEditing` adds a `keydown` listener to
the grid element with no removal path, so every attach/detach cycle on the same
element leaks a listener (and after re-attach, the "Enter inserts a paragraph"
handler fires multiple times per keypress). Separately, `ProximityDiv` adds
`mouseenter`/`mousemove` listeners to its child in the constructor but
`destroy()` removes only the element, leaking the listeners and the closures
that capture the (now-destroyed) instance. Neither lifecycle has any unit test,
so regressions here are silent.

After this plan: `detachTable(grid)` removes everything `attachTable(grid)` added;
`ProximityDiv.destroy()` removes its own listeners; and unit tests assert the
symmetry so future changes can't quietly reintroduce the leak. This also makes
host apps that mount/unmount grids (the intended Bloom embedding) safe to use
repeatedly.

## Current state

### `attachTable` / `detachTable` are asymmetric

`src/attach.ts:10-52` (full file):

```ts
export function attachTable(gridDiv: HTMLElement): void {
  if (!gridDiv) throw new Error("Grid element is required");
  gridDiv.classList.add("grid");
  ensureSelectionHighlighting();
  ensureTableSizeButtons();
  // ... default columns/rows ...
  migrateGrid(gridDiv);
  tableHistoryManager.attachTable(gridDiv);
  dragToResize.attach(gridDiv);
  attachTextEditing(gridDiv); // <-- adds a keydown listener
  render(gridDiv);
}

export function detachTable(gridDiv: HTMLElement): void {
  if (!gridDiv) throw new Error("Grid element is required");
  tableHistoryManager.detachTable(gridDiv);
  dragToResize.detach(gridDiv);
  // <-- attachTextEditing has no matching detach; the keydown listener leaks
}
```

`dragToResize.detach` already correctly removes its listeners
(`src/drag-to-resize.ts:82-99`), so the model to follow already exists in this
codebase. The gap is `attachTextEditing`.

### `attachTextEditing` cannot be undone

`src/text-editing.ts:1-31` (full file) adds an anonymous `keydown` listener:

```ts
export function attachTextEditing(gridDiv: HTMLElement): void {
  if (!gridDiv) throw new Error("Grid element is required");
  gridDiv.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target instanceof HTMLDivElement) {
      // ... inserts a <p> at the caret ...
    }
  });
}
```

The handler is an anonymous closure, so there is no reference to pass to
`removeEventListener`. It must be refactored to expose a named handler / detach
function.

### `ProximityDiv.destroy()` leaks child listeners

`src/ProximityDiv.ts:61-117` — the constructor adds two listeners to
`this.child`, but `destroy()` only splices the global registry and removes the
wrapper element:

```ts
const onHover = (e: MouseEvent) => { /* ... updateOpacity ... */ };
this.child.addEventListener("mouseenter", onHover, { passive: true });
this.child.addEventListener("mousemove", onHover, { passive: true });
// ...
destroy() {
  const i = globalInstances.indexOf(this);
  if (i >= 0) globalInstances.splice(i, 1);
  this.element.remove();              // <-- onHover listeners on child never removed
}
```

`onHover` is a local constant in the constructor, not stored on the instance, so
`destroy()` currently has no reference to remove. It must be stored as a private
field.

### Test conventions

- vitest with globals, happy-dom environment (`vitest.config.ts`). Tests live in
  `src/*.test.ts`.
- Lifecycle test exemplars: `src/table-corner-handle.test.ts:11-16` shows the
  `beforeEach` reset pattern (`tableHistoryManager.reset()`, clear
  `document.body.innerHTML`, `resetTableSizeButtons()`); `src/ProximityDiv.test.ts`
  shows how this repo unit-tests a DOM helper class (mock `getBoundingClientRect`,
  dispatch synthetic mouse events, access privates via `prox["method"]()`).
- To assert listener counts in happy-dom, spy on `addEventListener`/
  `removeEventListener` with `vi.spyOn`, or wrap the element and count calls.
  Prefer asserting that the number of `removeEventListener` calls in `detach`
  matches the `addEventListener` calls in `attach` for the same `(type, fn)`.

## Commands you will need

| Purpose    | Command                                    | Expected on success       |
| ---------- | ------------------------------------------ | ------------------------- |
| Typecheck  | `pnpm typecheck`                           | exit 0, no errors         |
| Unit tests | `pnpm test`                                | all pass (≥110)           |
| One file   | `pnpm exec vitest run src/text-editing.test.ts` | the new file's tests pass |

## Scope

**In scope** (the only files you should modify/create):

- `src/text-editing.ts` (refactor to allow detach)
- `src/attach.ts` (call the new detach in `detachTable`)
- `src/ProximityDiv.ts` (store handler, remove in `destroy`)
- `src/text-editing.test.ts` (create)
- `src/attach.test.ts` (create) — or add to an existing lifecycle test file if
  one is clearly the better home; `attach.test.ts` does not exist yet.
- `src/ProximityDiv.test.ts` (add cases to the existing file)

**Out of scope** (do NOT touch):

- The `Enter` → paragraph insertion logic itself — only how the listener is
  attached/detached. Behavior must be byte-for-byte identical.
- The global `mousemove` listener in `ProximityDiv` (`ensureMouseListener`,
  `src/ProximityDiv.ts:18-31`). It is intentionally a single document-level
  listener shared by all instances and is not part of per-instance cleanup.
  Removing it would break other live instances.
- `dragToResize.attach/detach` — already symmetric; do not modify.
- `ensureSelectionHighlighting` / `ensureTableSizeButtons` install-once globals —
  out of scope for this plan.

## Git workflow

- Branch: `advisor/002-symmetric-attach-detach-lifecycle`
- Commit per logical unit (text-editing detach; ProximityDiv cleanup; tests).
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Make `attachTextEditing` return (or pair with) a detach function

Refactor `src/text-editing.ts` so the listener can be removed. Keep the existing
`attachTextEditing(gridDiv)` signature working (callers in `attach.ts` rely on
it), but capture the handler so it can be removed. Two acceptable shapes — pick
the one that reads cleanest with the existing code:

**Option A (preferred): return a detach function.**

```ts
export function attachTextEditing(gridDiv: HTMLElement): () => void {
  if (!gridDiv) throw new Error("Grid element is required");
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && event.target instanceof HTMLDivElement) {
      // ... existing body, UNCHANGED ...
    }
  };
  gridDiv.addEventListener("keydown", onKeydown);
  return () => gridDiv.removeEventListener("keydown", onKeydown);
}
```

Then `attach.ts` stores the returned detacher keyed by grid (e.g. a
`WeakMap<HTMLElement, () => void>` module-level in `attach.ts`).

**Option B: export a `detachTextEditing(gridDiv)` that mirrors attach** using a
module-level `WeakMap<HTMLElement, (e: KeyboardEvent) => void>` inside
`text-editing.ts` to remember the handler per grid.

Whichever you choose, the `Enter`-key body must be copied verbatim from the
current implementation (`src/text-editing.ts:7-29`).

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Call the detach from `detachTable`

In `src/attach.ts`, wire the new mechanism so `detachTable` removes the
text-editing listener. For Option A, add a module-level
`const textEditingDetachers = new WeakMap<HTMLElement, () => void>();`, store the
return value in `attachTable` (`textEditingDetachers.set(gridDiv, attachTextEditing(gridDiv))`),
and in `detachTable` call and delete it:

```ts
const detachText = textEditingDetachers.get(gridDiv);
if (detachText) {
  detachText();
  textEditingDetachers.delete(gridDiv);
}
```

**Verify**:

- `pnpm typecheck` → exit 0
- `pnpm test` → all pass (existing tests must not regress)

### Step 3: Fix `ProximityDiv` listener cleanup

In `src/ProximityDiv.ts`, store the `onHover` handler as a private field and
remove both listeners in `destroy()`:

```ts
private child: HTMLElement;
private onHover: (e: MouseEvent) => void;   // add field
// in constructor:
this.onHover = (e: MouseEvent) => { /* ... existing body ... */ };
this.child.addEventListener("mouseenter", this.onHover, { passive: true });
this.child.addEventListener("mousemove", this.onHover, { passive: true });
// in destroy():
destroy() {
  this.child.removeEventListener("mouseenter", this.onHover);
  this.child.removeEventListener("mousemove", this.onHover);
  const i = globalInstances.indexOf(this);
  if (i >= 0) globalInstances.splice(i, 1);
  this.element.remove();
}
```

**Verify**:

- `pnpm typecheck` → exit 0
- `pnpm test` → all pass (the existing `ProximityDiv.test.ts` must still pass)

### Step 4: Write the lifecycle tests (TDD note below)

This repo practices TDD: ideally write each test, watch it fail against the
_old_ code, then confirm it passes after the fix. Since the fixes in Steps 1–3
are small, an acceptable equivalent is to add the tests now and confirm they
pass — but ALSO confirm they would have failed before, by temporarily reverting
one fix, seeing red, and re-applying (note this in your report; do not leave the
revert in place).

Create `src/text-editing.test.ts`:

- Test: attaching then detaching removes the `keydown` listener. Strategy:
  create a grid `div`, spy on `div.removeEventListener`, call attach (Option A:
  capture the detacher; Option B: call `detachTextEditing(div)`), invoke detach,
  and assert `removeEventListener` was called with `"keydown"` and the same
  handler reference that `addEventListener` received (spy on both).
- Test: after detach, pressing Enter in a contenteditable `div` child does NOT
  insert a `<p>` (i.e., the handler is gone). Use the synthetic-event approach
  from `ProximityDiv.test.ts`; dispatch a `keydown` with `key: "Enter"` whose
  `target` is an `HTMLDivElement`, and assert no new `<p>` appears.

Create `src/attach.test.ts` (model `beforeEach` on
`table-corner-handle.test.ts:11-16`):

- Test: `attachTable(grid)` then `detachTable(grid)` then `attachTable(grid)` again
  leaves exactly one active text-editing handler — pressing Enter inserts
  exactly one `<p>`, not two. This is the regression test for the leak.
- Test: `detachTable` calls `dragToResize.detach` and
  `tableHistoryManager.detachTable` (spy on those and assert called) so the
  detach path stays complete.

Add to `src/ProximityDiv.test.ts`:

- Test: `destroy()` removes the child's `mouseenter`/`mousemove` listeners.
  Spy on `child.removeEventListener`; construct a `ProximityDiv(parent, child)`,
  call `destroy()`, and assert both listener types were removed with the stored
  handler. Optionally assert that a subsequent `mousemove` over the child does
  not throw / does not mutate opacity.

**Verify**: `pnpm test` → all pass, including the new files. Report the count
delta (was 110).

## Test plan

- New file `src/text-editing.test.ts`: detach removes listener; post-detach
  Enter is a no-op.
- New file `src/attach.test.ts`: attach→detach→attach yields a single Enter
  handler (regression for the leak); `detachTable` calls the drag/ history detach.
- Extended `src/ProximityDiv.test.ts`: `destroy()` removes child listeners.
- Structural patterns: `table-corner-handle.test.ts` for grid attach/`beforeEach`;
  `ProximityDiv.test.ts` for synthetic DOM events and private access.
- Verification: `pnpm test` → all pass; new tests included.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0, with new tests in `src/text-editing.test.ts`,
      `src/attach.test.ts`, and added cases in `src/ProximityDiv.test.ts`
- [ ] `grep -n "removeEventListener" src/ProximityDiv.ts` shows the two child
      listeners removed in `destroy()`
- [ ] `detachTable` in `src/attach.ts` removes the text-editing keydown listener
      (grep shows the detach call)
- [ ] The Enter-key insertion behavior is unchanged (the post-attach Enter test
      still inserts exactly one `<p>`)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows `src/attach.ts`, `src/text-editing.ts`, or
  `src/ProximityDiv.ts` changed since `a6732ed` and no longer match the
  excerpts.
- Removing the text-editing listener on detach breaks an existing test that
  depended on the leak (unlikely, but report it rather than weakening the fix).
- happy-dom does not faithfully report `addEventListener`/`removeEventListener`
  calls to a spy (if so, fall back to behavioral assertions — Enter inserts
  exactly one `<p>` after attach→detach→attach — and report the limitation).
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Any new listener added in `attachTable` (or in a helper it calls) must get a
  matching removal in `detachTable`. The `attach.test.ts` symmetry tests are the
  guardrail — extend them when adding listeners.
- `ProximityDiv` is created in `table-size-buttons.ts` (corner handle + edge
  groups). If those overlays start being torn down dynamically (not just on
  `resetTableSizeButtons`), confirm `destroy()` is actually called so the
  now-correct cleanup runs.
- Reviewer should scrutinize: the Enter-key body was copied verbatim (no
  behavior change), and the detach is keyed per-grid (a `WeakMap`) so detaching
  grid A does not remove grid B's handler.
