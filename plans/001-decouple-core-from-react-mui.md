# Plan 001: Publish a React/MUI-free core bundle and fix dependency placement

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a6732ed..HEAD -- src/table-size-buttons.ts package.json vite.config.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts below against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt / migration (packaging)
- **Planned at**: commit `a6732ed`, 2026-06-12

## Why this matters

`bloom-table` is published as a library whose core selling point is editing
"tables/grids in pure html" (see `README.md` and `package.json` description).
But the published bundle drags in React, `react-dom/server`, and
`@mui/icons-material` — not for the optional React menu UI (which is
**not exported** from the public entry point), but solely to stamp two static
icons (a "+" and a trash can) into on-grid buttons. Separately, `jsdom` (a
Node-only library, useless in a browser) and the entire MUI + emotion stack are
declared as runtime `dependencies`. The result: any consumer who imports the
"pure html" core ships hundreds of KB of React/MUI/jsdom they never asked for.

After this plan: the public entry point (`src/index.tsx`) and everything it
transitively imports contain **zero** React/MUI/jsdom imports; the core bundle
is framework-free; and `package.json` declares only what the published code
actually needs at runtime. The React menu components under `src/components/`
remain demo-only and untouched.

## Current state

### The only core-path React/MUI consumer

`src/index.tsx` exports the public API and imports nothing from `react`,
`@mui`, or `@emotion` directly. Its transitive imports are framework-free
**except** `src/table-size-buttons.ts`, which is pulled in via
`src/attach.ts` (`attachTable` → `ensureTableSizeButtons`).

`src/table-size-buttons.ts:14-18` — the offending imports:

```ts
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { kBloomBlue } from "./constants";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
```

`src/table-size-buttons.ts:598-655` — `makeOverlay()` is the **only** place
these are used. It renders a MUI icon element to a static SVG string and injects
it as `innerHTML`:

```ts
function makeOverlay(
  onClick: () => void,
  icon: React.ReactElement,
  kind: OverlayKind,
  side: OverlaySide,
): HTMLButtonElement {
  const btn = document.createElement("button");
  // ... styling ...
  // Inject MUI icon as inline SVG for crisp rendering
  const svg = renderToStaticMarkup(
    React.cloneElement(icon, {
      color: "inherit",
      style: { width: 18, height: 18, display: "block", fill: "currentColor" },
    }),
  );
  btn.innerHTML = svg;
  btn.addEventListener("mousedown", (e) => e.preventDefault());
  btn.addEventListener("click", () => onClick());
  return btn;
}
```

`src/table-size-buttons.ts:708-758` — the call sites pass MUI icon elements:

```ts
React.createElement(AddIcon); // 4 call sites (right/left/top/bottom add)
React.createElement(DeleteIcon); // 4 call sites (right/left/top/bottom delete)
```

There are exactly **8** `React.createElement(...)` call sites and one
`makeOverlay` signature that takes `icon: React.ReactElement`. Confirm the
counts with:
`grep -n "React.createElement\|renderToStaticMarkup\|React.cloneElement" src/table-size-buttons.ts`

### Dependency manifest

`package.json:31-60` (current):

```json
  "devDependencies": {
    "@playwright/test": "^1.55.0",
    "@types/node": "^24.0.1",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "happy-dom": "^15.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vite-plugin-dts": "^4.5.4",
    "vitest": "^3.2.4"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "packageManager": "pnpm@11.0.3",
  "engines": { "node": ">=22.12.0" },
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@mui/icons-material": "5",
    "@mui/material": "5",
    "jsdom": "^26.1.0"
  }
```

Facts established during recon (do not re-derive — but DO re-verify with the
grep commands in Step 4 before editing):

- `jsdom` is imported **only** in `demo/api.ts` and `demo/example-api.ts`
  (Node-side dev-server middleware). It is never imported under `src/`.
