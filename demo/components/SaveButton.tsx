import React, { useState, useEffect } from "react";
import { tableHistoryManager } from "../../src";

interface SaveButtonProps {
  // e.g. "tests/table-border.html" or "exercises/alphabet.html"
  currentExamplePath: string;
  // Visual style variant: 'default' (sidebar big button) or 'text' (inline white text button)
  variant?: "default" | "text";
  className?: string;
}

const SaveButton: React.FC<SaveButtonProps> = ({
  currentExamplePath,
  variant = "default",
  className,
}) => {
  const [canUndo, setCanUndo] = useState(tableHistoryManager.canUndo());
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const pageElement = document.querySelector("#page") || document.querySelector(".page");
    if (!pageElement) {
      alert("Could not find page element to save.");
      return;
    }

    setIsSaving(true);
    try {
      // Use the current example path (group/filename) without extension
      const exampleName = currentExamplePath.replace(/\.html$/, "");
      const content = pageElement.innerHTML;

      const apiUrl = `/api/save-example`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          exampleName,
          content,
        }),
      });

      if (response.ok) {
        alert("Saved successfully!");
        tableHistoryManager.clearHistory();
        setCanUndo(false);
      } else {
        const errorText = await response.text();
        let errorObj;
        try {
          errorObj = JSON.parse(errorText);
        } catch (e) {
          errorObj = { error: errorText || "Unknown error" };
        }
        alert(`Failed to save: ${errorObj.error}`);
        console.error("Failed to save:", errorObj, "Response:", response);
      }
    } catch (error) {
      const errorDetails =
        error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      alert(`Error saving: ${errorDetails}`);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const handleHistoryUpdate = () => {
      setCanUndo(tableHistoryManager.canUndo());
    };
    document.addEventListener("tableHistoryUpdated", handleHistoryUpdate);
    return () => {
      document.removeEventListener("tableHistoryUpdated", handleHistoryUpdate);
    };
  }, []);

  const isEnabled = canUndo && !isSaving;
  const baseProps = {
    disabled: isSaving,
    onClick: handleSave,
  } as const;

  if (variant === "text") {
    return (
      <button
        {...baseProps}
        className={className}
        style={{
          background: "transparent",
          border: "none",
          color: "#ffffff",
          padding: 0,
          margin: 0,
          cursor: isEnabled ? "pointer" : "default",
          opacity: isEnabled ? 1 : 0.6,
          fontSize: "0.9rem",
          fontWeight: 600,
        }}
        title={isEnabled ? "Save changes" : "No changes to save"}
      >
        {isSaving ? "Saving..." : "Save"}
      </button>
    );
  }

  return (
    <button
      {...baseProps}
      className={className}
      style={{
        padding: "10px 20px",
        backgroundColor: isEnabled ? "#28a745" : "#cccccc",
        color: isEnabled ? "#fff" : "#666666",
        border: "none",
        borderRadius: "5px",
        cursor: isEnabled ? "pointer" : "not-allowed",
        opacity: isEnabled ? 1 : 0.7,
        marginTop: "20px",
        width: "100%",
      }}
      title={isEnabled ? "Save changes" : "No changes to save"}
    >
      {isSaving ? "Saving..." : "Save"}
    </button>
  );
};

export default SaveButton;
