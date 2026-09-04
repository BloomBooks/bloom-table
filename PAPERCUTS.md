# Papercuts

Small friction points in developing this repo. See the `papercut` skill for the
convention.

Nothing is open. Every entry this file held was fixed at its cause on 2026-09-04:

- A stale dev server made an e2e test fail, because a spec imported library
  source and got a second copy of a singleton. `demo/ui-harness.tsx` now
  publishes the instances on `window.bloomTableTestHooks`, and
  `tests/e2e/utils/test-hooks.ts` reaches them.
- `navigator.clipboard` could not be assigned in a happy-dom unit test.
  `src/test-support/clipboard-stub.ts` installs and removes the stub.
- Clipboard text read back in an e2e test had carriage returns.
  `tests/e2e/utils/clipboard.ts` normalises the line endings for every caller.
- Clicking an example in the demo sidebar was unreliable, because the picker
  selected an example twice and the second selection undid a click.
  `demo/components/ExampleBar.tsx` selects once, and `ExampleBar.test.tsx`
  holds that down.
- `npx vitest` ran the wrong vitest. AGENTS.md forbids it and gives the working
  command.
- The MUI styles barrel broke the dev server's dependency pre-bundler.
  `src/components/IconButton.tsx` uses the `sx` prop, and
  `src/mui-imports.test.ts` fails if anyone imports the barrel again.
