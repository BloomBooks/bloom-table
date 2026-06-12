import React from "react";
import IconButton from "./IconButton";

export type RadioOption = {
  id: string;
  label?: string;
  icon?: string; // optional svg path
  labelStyle?: React.CSSProperties; // optional style for text-only labels
};

type Props = {
  options: RadioOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
};

// No per-tile sizing here; tiles inherit size from IconButton.

const RadioGroup: React.FC<Props> = ({ options, value, onChange, className }) => {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 0,
      }}
    >
      {options.map((opt, idx) => {
        const selected = value === opt.id;
        const isLast = idx === options.length - 1;
        return (
          <React.Fragment key={opt.id}>
            <IconButton
              icon={opt.icon}
              alt={opt.label || opt.id}
              title={opt.label || opt.id}
              onClick={() => onChange(opt.id)}
              selected={selected}
              style={{
                border: selected ? "3px solid rgba(255,255,255,0.95)" : "3px solid transparent",
              }}
            >
              {!opt.icon && (
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    textAlign: "center",
                    lineHeight: 1.1,
                    padding: 6,
                    // Allow per-option label styling to be controlled by the caller
                    ...(opt.labelStyle || {}),
                  }}
                >
                  {opt.label}
                </div>
              )}
            </IconButton>
            {/* connector segment only between tiles */}
            {!isLast && (
              <span
                aria-hidden
                style={{
                  width: 12, // matches former gap
                  height: 2,
                  background: "rgba(255,255,255,0.35)",
                  display: "inline-block",
                  alignSelf: "center",
                  pointerEvents: "none",
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default RadioGroup;
