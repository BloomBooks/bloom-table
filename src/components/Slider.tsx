import React from "react";

type Props = {
  /** Optional short label shown before the track (e.g. "X"). */
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Unit suffix shown after the numeric readout (e.g. "px"). */
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
  "aria-label"?: string;
};

// A compact range slider styled for the dark control panel. Used for gap,
// padding, and fixed row/column sizes so those controls share one look.
const Slider: React.FC<Props> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  disabled,
  onChange,
  className,
  ...rest
}) => {
  return (
    <div className={["flex items-center gap-2", className].filter(Boolean).join(" ")}>
      {label && (
        <span className="text-sm opacity-80" style={{ minWidth: 12 }}>
          {label}
        </span>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={rest["aria-label"] ?? label}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: "#2D8294", cursor: disabled ? "not-allowed" : "pointer" }}
      />
      <span className="text-sm tabular-nums" style={{ minWidth: 46, textAlign: "right" }}>
        {value}
        {unit}
      </span>
    </div>
  );
};

export default Slider;
