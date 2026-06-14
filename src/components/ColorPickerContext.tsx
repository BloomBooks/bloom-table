// Injectable background-color picker.
//
// The panel renders a host-supplied color picker for the Table and Cell
// "Background" controls. A rich host (e.g. Bloom) injects its own picker via
// TableMenu's `colorPicker` prop; same-realm hosts and the demo fall back to
// DefaultColorPicker below (a plain <input type="color">). Mirrors the
// TableApi injection pattern so the picker can live in the host's realm.

import React, { createContext, useContext } from "react";

export interface ColorPickerProps {
  /** Current color as a CSS color string. Empty string means "unset / default". */
  value: string;
  /** Called in realtime as the color changes. Empty string clears the color. */
  onChange: (color: string) => void;
  /** Accessible label / tooltip, e.g. "Table background". */
  label?: string;
}

export type ColorPickerComponent = React.ComponentType<ColorPickerProps>;

/** Minimal built-in picker so the demo / same-realm hosts work without injection. */
export const DefaultColorPicker: ColorPickerComponent = ({ value, onChange, label }) => {
  // <input type="color"> requires a valid #rrggbb; show white when unset.
  const hex = /^#([0-9a-f]{6})$/i.test(value) ? value : "#ffffff";
  return (
    <div className="flex items-center gap-2 ml-2">
      <input
        type="color"
        aria-label={label ?? "Background color"}
        title={label}
        value={hex}
        // Don't steal focus from the selected cell.
        onMouseDown={(e) => e.preventDefault()}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 32,
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

export const ColorPickerContext = createContext<ColorPickerComponent>(DefaultColorPicker);

/** Read the injected color picker (falls back to DefaultColorPicker). */
export const useColorPicker = (): ColorPickerComponent => useContext(ColorPickerContext);
