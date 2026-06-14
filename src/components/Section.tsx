import React from "react";
import { sectionStyle, sectionTitleStyle } from "./sectionStyles";

type Props = {
  label: string;
  className?: string;
  titleClassName?: string;
  children?: React.ReactNode;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
};

const Section: React.FC<Props> = ({
  label,
  className,
  titleClassName,
  children,
  onMouseEnter,
  onMouseLeave,
}) => {
  return (
    <div
      className={[sectionStyle, className].filter(Boolean).join(" ")}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <h2 className={[sectionTitleStyle, titleClassName].filter(Boolean).join(" ")}>{label}</h2>
      {children}
    </div>
  );
};

export default Section;
