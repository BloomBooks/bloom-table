import React, { useEffect, useRef, useState } from "react";
import { kBloomBlue } from "../constants";

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
  /** Identity of the element this slider edits (see elementKey). The echo below
   *  is one target's value, so it has to resync when the target changes. */
  identity?: string;
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
  identity,
  ...rest
}) => {
  // The thumb needs a synchronous source of truth. The panel reflects changes
  // back asynchronously (it re-renders from a MutationObserver, not directly from
  // this onChange), so a plain controlled input would have React snap the thumb
  // back to the stale prop on every input — the thumb "fights" the drag. We keep
  // a local echo that updates synchronously, and only adopt prop changes that are
  // genuinely external (not the delayed echo of a change we just emitted).
  // `identity` is a dependency, not decoration: a new target can hand us the very
  // number the prop already held (two cells that both render 8px), and a
  // value-only effect then never re-runs, so the previous target's echo stays on
  // screen and setting that same number emits nothing.
  const [local, setLocal] = useState(value);
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setLocal(value);
    }
  }, [value, identity]);

  const handle = (v: number) => {
    lastEmitted.current = v;
    setLocal(v);
    onChange(v);
  };

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
        value={local}
        disabled={disabled}
        aria-label={rest["aria-label"] ?? label}
        onChange={(e) => handle(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: kBloomBlue, cursor: disabled ? "not-allowed" : "pointer" }}
      />
      <span className="text-sm tabular-nums" style={{ minWidth: 46, textAlign: "right" }}>
        {local}
        {unit}
      </span>
    </div>
  );
};

export default Slider;
