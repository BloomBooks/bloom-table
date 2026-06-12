import React, { useState, useEffect } from "react";
import ExampleListItem from "./ExampleListItem";

export interface Example {
  name: string;
  htmlFile: string;
  pngFile?: string; // Optional PNG file for the example
  pngPath?: string; // Resolved relative path for image
  group: "exercises" | "tests";
}

interface ExampleBarProps {
  onExampleSelect: (example: Example) => void;
}

const ExampleBar: React.FC<ExampleBarProps> = ({ onExampleSelect }) => {
  const [exercises, setexercises] = useState<Example[]>([]);
  const [tests, setTests] = useState<Example[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const LOCAL_STORAGE_KEY = "bloom-grid.activeExamplePath"; // e.g. tests/table-border.html

  // Function to fetch available example files from the API
  const fetchExampleFiles = async (): Promise<void> => {
    try {
      const response = await fetch("/api/examples");
      if (response.ok) {
        const data: { exercises: Example[]; tests: Example[] } = await response.json();
        setexercises(data.exercises || []);
        setTests(data.tests || []);

        const all = [...(data.tests || []), ...(data.exercises || [])];
        if (all.length > 0) {
          const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
          const selected = saved
            ? all.find((f) => `${f.group}/${f.htmlFile}` === saved) || all[0]
            : all[0];
          setActiveId(`${selected.group}/${selected.htmlFile}`);
          onExampleSelect(selected);
        } else {
          setActiveId("");
        }
      } else {
        console.error("Failed to fetch example files from API, status:", response.status);
        setexercises([]);
        setTests([]);
      }
    } catch (error) {
      console.error("Error fetching example files:", error);
      setexercises([]);
      setTests([]);
    }
  };

  useEffect(() => {
    fetchExampleFiles();
  }, []);

  const handleExampleSelect = (example: Example) => {
    const id = `${example.group}/${example.htmlFile}`;
    setActiveId(id);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, id);
    } catch {}
    onExampleSelect(example);
  };

  return (
    <div className="sidebar">
      <div id="example-list">
        <h2 className="text-lg font-semibold text-gray-700 mb-2">exercises</h2>
        <div id="excercise-list" style={{ marginBottom: 16 }}>
          {exercises.length === 0 ? (
            <div className="no-examples-message">No exercises found</div>
          ) : (
            exercises.map((example) => (
              <ExampleListItem
                key={`exercises/${example.htmlFile}`}
                example={example}
                isActive={activeId === `exercises/${example.htmlFile}`}
                onSelect={() => handleExampleSelect(example)}
              />
            ))
          )}
        </div>

        <h2 className="text-lg font-semibold text-gray-700 mb-2">Tests</h2>
        <div id="tests-list">
          {tests.length === 0 ? (
            <div className="no-examples-message">No tests found</div>
          ) : (
            tests.map((example) => (
              <ExampleListItem
                key={`tests/${example.htmlFile}`}
                example={example}
                isActive={activeId === `tests/${example.htmlFile}`}
                onSelect={() => handleExampleSelect(example)}
              />
            ))
          )}
        </div>
      </div>

      {/* Save button moved next to Worked Example heading */}
    </div>
  );
};

export default ExampleBar;
