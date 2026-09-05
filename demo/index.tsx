import React, { useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import ExampleBar, { Example } from "./components/ExampleBar";
import MainContent from "./components/MainContent";
import Toolbar from "./Toolbar";
import ReactDOM from "react-dom/client";
import {
  registerCellContentType,
  defaultCellContentsForEachType,
} from "../src/cell-contents";
import { copyDebugInfo } from "./utils/debugInfo";
import {
  clearJournal,
  describeHistoryEvent,
  journalStorageKey,
  readJournal,
  recordAction,
  startOverJournal,
} from "./utils/actionJournal";

// In the demo, image cells use a local placeholder instead of the library's
// default remote (Wikipedia) image. Reuse the built-in image type's icon and
// detection regex, swapping only the template.
const demoImageType = defaultCellContentsForEachType.find(
  (c) => c.id === "image",
);
if (demoImageType) {
  registerCellContentType({
    ...demoImageType,
    templateHtml: `<img src="/demo/placeHolder.png" alt="Placeholder Image" style="max-width: 100%; max-height: 100%" />`,
  });
}

const Demo: React.FC = () => {
  const [exampleHtmlContent, setExampleHtmlContent] = useState<string>("");
  const [examplePngPath, setExamplePngPath] = useState<string | undefined>();
  const [attemptHtmlContent, setAttemptHtmlContent] = useState<string>("");
  const [currentExample, setCurrentExample] = useState<Example | null>(null);
  // null while nothing has been copied; otherwise whether the copy carried the
  // screenshot.
  const [debugCopied, setDebugCopied] = useState<
    null | "with-screenshot" | "text-only"
  >(null);
  // The same fact as debugCopied, but it stays after the label goes back to
  // "Copy Debug Info", so a test has something to wait for that does not
  // vanish on a timer.
  const [lastDebugCopy, setLastDebugCopy] = useState("");
  // Bumped by "Start Over" and by "Start with this" to force the attempt area
  // to be rebuilt.
  const [attemptGeneration, setAttemptGeneration] = useState(0);
  // The state of the developer-only "Set as worked example" button.
  const [workedExampleSave, setWorkedExampleSave] = useState<
    "idle" | "saving" | "saved"
  >("idle");

  const attemptStorageKey = useMemo(() => {
    if (!currentExample) return null;
    return `bloom-table.attempt:${currentExample.group}/${currentExample.htmlFile}`;
  }, [currentExample]);

  // The action journal is keyed per example, exactly as the attempt is, and
  // survives a reload for the same reason.
  const journalKey = useMemo(() => {
    if (!currentExample) return null;
    return journalStorageKey(
      `${currentExample.group}/${currentExample.htmlFile}`,
    );
  }, [currentExample]);

  // src/history.ts dispatches "tableHistoryUpdated" for every recorded
  // operation, undo and redo. The event carries the history entry's own label
  // (operation), its detail (operationDetail), and the top-level table it
  // belongs to (table).
  //
  // The table is what makes the journal trustworthy. This listener is on the
  // document, so it hears every table on the page, and only the attempt's
  // actions belong in the journal. "Copy Debug Info" would otherwise report
  // actions against a screenshot that never shows them, which is worse than
  // reporting nothing. An event whose table is missing (Clear History) or
  // outside the attempt is not ours.
  useEffect(() => {
    if (!journalKey) return;
    const onHistoryUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const table = detail?.table as HTMLElement | undefined;
      const attempt = document.getElementById("attempt-container");
      if (!table || !attempt || !attempt.contains(table)) return;
      const action = describeHistoryEvent(detail);
      if (action) recordAction(localStorage, journalKey, action, Date.now());
    };
    document.addEventListener("tableHistoryUpdated", onHistoryUpdated);
    return () =>
      document.removeEventListener("tableHistoryUpdated", onHistoryUpdated);
  }, [journalKey]);

  const default2x2Grid = useMemo(() => {
    return `
      <div id="page" style="background: white; height: 210mm; width: 148mm">
        <div id="main-table" class="bloom-table" data-column-widths="hug,hug" data-row-heights="hug,hug">
          <div class="bloom-cell" data-content-type="text"><div contenteditable="true"></div></div>
          <div class="bloom-cell" data-content-type="text"><div contenteditable="true"></div></div>
          <div class="bloom-cell" data-content-type="text"><div contenteditable="true"></div></div>
          <div class="bloom-cell" data-content-type="text"><div contenteditable="true"></div></div>
        </div>
      </div>`;
  }, []);

  // Function to load and parse HTML content
  const loadExampleContent = async (
    group: "exercises" | "tests",
    filename: string,
  ): Promise<string> => {
    try {
      const response = await fetch(`./${group}/${filename}`);
      const htmlContent = await response.text();

      // Parse the HTML and extract the body content
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, "text/html");
      const bodyContent = doc.body.innerHTML;

      return bodyContent;
    } catch (error) {
      console.error("Error loading example file:", error);
      return "<p>Error loading example content</p>";
    }
  };

  // Put a given HTML body into the attempt area, save it, and open a fresh
  // journal that says where the work started.
  const replaceAttempt = (html: string, startDescription: string) => {
    setAttemptHtmlContent(html);
    setAttemptGeneration((n) => n + 1);
    if (attemptStorageKey) {
      try {
        localStorage.setItem(attemptStorageKey, html);
      } catch {}
    }
    clearJournal(localStorage, journalKey);
    recordAction(
      localStorage,
      journalKey,
      { description: startDescription },
      Date.now(),
    );
  };

  // "Start with this" copies the worked example into the attempt area, so the
  // user edits a copy of the answer instead of building it from an empty 2x2.
  const startWithWorkedExample = () => {
    if (!exampleHtmlContent) return;
    replaceAttempt(exampleHtmlContent, "Started from the worked example");
  };

  // "Set as worked example" writes the attempt back into the exercise file, so
  // the developer builds the worked example in the normal editing area instead
  // of in the small pane beside it. Both panes contain an element with id
  // "page", so the query has to start inside the attempt container.
  const setAttemptAsWorkedExample = async () => {
    if (!currentExample) return;
    const attempt = document.getElementById("attempt-container");
    const page =
      attempt?.querySelector("#page") || attempt?.querySelector(".page");
    if (!page) {
      alert("Could not find a page element in the attempt area to save.");
      return;
    }
    const content = page.innerHTML;
    setWorkedExampleSave("saving");
    try {
      const response = await fetch("/api/save-example", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exampleName:
            `${currentExample.group}/${currentExample.htmlFile}`.replace(
              /\.html$/,
              "",
            ),
          content,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        let message = errorText || "Unknown error";
        try {
          message = JSON.parse(errorText).error ?? message;
        } catch {}
        alert(`Failed to set the worked example: ${message}`);
        setWorkedExampleSave("idle");
        return;
      }
      // Show the new worked example at once, without a reload.
      setExampleHtmlContent(attempt ? attempt.innerHTML : content);
      setWorkedExampleSave("saved");
      window.setTimeout(() => setWorkedExampleSave("idle"), 4000);
    } catch (error) {
      const details =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error);
      alert(`Error setting the worked example: ${details}`);
      setWorkedExampleSave("idle");
    }
  };

  const handleExampleSelect = async (example: Example) => {
    console.log(
      `Loading example: ${example.name} (${example.group}/${example.htmlFile})`,
    );
    setCurrentExample(example);
    const exampleHtml = await loadExampleContent(
      example.group,
      example.htmlFile,
    );
    setExampleHtmlContent(exampleHtml);

    // The /api/examples endpoint already resolves pngPath only for examples that
    // actually have a thumbnail on disk, so use it directly (no client-side probe,
    // which would log a 404 in the console for every example without a thumbnail).
    setExamplePngPath(example.pngPath);

    // Load user's attempt from localStorage or initialize with default 2x2 (exercises only)
    if (example.group === "exercises") {
      let attemptHtml = default2x2Grid;
      try {
        const key = `bloom-table.attempt:${example.group}/${example.htmlFile}`;
        const saved = localStorage.getItem(key);
        if (saved) attemptHtml = saved;
      } catch {}
      setAttemptHtmlContent(attemptHtml);
    }
  };

  return (
    <div className="demo-layout">
      <Header />
      <ExampleBar onExampleSelect={handleExampleSelect} />

      <div className="sample-image">
        {currentExample?.group === "exercises" ? (
          <>
            {examplePngPath && (
              <>
                <h3 className="text-lg font-semibold text-white mb-1 section-label">
                  Reference Image
                </h3>
                <img
                  src={examplePngPath}
                  alt="Example"
                  style={{ maxHeight: "400px", width: "auto" }}
                />
                <br />
              </>
            )}
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <h3
                className="text-lg font-semibold text-white mb-1 section-label"
                style={{ margin: 0 }}
              >
                Worked Example
              </h3>
              <span style={{ marginLeft: "auto" }}>
                <button
                  onClick={startWithWorkedExample}
                  disabled={!exampleHtmlContent}
                  className="bg-gray-600 hover:bg-gray-700 text-white text-sm px-3 py-1 rounded"
                  title="Copy the worked example into your attempt and edit it from there"
                >
                  Start with this
                </button>
              </span>
            </div>
            <MainContent
              id="worked-example-container"
              className="compact"
              content={exampleHtmlContent}
              readOnly
            />
          </>
        ) : (
          // Tests: show only the optional PNG here; actual test HTML renders to the right
          <>
            {examplePngPath && (
              <>
                <h3 className="text-lg font-semibold text-white mb-1 section-label">
                  Reference Image
                </h3>
                <img
                  src={examplePngPath}
                  alt="Test reference"
                  style={{ maxHeight: "400px", width: "auto", marginBottom: 8 }}
                />
              </>
            )}
          </>
        )}
      </div>

      {/* Tests: render the test HTML in the right-side column where attempts normally are */}
      {currentExample?.group === "tests" && (
        <div
          id="test-content"
          style={{
            padding: "16px",
            backgroundColor: "#302d2d",
            position: "relative",
          }}
        >
          <MainContent
            id="test-container"
            className="compact"
            content={exampleHtmlContent}
          />
        </div>
      )}

      {/* Attempt Area: only for exercises */}
      {currentExample?.group === "exercises" && (
        <div
          id="user-attempt"
          style={{
            padding: "16px 16px 56px 16px",
            backgroundColor: "#302d2d",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3
              className="text-lg font-semibold text-white mb-2"
              style={{ margin: 0 }}
            >
              Try to match the example
            </h3>
          </div>
          <MainContent
            // Remount on "Start Over" so the blank table is injected even when
            // the edits since the last load have not reached React state yet.
            // MainContent only re-injects when `content` changes, and onChange
            // is debounced by 300ms, so a Start Over inside that window used to
            // set `content` to the value it already held and do nothing.
            key={`attempt-${attemptGeneration}`}
            id="attempt-container"
            className="compact"
            content={attemptHtmlContent || default2x2Grid}
            onChange={(html) => {
              setAttemptHtmlContent(html);
              if (attemptStorageKey) {
                try {
                  localStorage.setItem(attemptStorageKey, html);
                } catch {}
              }
            }}
          />
          {/* Start Over + Copy Debug Info anchored to lower-left of the user attempt area */}
          <div
            style={{
              position: "absolute",
              left: 16,
              bottom: 16,
              display: "flex",
              gap: 8,
            }}
          >
            <button
              onClick={() => {
                const html = default2x2Grid;
                setAttemptHtmlContent(html);
                setAttemptGeneration((n) => n + 1);
                if (attemptStorageKey) {
                  try {
                    localStorage.removeItem(attemptStorageKey);
                  } catch {}
                }
                // The journal restarts with the work it describes, and opens
                // with a marker so a later snapshot says where that happened.
                startOverJournal(localStorage, journalKey, Date.now());
              }}
              className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 rounded"
              title="Clear your work and start over with an empty 2x2 table"
            >
              Start Over
            </button>
            <button
              onClick={async () => {
                const result = await copyDebugInfo({
                  exampleId: currentExample
                    ? `${currentExample.group}/${currentExample.htmlFile}`
                    : undefined,
                  storageKey: attemptStorageKey,
                  journal: readJournal(localStorage, journalKey),
                });
                const kind = result.screenshotIncluded
                  ? "with-screenshot"
                  : "text-only";
                setDebugCopied(kind);
                setLastDebugCopy(kind);
                window.setTimeout(() => setDebugCopied(null), 4000);
              }}
              data-last-copy={lastDebugCopy}
              className="bg-gray-600 hover:bg-gray-700 text-white text-sm px-3 py-1 rounded"
              title="Copy a diagnostic snapshot (a screenshot of the table, everything you have done this session, the table HTML, selection/overlay state, and the saved attempt) for pasting into a bug report or AI chat"
            >
              {debugCopied === "with-screenshot"
                ? "Copied, with screenshot!"
                : debugCopied === "text-only"
                  ? "Copied as text only"
                  : "Copy Debug Info"}
            </button>
            {/* Writing the exercise file back only makes sense against the dev
                server, which is the only thing that serves /api/save-example.
                In a built demo the button would always fail, so hide it. */}
            {import.meta.env.DEV && (
              <button
                onClick={setAttemptAsWorkedExample}
                disabled={workedExampleSave === "saving"}
                data-testid="set-as-worked-example"
                className="bg-gray-600 hover:bg-gray-700 text-white text-sm px-3 py-1 rounded"
                title="Write the current attempt into this exercise file as its worked example"
              >
                {workedExampleSave === "saving"
                  ? "Saving..."
                  : workedExampleSave === "saved"
                    ? "Set!"
                    : "Set as worked example"}
              </button>
            )}
          </div>
        </div>
      )}
      <div id="controls-panel">
        <Toolbar />
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Demo />
  </React.StrictMode>,
);
