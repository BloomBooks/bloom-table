import React, { useEffect, useRef } from "react";
import { attachTablesAfterContentLoad } from "../utils/tableAttachment";

interface MainContentProps {
  content: string;
  // Optional change callback – called with container's innerHTML when content changes
  onChange?: (html: string) => void;
  // Optional id for the container to avoid duplicate ids when multiple instances are on page
  id?: string;
  // Optional class name(s) for the outer wrapper to adjust spacing/styles
  className?: string;
}

const MainContent: React.FC<MainContentProps> = ({ content, onChange, id, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isSettingRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (containerRef.current && content) {
      // Skip re-injecting content that already matches what's in the container.
      // The edit loop is: table mutates -> we serialize and call onChange ->
      // parent stores it as `content` -> it flows back here. Re-setting innerHTML
      // in that case would rebuild the DOM and detach the live nodes, orphaning
      // the toolbar's reference to the selected cell (so further edits no-op).
      // Only inject when `content` is genuinely external (load example, Start Over).
      if (containerRef.current.innerHTML === content) return;
      isSettingRef.current = true;
      containerRef.current.innerHTML = content;
      attachTablesAfterContentLoad(containerRef.current);
      // allow mutations from initial set to flush before enabling notifications
      setTimeout(() => {
        isSettingRef.current = false;
      }, 0);
    }
  }, [content]);

  // Observe content changes and notify caller (debounced)
  useEffect(() => {
    if (!onChange) return;
    const container = containerRef.current;
    if (!container) return;

    const notify = () => {
      if (!container || isSettingRef.current) return;
      const html = container.innerHTML;
      onChange(html);
    };

    const debouncedNotify = () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        notify();
      }, 300);
    };

    const observer = new MutationObserver(() => {
      debouncedNotify();
    });
    observer.observe(container, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: false,
    });

    // Also listen for input events from contenteditable areas
    container.addEventListener("input", debouncedNotify);
    container.addEventListener("blur", debouncedNotify, true);
    container.addEventListener("paste", debouncedNotify);

    return () => {
      observer.disconnect();
      container.removeEventListener("input", debouncedNotify);
      container.removeEventListener("blur", debouncedNotify, true);
      container.removeEventListener("paste", debouncedNotify);
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [onChange]);

  return (
    <div className={`main-content${className ? ` ${className}` : ""}`}>
      <div id={id ?? "example-container"} ref={containerRef}>
        {/* Content will be loaded here */}
      </div>
    </div>
  );
};

export default MainContent;
