import React from "react";
import MuiIconButton from "@mui/material/IconButton";

type MUIButtonProps = React.ComponentProps<typeof MuiIconButton>;
type Props = {
  icon?: string;
  alt: string;
  onClick: () => void;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  iconSize?: number; // default 32
  children?: React.ReactNode;
  selected?: boolean;
} & Omit<MUIButtonProps, "children" | "title" | "onClick" | "className" | "style" | "aria-label">;

// The default look & feel, applied through the `sx` prop.
// Do not import `styled` from the MUI styles barrel: it pulls in CssVarsProvider,
// and the dev server's dependency pre-bundler emits a chunk for that which calls
// Emotion's lazy init function without importing it. The demo then fails to load
// with `init_emotion_react_browser_development_esm is not defined`. The test
// src/mui-imports.test.ts keeps the barrel out.
const defaultButtonStyle = {
  backgroundColor: "#2D8294",
  width: 48,
  height: 48,
  borderRadius: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "rgba(255,255,255,0.95)",
  boxSizing: "border-box",
  // remove default padding so the image is centered as before
  padding: 0,
  "&:hover": { backgroundColor: "#256c7a" },
  // respect disabled state if added later
  "&.Mui-disabled": { opacity: 0.6 },
} as const;

export const IconButton: React.FC<Props> = ({
  icon,
  alt,
  onClick,
  title,
  className,
  style,
  iconSize = 24,
  children,
  selected,
  sx,
  ...rest
}) => (
  <MuiIconButton
    onClick={onClick}
    onMouseDown={(e) => e.preventDefault()}
    className={className}
    aria-label={alt}
    title={title ?? alt}
    aria-pressed={selected}
    // allow overriding layout via style prop while keeping our defaults
    style={style}
    {...rest}
    sx={[defaultButtonStyle, ...(Array.isArray(sx) ? sx : [sx])]}
  >
    {icon ? <img src={icon} alt="" style={{ width: iconSize, height: iconSize }} /> : children}
  </MuiIconButton>
);

export default IconButton;
