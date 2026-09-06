// Minimal editor harness: one blank editable table + the real TableMenu toolbar,
// with NO example-picker / /api/examples dependency. This is the stable target the
// UI "recipe" interpreter (tests/samples/ui/interpreter.ts) drives via Playwright.
import React from "react";
import ReactDOM from "react-dom/client";
import MainContent from "./components/MainContent";
import Toolbar from "./Toolbar";
import type { ColorPickerProps, TableApi } from "../src/index";
import {
  BloomTable,
  defaultTableApi,
  removeTableEditingArtifacts,
  tableHistoryManager,
} from "../src/index";

const BLANK_2x2 = `
  <div class="bloom-table" data-column-widths="hug,hug" data-row-heights="hug,hug">
    <div class="bloom-cell" data-content-type="text"><div contenteditable="true"></div></div>
    <div class="bloom-cell" data-content-type="text"><div contenteditable="true"></div></div>
    <div class="bloom-cell" data-content-type="text"><div contenteditable="true"></div></div>
    <div class="bloom-cell" data-content-type="text"><div contenteditable="true"></div></div>
  </div>`;

// e2e specs can mount specific table markup instead of the blank table by naming a
// fixture fragment: /demo/ui-harness.html?fixture=basic-table loads
// /tests/e2e/fixtures/basic-table.html. The name is restricted to a bare word so the
// harness can't be pointed at arbitrary URLs.
const params = new URLSearchParams(window.location.search);
const fixtureName = params.get("fixture");
// ?stubs=1 mounts the panel the way a host such as Bloom mounts it: with its own
// table api and its own color picker, instead of the library's defaults.
const useStubs = params.get("stubs") === "1";

// Names of the api members the stub api has been asked for, in call order, so a
// spec can prove the panel went through the host's object and not the library's.
const stubApiCalls: string[] = [];
const stubApi: TableApi = (() => {
  const wrapped = { ...defaultTableApi } as unknown as Record<string, unknown>;
  for (const [name, member] of Object.entries(defaultTableApi)) {
    if (name === "BloomTable" || typeof member !== "function") continue;
    wrapped[name] = (...args: unknown[]) => {
      stubApiCalls.push(name);
      return (member as (...a: unknown[]) => unknown)(...args);
    };
  }
  return wrapped as unknown as TableApi;
})();

// A picker that looks nothing like the built-in one, so a spec can tell them
// apart by markup alone.
const StubColorPicker: React.FC<ColorPickerProps> = ({ value, onChange, label }) => (
  <button
    type="button"
    data-stub-color-picker={label ?? ""}
    onMouseDown={(e) => e.preventDefault()}
    onClick={() => onChange("#abcdef")}
  >
    {value || "none"}
  </button>
);

const Harness: React.FC = () => {
  const [content, setContent] = React.useState<string | null>(fixtureName ? null : BLANK_2x2);

  // The e2e specs need the same module instances the harness itself loaded. When a
  // spec imported them again with page.addScriptTag, a dev server that had been
  // running across source edits served the app one HMR-versioned copy of the module
  // and the spec another, so a singleton such as tableHistoryManager was two
  // objects. The spec then saw an empty history and read as a broken feature. The
  // harness publishes the instances instead, and no spec imports library source.
  // tests/e2e/utils/test-hooks.ts owns the type of this property, so the write
  // goes through a cast rather than a second global declaration.
  React.useEffect(() => {
    (window as unknown as { bloomTableTestHooks?: unknown }).bloomTableTestHooks = {
      BloomTable,
      tableHistoryManager,
      removeTableEditingArtifacts,
      // Mount arbitrary markup, so a spec can feed saved HTML back in and read
      // the model it produces. Passing "" first clears the container, because
      // MainContent skips content that matches what it already holds.
      setContent: (html: string) => {
        setContent("");
        setContent(html);
      },
      stubApiCalls,
    };
  }, []);

  React.useEffect(() => {
    if (!fixtureName) return;
    if (!/^[\w-]+$/.test(fixtureName)) {
      setContent(`<p>bad fixture name</p>`);
      return;
    }
    fetch(`/tests/e2e/fixtures/${fixtureName}.html`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then(setContent)
      .catch((e) => setContent(`<p>fixture load failed: ${String(e)}</p>`));
  }, []);
  return (
    <div>
      {/* The editable table the interpreter builds into. Plain white, black text, natural width. */}
      <div id="editor">
        {content !== null && <MainContent id="attempt-container" content={content} />}
      </div>
      {/* The real toolbar; appears/targets whichever .cell has focus. */}
      <div id="controls-panel">
        <Toolbar
          tableApi={useStubs ? stubApi : undefined}
          colorPicker={useStubs ? StubColorPicker : undefined}
        />
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Harness />
  </React.StrictMode>,
);
