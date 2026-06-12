import React from "react";
import MuiIconButton from "@mui/material/IconButton";
import { styled } from "@mui/material/styles";

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

// Styled MUI IconButton to match previous look & feel by default
const StyledIconButton = styled(MuiIconButton, {
  shouldForwardProp: (prop) => prop !== "selected",
})<{
  selected?: boolean;
}>(() => ({
  backgroundColor: "#2D8294",
  width: 48,
  height: 48,
  borderRadius: 4,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "rgba(255,255,255,0.95)",
  boxSizing: "border-box",
  // remove default padding so the image is centered as before
  padding: 0,
  "&:hover": {
    backgroundColor: "#256c7a",
  },
  // respect disabled state if added later
  "&.Mui-disabled": {
    opacity: 0.6,
  },
}));

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
  ...rest
}) => (
  <StyledIconButton
    onClick={onClick}
    onMouseDown={(e) => e.preventDefault()}
    className={className}
    aria-label={alt}
    title={title ?? alt}
    aria-pressed={selected}
    // allow overriding layout via style prop while keeping our defaults
    style={style}
    selected={selected}
    {...rest}
  >
    {icon ? <img src={icon} alt="" style={{ width: iconSize, height: iconSize }} /> : children}
  </StyledIconButton>
);

export default IconButton;
