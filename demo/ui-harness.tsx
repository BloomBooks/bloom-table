// Minimal editor harness: one blank editable table + the real TableMenu toolbar,
// with NO example-picker / /api/examples dependency. This is the stable target the
// UI "recipe" interpreter (tests/samples/ui/interpreter.ts) drives via Playwright.
import React from "react";
import ReactDOM from "react-dom/client";
import MainContent from "./components/MainContent";
import Toolbar from "./Toolbar";

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
const fixtureName = new URLSearchParams(window.location.search).get("fixture");

const Harness: React.FC = () => {
  const [content, setContent] = React.useState<string | null>(
    fixtureName ? null : BLANK_2x2,
  );
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
        <Toolbar />
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Harness />
  </React.StrictMode>,
);
