This project uses Vite+ (`vp` commands) with pnpm as the package manager.
Never use npm or yarn commands; use pnpm (e.g. `pnpm install`) and `vp` tasks.
This project uses a bash terminal, so always use forward slashes in paths.
The model/schema is defined in design/model.md. Implementation information is available at design/process.md. This is the source of truth that requires a human to approve changes to. It is thus vital that it is precise while also being easy for a human to read. It is vital that it be kept up to date. Everything else should be derived from this model.

# Tests

Use the run_tests tool to run tests.
We are doing test-driven development. This means I do not want you to fix a bug and then add test. Instead, I want you to add a test, see it fail, and only then fix the bug. If I point out a bug and don't mention tests, I still usually want a test to catch it first. Unit test if that's possible, e2e test otherwise. Ask me if you think we might not want a test. Look to see if there is reasonable test file to add to before you add new ones.

# Hard UI Issues

If you can't quite figure out something that happens at UI-time, you may use the Playwright MCP to open a page for yourself and interact with it.

# Running commands in terminal

**CRITICAL**: If current terminal is BUSY (running a command), `isBackground: false` commands will NOT execute until that terminal is free. You must spawn a new terminal by running a command with `isBackground: true`.

- `isBackground: false` - Uses current terminal, waits for completion
- `isBackground: true` - Creates NEW terminal, returns immediately

For example, you might `pnpm dev` with `isBackground: false` but then you would need `pnpm e2e` with `isBackground: true` in order to give that its own terminal.

Before starting a server, test to see if it is already running. You can do that by doing a CURL for some known path, e.g. http://localhost:5173/demo/pages/new-table.html. E.g. the dev server is normally at http://localhost:5173. If you run another one without checking, you'll just create a new one at 5174 and then get confused.

# Communication

Let's keep this collaborative. I appreciate it when you tell me I'm wrong or you've been given contradictory instructions. As soon as you have a plan, tell me. Don't go changing code and then only the end tell me what you did. Use ❓ to draw my attention to something you want me to look at. Use ⚠️ to indicate a problem that you want me to know about.
