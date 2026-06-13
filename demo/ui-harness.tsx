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

const Harness: React.FC = () => (
  <div>
    {/* The editable table the interpreter builds into. Plain white, black text, natural width. */}
    <div id="editor">
      <MainContent id="attempt-container" content={BLANK_2x2} />
    </div>
    {/* The real toolbar; appears/targets whichever .cell has focus. */}
    <div id="controls-panel">
      <Toolbar />
    </div>
  </div>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Harness />
  </React.StrictMode>,
);
