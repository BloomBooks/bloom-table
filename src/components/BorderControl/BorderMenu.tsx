import { useEffect, useRef, useState } from "react";

export type BorderMenuOption<T> = {
  value: T;
  label: string;
  icon?: () => JSX.Element;
};

export const BorderMenu = <T,>(props: {
  label: string;
  value: T | "mixed";
  options: BorderMenuOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  renderButtonImage?: (current: T | "mixed") => JSX.Element;
  hideLabels?: boolean;
}) => {
  const { label, value, options, onChange, disabled, renderButtonImage, hideLabels } = props;
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (popRef.current && popRef.current.contains(t)) return;
      if (btnRef.current && btnRef.current.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={btnRef}
        title={label + (value === "mixed" ? ": Mixed" : `: ${String(value)}`)}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "#2b6e77",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          padding: "6px 8px",
          minWidth: 64,
          height: 24,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {renderButtonImage
            ? renderButtonImage(value as any)
            : value === "mixed"
              ? "Mixed"
              : String(value)}
        </span>
      </button>
      {open && (
        <div
          ref={popRef}
          role="menu"
          style={{
            position: "absolute",
            zIndex: 1000,
            top: "calc(100% + 4px)",
            right: 0,
            background: "#ffffff",
            color: "#1f3a40",
            border: "1px solid #ccc",
            borderRadius: 6,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            padding: 4,
            minWidth: 140,
          }}
        >
          {options.map((opt) => (
            <div
              key={String(opt.value)}
              role="menuitemradio"
              aria-checked={value !== "mixed" && value === opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              title={opt.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: hideLabels ? "center" : "flex-start",
                gap: 8,
                padding: "6px 10px",
                width: "100%",
                boxSizing: "border-box",
                cursor: "pointer",
                borderRadius: 4,
                background: value !== "mixed" && value === opt.value ? "#d6edf0" : "transparent",
              }}
            >
              {opt.icon ? opt.icon() : null}
              {!hideLabels && <span style={{ color: "#1f3a40" }}>{opt.label}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BorderMenu;
