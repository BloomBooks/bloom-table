// The demo's own color picker, injected into TableMenu via its `colorPicker`
// prop. In the real product Bloom supplies its own richer control here; this
// stands in for it during demo/development. Updates are realtime: onChange
// fires continuously as the native color input changes.

import React from "react";
import type { ColorPickerProps } from "../../src/components/ColorPickerContext";

const DemoColorPicker: React.FC<ColorPickerProps> = ({ value, onChange, label }) => {
  const hex = /^#([0-9a-f]{6})$/i.test(value) ? value : "#ffffff";
  const noFocusSteal = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="flex items-center gap-2 ml-2">
      <input
        type="color"
        aria-label={label ?? "Color"}
        title={label}
        value={hex}
        onMouseDown={noFocusSteal}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 64, // twice the default width
          height: 24,
          padding: 0,
          border: "none",
          background: "none",
          cursor: "pointer",
        }}
      />
    </div>
  );
};

export default DemoColorPicker;
