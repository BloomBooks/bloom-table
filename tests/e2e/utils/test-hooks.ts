import { Page } from "@playwright/test";

// The library instances the UI harness publishes on window.bloomTableTestHooks.
// A spec must take BloomTable and tableHistoryManager from here, never from its
// own `import` inside page.addScriptTag: a dev server that has been running
// across source edits serves the harness an HMR-versioned copy of a module and
// the injected script the plain one, which makes a singleton two objects.
export interface BloomTableTestHooks {
  // The library's types are not visible to the e2e suite, so these stay loose.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BloomTable: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tableHistoryManager: any;
  // Strips the edit-time markup a save must not keep.
  removeTableEditingArtifacts: (root?: ParentNode) => void;
  // Mounts arbitrary markup in the editor container, so a spec can feed saved
  // HTML back in and read the model it produces.
  setContent: (html: string) => void;
  // The api members the panel asked for, in call order, and only when the
  // harness was loaded with ?stubs=1.
  stubApiCalls: string[];
}

declare global {
  interface Window {
    bloomTableTestHooks?: BloomTableTestHooks;
  }
}

// Wait until the harness has published its instances. Call it after page.goto.
export async function waitForTestHooks(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean(window.bloomTableTestHooks));
}