- `@mui/material`, `@mui/icons-material`, `@emotion/*` are imported under
  `src/components/**` (the React menu UI) and — until Step 1–3 of this plan —
  `src/table-size-buttons.ts`. After Step 1–3, the only `src/` users are
  `src/components/**`, which are **not** exported by `src/index.tsx` (verify:
  `grep -n "components" src/index.tsx` returns nothing).
- `react` / `react-dom` are correctly in `peerDependencies` already; they are
  also (redundantly, but harmlessly) in `devDependencies` so the demo/tests can
  resolve them. Leave the peer entries alone.

### Repo conventions

- Package manager is **pnpm** (`packageManager: pnpm@11.0.3`); never run npm.
  `.github/copilot-instructions.md` reinforces this.
- TDD is the stated convention. There is an existing unit test for this module's
  behavior: `src/table-corner-handle.test.ts` (happy-dom, vitest globals). Model
  any new test on it.
- The build externalizes `react`/`react-dom` (`vite.config.ts:59`).

## Commands you will need

| Purpose    | Command          | Expected on success      |
| ---------- | ---------------- | ------------------------ |
| Typecheck  | `pnpm typecheck` | exit 0, no errors        |
| Unit tests | `pnpm test`      | all pass (currently 110) |
| Build      | `pnpm build`     | exit 0, writes `dist/`   |

Do NOT run `pnpm install` unless a step explicitly says to. Do NOT run the demo
or e2e for this plan.

## Scope

**In scope** (the only files you should modify):

- `src/table-size-buttons.ts`
- `package.json`
- `vite.config.ts` (one targeted change in Step 5 only)
- `src/table-size-buttons.test.ts` or `src/table-corner-handle.test.ts`
  (add one assertion — see Test plan)

**Out of scope** (do NOT touch, even though they look related):

- `src/components/**` — the React/MUI menu UI. It legitimately uses MUI and is
  demo-only. Leave every import as-is.
- `demo/**` — the demo app and its `api.ts`/`example-api.ts` legitimately use
  `jsdom` (Node side) and MUI. Do not change them.
- The `peerDependencies` block in `package.json` — react/react-dom belong there.
- Any behavior of the on-grid buttons other than how their icon glyph is
  produced. Same size, same position, same click handlers.

## Git workflow

- Branch: `advisor/001-decouple-core-from-react-mui`
- Commit per logical unit (icons replacement; dependency move; build tweak).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add framework-free inline SVG icon helpers

In `src/table-size-buttons.ts`, add two module-level constants holding the SVG
markup for the "add" (plus) and "delete" (trash) glyphs, replicating the MUI
icons currently used. Place them near the top of the file (after imports). Use
the standard Material "Add" and "Delete" path data, sized 18×18 with
`fill: currentColor` to match the current `makeOverlay` styling
(`width: 18, height: 18, display: block, fill: currentColor`):

```ts
// Inline SVG glyphs (replaces @mui/icons-material to keep the core bundle
// free of React/MUI). Paths are Material Design "Add" and "Delete", 24x24
// viewBox, rendered at 18x18 with fill following the button's text color.
const ADD_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" ' +
  'style="display:block;fill:currentColor" aria-hidden="true" focusable="false">' +
  '<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path></svg>';
const DELETE_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" ' +
  'style="display:block;fill:currentColor" aria-hidden="true" focusable="false">' +
  '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg>';
```

Do not delete the MUI imports yet (the file still references them until Step 3).

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Change `makeOverlay` to accept SVG markup instead of a React element

Edit `makeOverlay` (`src/table-size-buttons.ts:598-655`):

- Change the parameter from `icon: React.ReactElement` to `iconSvg: string`.
- Replace the `renderToStaticMarkup(React.cloneElement(...))` block with a
  direct assignment:

