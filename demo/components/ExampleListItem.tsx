import React from "react";
import { Example } from "./ExampleBar";

interface ExampleListItemProps {
  example: Example;
  isActive: boolean;
  onSelect: () => void;
}

const ExampleListItem: React.FC<ExampleListItemProps> = ({ example, isActive, onSelect }) => {
  return (
    <div
      className={`example-item example-list-item ${isActive ? "active" : ""}`}
      onClick={onSelect}
    >
      {example.name}
    </div>
  );
};

export default ExampleListItem;
