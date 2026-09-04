// A clipboard stub for the unit tests.
//
// The unit tests run in happy-dom, where navigator.clipboard is a getter on
// Navigator.prototype. A plain assignment throws "TypeError: Cannot set property
// clipboard of [object Object] which has only a getter", and the message names
// the property but not the reason, so it reads as a happy-dom defect. Install the
// stub through this helper, which defines an own property on the navigator and
// restores the prototype's descriptor afterwards.

interface ClipboardStub {
  // Every text the code under test wrote, oldest first.
  written: string[];
  restore: () => void;
}

export function installClipboardStub(): ClipboardStub {
  const written: string[] = [];
  const previous = Object.getOwnPropertyDescriptor(Navigator.prototype, "clipboard");
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text: string) => {
        written.push(text);
        return Promise.resolve();
      },
      readText: () => Promise.resolve(written[written.length - 1] ?? ""),
    },
  });
  return {
    written,
    restore: () => {
      delete (navigator as unknown as { clipboard?: unknown }).clipboard;
      if (previous) Object.defineProperty(Navigator.prototype, "clipboard", previous);
    },
  };
}

// Run one action with the stub installed, and return every text it wrote.
export function withClipboardStub(run: () => void): string[] {
  const stub = installClipboardStub();
  try {
    run();
  } finally {
    stub.restore();
  }
  return stub.written;
}