```ts
function makeOverlay(
  onClick: () => void,
  iconSvg: string,
  kind: OverlayKind,
  side: OverlaySide,
): HTMLButtonElement {
  const btn = document.createElement("button");
  // ... unchanged button creation + sizing logic ...

  // Inject inline SVG for crisp rendering (no React/MUI runtime needed).
  btn.innerHTML = iconSvg;
  btn.addEventListener("mousedown", (e) => e.preventDefault());
  btn.addEventListener("click", () => onClick());
  return btn;
}
```

Leave all the button sizing/styling code in `makeOverlay` exactly as it is.

**Verify**: `pnpm typecheck` → it will now report errors at the 8 call sites
(they still pass `React.createElement(...)`). That is expected; Step 3 fixes
them. Do not proceed past Step 3 with typecheck failing.

### Step 3: Update the 8 call sites and remove the React/MUI imports

In `src/table-size-buttons.ts` (around lines 708-758), replace every
`React.createElement(AddIcon)` argument with `ADD_ICON_SVG` and every
`React.createElement(DeleteIcon)` with `DELETE_ICON_SVG`. There are 4 of each.

Then delete the now-unused imports at the top of the file
(`src/table-size-buttons.ts:14-18`):

```ts
import React from "react"; // DELETE
import { renderToStaticMarkup } from "react-dom/server"; // DELETE
import AddIcon from "@mui/icons-material/Add"; // DELETE
import DeleteIcon from "@mui/icons-material/Delete"; // DELETE
```

Keep `import { kBloomBlue } from "./constants";` and all other imports.

**Verify** (all must hold):

- `grep -nE "from \"react\"|react-dom|@mui" src/table-size-buttons.ts` → no matches
- `grep -rnE "from \"react\"|from 'react'|react-dom/server|@mui|@emotion" src/index.tsx src/attach.ts src/table-size-buttons.ts src/BloomTable.ts src/structure.ts src/history.ts src/drag-to-resize.ts src/table-renderer.ts` → no matches (confirms the core path is framework-free)
- `pnpm typecheck` → exit 0
- `pnpm test` → all pass (110), including the corner-handle tests that exercise this module

### Step 4: Re-verify dependency usage, then move runtime deps to devDependencies

Before editing `package.json`, confirm the usage facts hold at HEAD:

- `grep -rn "jsdom" src/` → **no matches** (jsdom is demo-only)
- `grep -rln "@mui\|@emotion" src/` → matches **only** under `src/components/`
  (no longer `src/table-size-buttons.ts` after Step 3)
- `grep -n "components" src/index.tsx` → **no matches** (components are not in
  the public surface, so MUI/emotion are not runtime deps of the published lib)

If any of these three checks does NOT hold, STOP and report (see STOP
conditions) — the dependency move below would then be unsafe.

If they hold, edit `package.json`: move `@emotion/react`, `@emotion/styled`,
`@mui/icons-material`, `@mui/material`, and `jsdom` out of `dependencies` and
into `devDependencies` (they are needed only by the demo app, the React menu
components, and tests — none of which ship in the published `dist/`). The
`dependencies` block should end up **empty** (remove it, or leave `{}`).
`react`/`react-dom` stay in `peerDependencies` (and may remain in
devDependencies). Resulting shape:

```json
  "devDependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@mui/icons-material": "5",
    "@mui/material": "5",
    "@playwright/test": "^1.55.0",
    "@types/node": "^24.0.1",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "happy-dom": "^15.0.0",
    "jsdom": "^26.1.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vite-plugin-dts": "^4.5.4",
    "vitest": "^3.2.4"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
```

Do NOT run `pnpm install` to "fix" the lockfile unless typecheck/test/build
fail because a package can't be resolved. Moving a package between `dependencies`
and `devDependencies` does not change what is installed in this repo, so the
existing `node_modules` and `yarn.lock` remain valid.

**Verify**:

- `pnpm typecheck` → exit 0
- `pnpm test` → all pass

### Step 5: Make the build externalize `react-dom/server` defensively

