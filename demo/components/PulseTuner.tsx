// TEMPORARY demo-only control panel for tuning the toolbar hover-pulse highlight.
// It edits the --bloom-pulse-* CSS variables on :root live, shows a looping
// preview (border pulse + fill pulse), and copies the current values as a
// ready-to-paste :root {} block. Delete this component (and its use in
// demo/index.tsx) once the look is dialed in.

import React, { useEffect, useRef, useState } from "react";

type Settings = {
  color: string; // hex
  duration: number; // seconds
  fillOpacity: number; // 0..1
  borderWidth: number; // px
  borderOffset: number; // px (can be negative)
};

const DEFAULTS: Settings = {
  color: "#3d8295",
  duration: 1.1,
  fillOpacity: 0.45,
  borderWidth: 2,
  borderOffset: -1,
};

const toCssVars = (s: Settings): Record<string, string> => ({
  "--bloom-pulse-color": s.color,
  "--bloom-pulse-duration": `${s.duration}s`,
  "--bloom-pulse-fill-opacity": String(s.fillOpacity),
  "--bloom-pulse-border-width": `${s.borderWidth}px`,
  "--bloom-pulse-border-offset": `${s.borderOffset}px`,
});

const toRootBlock = (s: Settings): string => {
  const vars = toCssVars(s);
  const lines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`);
  return `:root {\n${lines.join("\n")}\n}`;
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  fontSize: 12,
};
const numStyle: React.CSSProperties = {
  width: 56,
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
};

const PulseTuner: React.FC = () => {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // While the pointer is in the tuner, pulse the whole table (both flavors on
  // every cell) so the user can see the effect of the settings on real cells.
  // Skip the tuner's own preview cells.
  const setWholeTablePulse = (on: boolean) => {
    document.querySelectorAll<HTMLElement>(".bloom-cell").forEach((c) => {
      if (panelRef.current?.contains(c)) return;
      if (on) c.classList.add("bloom-pulse-fill", "bloom-pulse-border");
      else c.classList.remove("bloom-pulse-fill", "bloom-pulse-border");
    });
  };

  // Push the live values onto :root so both the preview and the real toolbar
  // hover-pulses pick them up immediately.
  useEffect(() => {
    const root = document.documentElement;
    const vars = toCssVars(s);
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    return () => {
      Object.keys(vars).forEach((k) => root.style.removeProperty(k));
    };
  }, [s]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const copy = async () => {
    const text = toRootBlock(s);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback: select the textarea contents.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const previewCell: React.CSSProperties = {
    width: 46,
    height: 34,
    border: "1px solid #888",
    background: "#fff",
  };

  return (
    <div
      ref={panelRef}
      onMouseEnter={() => setWholeTablePulse(true)}
      onMouseLeave={() => setWholeTablePulse(false)}
      style={{
        // Bottom-left so it doesn't overlay the right-side toolbar (whose
        // controls would otherwise sit under this fixed panel and not get clicks).
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: 9999,
        width: 280,
        padding: 12,
        borderRadius: 8,
        background: "#1f1f1f",
        color: "rgba(255,255,255,0.95)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.45)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Pulse Tuner</strong>
        <span style={{ fontSize: 10, opacity: 0.6 }}>(temporary)</span>
        <button
          onClick={() => setS(DEFAULTS)}
          style={{
            marginLeft: "auto",
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 4,
            background: "#444",
            color: "#fff",
          }}
        >
          Reset
        </button>
      </div>

      {/* Live preview: top cells = border pulse, bottom cells = fill pulse */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
        <div
          className="bloom-table"
          style={{ display: "grid", gridTemplateColumns: "46px 46px", gap: 6 }}
        >
          <div className="bloom-cell bloom-pulse-border" style={previewCell} />
          <div className="bloom-cell bloom-pulse-border" style={previewCell} />
          <div className="bloom-cell bloom-pulse-fill" style={previewCell} />
          <div className="bloom-cell bloom-pulse-fill" style={previewCell} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={labelStyle}>
          <span>Color</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="color"
              value={s.color}
              onChange={(e) => set("color", e.target.value)}
              style={{ width: 32, height: 22, padding: 0, border: "none", background: "none" }}
            />
            <code style={{ fontSize: 11 }}>{s.color}</code>
          </span>
        </label>

        <label style={labelStyle}>
          <span>Speed (duration)</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="range"
              min={0.3}
              max={3}
              step={0.1}
              value={s.duration}
              onChange={(e) => set("duration", parseFloat(e.target.value))}
            />
            <span style={numStyle}>{s.duration.toFixed(1)}s</span>
          </span>
        </label>

        <label style={labelStyle}>
          <span>Fill opacity</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.fillOpacity}
              onChange={(e) => set("fillOpacity", parseFloat(e.target.value))}
            />
            <span style={numStyle}>{s.fillOpacity.toFixed(2)}</span>
          </span>
        </label>

        <label style={labelStyle}>
          <span>Border width</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="range"
              min={0}
              max={6}
              step={0.5}
              value={s.borderWidth}
              onChange={(e) => set("borderWidth", parseFloat(e.target.value))}
            />
            <span style={numStyle}>{s.borderWidth}px</span>
          </span>
        </label>

        <label style={labelStyle}>
          <span>Border offset</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="range"
              min={-4}
              max={4}
              step={0.5}
              value={s.borderOffset}
              onChange={(e) => set("borderOffset", parseFloat(e.target.value))}
            />
            <span style={numStyle}>{s.borderOffset}px</span>
          </span>
        </label>
      </div>

      <button
        onClick={copy}
        style={{
          marginTop: 10,
          width: "100%",
          padding: "6px 0",
          borderRadius: 6,
          background: copied ? "#2e7d32" : "#2d8294",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {copied ? "Copied!" : "Copy settings"}
      </button>

      <textarea
        readOnly
        value={toRootBlock(s)}
        onFocus={(e) => e.currentTarget.select()}
        style={{
          marginTop: 8,
          width: "100%",
          height: 96,
          fontFamily: "monospace",
          fontSize: 11,
          color: "#111",
          borderRadius: 4,
          padding: 6,
          resize: "vertical",
        }}
      />
    </div>
  );
};

export default PulseTuner;
