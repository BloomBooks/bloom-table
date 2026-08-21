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
  disabled?: boolean;
  /** Names the group for assistive tech, e.g. "Text alignment". */
  label?: string;
  "aria-label"?: string;
};

// No per-tile sizing here; tiles inherit size from IconButton.

const RadioGroup: React.FC<Props> = ({
  options,
  value,
  onChange,
  className,
  disabled,
  label,
  ...rest
}) => {
  const groupLabel = rest["aria-label"] ?? label;
  // Roving tabindex: the group is a single tab stop, and the arrow keys move
  // between tiles the way a radio group is expected to behave. The focused tile
  // is the selected one; if nothing matches (e.g. a "mixed" value) the first
  // tile takes the stop so the group is still reachable.
  const selectedIndex = options.findIndex((o) => o.id === value);
  const tabStopIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const moveFocus = (from: number, delta: number, container: HTMLElement | null) => {
    if (options.length === 0) return;
    const to = (from + delta + options.length) % options.length;
    onChange(options[to].id);
    // Follow the selection with focus, as a radio group does.
    const tiles = container?.querySelectorAll<HTMLElement>('[role="radio"]');
    tiles?.[to]?.focus();
  };

  return (
    <div
      className={className}
      role="radiogroup"
      aria-label={groupLabel}
      aria-disabled={disabled || undefined}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        // Horizontal spacing between tiles is supplied by the connector segments
        // below, so the column gap is 0. When the group is too wide for its
        // container (e.g. the cell Content options in a narrow toolbox column),
        // it wraps; give those wrapped rows a 10px gap so they don't collide.
        flexWrap: "wrap",
        columnGap: 0,
        rowGap: 10,
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
              disabled={disabled}
              role="radio"
              aria-checked={selected}
              // A radio reports state with aria-checked; drop the toggle-button
              // semantics IconButton adds by default.
              aria-pressed={undefined}
              tabIndex={idx === tabStopIndex ? 0 : -1}
              onKeyDown={(e) => {
                if (disabled) return;
                const container = (e.currentTarget as HTMLElement).parentElement?.closest(
                  '[role="radiogroup"]',
                ) as HTMLElement | null;
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  moveFocus(idx, 1, container);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  moveFocus(idx, -1, container);
                }
              }}
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