`vite.config.ts:59` currently externalizes only exact `react` and `react-dom`.
After Step 3 the core no longer imports `react-dom/server`, but the React menu
components are still part of the source tree. To be safe and explicit, widen the
external matcher so any `react`/`react-dom` subpath (e.g. `react-dom/server`,
`react/jsx-runtime`) is treated as external rather than bundled:

```ts
external: (id) => id === "react" || id === "react-dom" || id.startsWith("react/") || id.startsWith("react-dom/"),
```

Keep the `output.globals` block as-is.

**Verify**: `pnpm build` → exit 0; `dist/bloom-table.es.js` and
`dist/bloom-table.umd.js` are produced.

### Step 6: Confirm the published bundle is framework-free

After `pnpm build`, inspect the ES bundle for bundled React/MUI:

- `grep -c "createElement\|@mui\|renderToStaticMarkup" dist/bloom-table.es.js` →
  expect `0`. (A genuine `0` means no React/MUI code was inlined into the
  published core. If non-zero, something in the core path still imports a
  framework — STOP and report which symbol.)

## Test plan

- Add one assertion to the existing on-grid button test
  (`src/table-corner-handle.test.ts`, or create
  `src/table-size-buttons.test.ts` modeled on it) verifying the add/delete
  overlay buttons render an inline `<svg>` glyph via the new code path:
  - Attach a grid, focus a cell to trigger overlay creation (the existing test
    already does this at `table-corner-handle.test.ts:18-40`).
  - Query an add-overlay button and assert `button.querySelector("svg")` is
    non-null and `button.innerHTML` contains `fill:currentColor`.
- This is a characterization test: it locks in that icons still render after the
  React/MUI removal, with no behavior change.
- Verification: `pnpm test` → all pass, including the new assertion.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0 (≥110 tests, plus the new SVG assertion)
- [ ] `pnpm build` exits 0
- [ ] `grep -nE "from \"react\"|react-dom|@mui|@emotion" src/table-size-buttons.ts` returns no matches
- [ ] `grep -rln "@mui\|@emotion" src/ | grep -v "src/components/"` returns no matches
- [ ] `grep -rn "jsdom" src/` returns no matches
- [ ] `package.json` `dependencies` is empty/removed; emotion+MUI+jsdom are in `devDependencies`
- [ ] `grep -c "createElement\|@mui\|renderToStaticMarkup" dist/bloom-table.es.js` returns 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows `src/table-size-buttons.ts`, `package.json`, or
  `vite.config.ts` changed since `a6732ed` and the "Current state" excerpts no
  longer match the live code.
- Step 4's grep checks reveal that `jsdom` IS imported under `src/`, or that
  `@mui`/`@emotion` is imported by a non-`components/` file you did not change,
  or that `src/index.tsx` exports anything from `src/components/`. Any of these
  means the public surface really does need MUI at runtime, and the dependency
  move must be reconsidered (the right fix would then be `peerDependencies` +
  documentation, not `devDependencies`). Report which check failed.
- After Step 6, `dist/bloom-table.es.js` still contains React/MUI code — report
  the grep hit and the symbol so the remaining core-path import can be found.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- If the React menu components under `src/components/` are ever promoted to the
  public API (exported from `src/index.tsx`), this dependency decision must be
  revisited: MUI/emotion would then become `peerDependencies` (like react), and
  the README must document them as required peers. There is a separate, deferred
  direction question about whether to export that UI — out of scope here.
- The inline SVG path data is a snapshot of Material's Add/Delete icons. If the
  design wants different glyphs, edit `ADD_ICON_SVG` / `DELETE_ICON_SVG` —
  there is no longer a dependency on `@mui/icons-material` to bump.
- Reviewer should scrutinize: (1) the 8 call sites all switched to the SVG
  constants (no stray `React.createElement` left), (2) the on-grid buttons look
  identical in the demo, (3) `dependencies` truly empty so consumers get a lean
  install.
