import React from "react";
import { sectionStyle, sectionTitleStyle } from "./sectionStyles";

type Props = {
  label: string;
  className?: string;
  titleClassName?: string;
  children?: React.ReactNode;
};

const Section: React.FC<Props> = ({ label, className, titleClassName, children }) => {
  return (
    <div className={[sectionStyle, className].filter(Boolean).join(" ")}>
      <h2 className={[sectionTitleStyle, titleClassName].filter(Boolean).join(" ")}>{label}</h2>
      {children}
    </div>
  );
};

export default Section;
