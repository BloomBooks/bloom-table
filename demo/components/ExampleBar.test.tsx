import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import React from "react";
import ReactDOM from "react-dom/client";
import ExampleBar, { Example } from "./ExampleBar";

// The demo's example picker used to select an example twice, because React
// StrictMode runs an effect twice in development and each run ended with a call
// to onExampleSelect. The second call re-selected the saved example, which threw
// away a click that landed between the two fetches. These tests hold the fix
// down: one automatic selection, and none after a person clicks.

const exercises: Example[] = [
  { name: "Alphabet", htmlFile: "alphabet.html", group: "exercises" },
  { name: "Numbers", htmlFile: "numbers.html", group: "exercises" },
];

let container: HTMLElement;
let root: ReactDOM.Root;
let originalFetch: typeof globalThis.fetch;
// One entry per call the component made to /api/examples. Call an entry to
// answer that call, which lets a test put a click between the two answers.
let pendingFetches: Array<() => void>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  originalFetch = globalThis.fetch;
  pendingFetches = [];
  globalThis.fetch = (() => {
    let release: () => void = () => {};
    const answered = new Promise<void>((resolve) => {
      release = resolve;
    });
    pendingFetches.push(release);
    return answered.then(() => ({
      ok: true,
      json: () => Promise.resolve({ exercises, tests: [] as Example[] }),
    }));
  }) as unknown as typeof globalThis.fetch;
  localStorage.clear();
});

afterEach(() => {
  React.act(() => {
    root.unmount();
  });
  container.remove();
  globalThis.fetch = originalFetch;
});

function mount(onExampleSelect: (example: Example) => void) {
  React.act(() => {
    root = ReactDOM.createRoot(container);
    root.render(
      <React.StrictMode>
        <ExampleBar onExampleSelect={onExampleSelect} />
      </React.StrictMode>,
    );
  });
}

// Answer the next outstanding call to /api/examples, and let the promises it
// chains settle.
async function answerNextFetch() {
  const release = pendingFetches.shift();
  expect(release, "the component asked for the example list").toBeTruthy();
  await React.act(async () => {
    release!();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function clickExample(name: string) {
  const item = Array.from(container.querySelectorAll(".example-list-item")).find(
    (el) => el.textContent === name,
  ) as HTMLElement | undefined;
  expect(item, `the list shows ${name}`).toBeTruthy();
  React.act(() => {
    item!.click();
  });
}

describe("ExampleBar selects an example once", () => {
  it("calls onExampleSelect one time, though StrictMode runs the effect twice", async () => {
    const selected: string[] = [];
    mount((example) => selected.push(example.htmlFile));

    await answerNextFetch();
    await answerNextFetch();

    expect(selected).toEqual(["alphabet.html"]);
  });

  it("keeps a click that lands between the two answers", async () => {
    const selected: string[] = [];
    mount((example) => selected.push(example.htmlFile));

    await answerNextFetch();
    clickExample("Numbers");
    // The second answer arrives late. It must not put the first example back.
    await answerNextFetch();

    expect(selected).toEqual(["alphabet.html", "numbers.html"]);
  });
});
