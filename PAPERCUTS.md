# Papercuts

Small friction points in developing this repo. See the `papercut` skill for the
convention.

## A long-running dev server makes an e2e test fail for no reason

`playwright.config.ts` sets `reuseExistingServer: true`, so `npx playwright test`
attaches to whatever is already serving port 5173. When that server has been
running across a batch of source edits, Vite serves some modules under
HMR-versioned URLs (`/src/history.ts?t=…`) while a test's own
`page.addScriptTag({ content: 'import … from "/src/history.ts"' })` asks for the
plain URL. The two are different module instances, so the test's
`tableHistoryManager` is not the one the app uses.

`tests/e2e/undo-resize-column.spec.ts` then fails with
`expect(lastOp).toMatch(/Resize Column/i)` — "received value must be a string" —
which reads as "the drag no longer records history", i.e. a bug in the code
under test. It is not: the drag works and the same test passes against a server
started after the edits.

Cost: about half an hour of chasing a phantom regression, including building a
worktree at HEAD to prove the code was innocent.

If an e2e failure looks like a module-identity problem (a singleton that should
be shared but is not), restart the dev server before believing it.
## navigator.clipboard cannot be assigned in a happy-dom unit test

The unit tests run in happy-dom, where `navigator.clipboard` is a getter on
`Navigator.prototype`. A plain `(navigator as any).clipboard = stub` throws
`TypeError: Cannot set property clipboard of [object Object] which has only a
getter`, so any test of a clipboard command (Copy Table, Cut Table, the
copy/paste-properties commands) has to install the stub with
`Object.defineProperty(navigator, "clipboard", { configurable: true, value: … })`
and delete it again afterwards. See the `copyTableText` helper in
`src/table-size-buttons.test.ts` for the working form.

Cost: one failed test run. Small, but the error message names the property and
not the reason, so it reads as a happy-dom bug rather than a getter.

## Text read back from the clipboard in an e2e test has CRLF line endings

`navigator.clipboard.read()` in a Playwright test on Windows returns text/plain
with every `\n` turned into `\r\n`, even though the page wrote plain `\n`. A
line-by-line assertion then fails in a way that names the wrong culprit: a
regex anchored with `$`, or an `expect(...).toEqual([...])` over parsed lines,
comes back empty, which reads as "the feature recorded nothing" rather than "the
lines have an extra character". Normalise with
`text.replace(/\r\n/g, "\n")` before parsing (see
`tests/e2e/debug-info-snapshot.spec.ts`).

Cost: about twenty minutes, including a node script that read the same clipboard
outside Playwright and showed no `\r`, which made the demo look guilty.

## Clicking an example in the demo sidebar is unreliable in a test

`ExampleBar` fetches `/api/examples` from a `useEffect`, and React StrictMode
runs that effect twice in dev. Each run ends with `onExampleSelect(saved || all[0])`,
so the second fetch re-selects the saved example and can undo a click that
landed between the two. Under load the second fetch resolves late enough that
the test sees the wrong example, with no error anywhere. In a test, name the
example you want in localStorage before the page loads:
`page.addInitScript(() => localStorage.setItem("bloom-table.activeExamplePath", "exercises/alphabet.html"))`.

## `npx vitest` runs the wrong vitest and fails on a missing happy-dom

Running one unit test file with `npx vitest run src/foo.test.ts` resolves a
vitest from the npx cache instead of the workspace one, and that copy cannot
find `happy-dom`, so every worker fails to start:
`Error: Cannot find package 'happy-dom'`. Nothing in the message says the wrong
vitest is running, so it reads as a broken dev-dependency install. Use
`pnpm test` (`vp test run`), which has the project's environment; add a path
argument to it when you want a single file.

Cost: one wasted test run.
