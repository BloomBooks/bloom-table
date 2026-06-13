import React, { useMemo, useState } from "react";
import Header from "./components/Header";
import ExampleBar, { Example } from "./components/ExampleBar";
import MainContent from "./components/MainContent";
import SaveButton from "./components/SaveButton";
import Toolbar from "./Toolbar";
import ReactDOM from "react-dom/client";

const Demo: React.FC = () => {
  const [exampleHtmlContent, setExampleHtmlContent] = useState<string>("");
  const [examplePngPath, setExamplePngPath] = useState<string | undefined>();
  const [attemptHtmlContent, setAttemptHtmlContent] = useState<string>("");
  const [currentExample, setCurrentExample] = useState<Example | null>(null);

  const attemptStorageKey = useMemo(() => {
    if (!currentExample) return null;
    return `bloom-table.attempt:${currentExample.group}/${currentExample.htmlFile}`;
  }, [currentExample]);

  const default2x2Grid = useMemo(() => {
    return `
      <div id="page" style="background: white; height: 600px; width: 500px">
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

  const handleExampleSelect = async (example: Example) => {
    console.log(`Loading example: ${example.name} (${example.group}/${example.htmlFile})`);
    setCurrentExample(example);
    const exampleHtml = await loadExampleContent(example.group, example.htmlFile);
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
              {/* Inline Save to the right of the heading */}
              {currentExample && (
                <span style={{ marginLeft: "auto" }}>
                  <SaveButton
                    currentExamplePath={`${currentExample.group}/${currentExample.htmlFile}`}
                    variant="text"
                  />
                </span>
              )}
            </div>
            <MainContent
              id="worked-example-container"
              className="compact"
              content={exampleHtmlContent}
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
          <MainContent id="test-container" className="compact" content={exampleHtmlContent} />
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
            <h3 className="text-lg font-semibold text-white mb-2" style={{ margin: 0 }}>
              Try to match the essence of the example
            </h3>
          </div>
          <MainContent
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
          {/* Start Over button anchored to lower-left of the user attempt area */}
          <button
            onClick={() => {
              const html = default2x2Grid;
              setAttemptHtmlContent(html);
              if (attemptStorageKey) {
                try {
                  localStorage.removeItem(attemptStorageKey);
                } catch {}
              }
            }}
            className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 rounded"
            title="Clear your work and start over with an empty 2x2 table"
            style={{ position: "absolute", left: 16, bottom: 16 }}
          >
            Start Over
          </button>
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
