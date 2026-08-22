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
