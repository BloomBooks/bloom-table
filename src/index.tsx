// Library entry point: export only the public API for consumers.

// Table operations
export * from "./structure";

export * from "./types";
// Drag-to-resize
export { dragToResize } from "./drag-to-resize";

// Table attach/detach
export { attachTable, detachTable } from "./attach";

// Table history manager (if needed for advanced use)
export { tableHistoryManager } from "./history";

// (observer removed; explicit renderer is used)

// Controller
export { BloomTable } from "./BloomTable";

// Cell content types: register/replace content types and the default, plus the
// helpers and the event a host listens for to wire new content.
export {
  registerCellContentType,
  setDefaultCellContentTypeId,
  getDefaultCellContentTypeId,
  getCurrentContentTypeId,
  setupContentsOfCell,
  contentTypeOptions,
  defaultCellContentsForEachType,
  kTableCellContentChangedEvent,
} from "./cell-contents";

// Prepare-for-save: strip transient edit-time artifacts before persisting HTML.
export { removeTableEditingArtifacts } from "./prepare-for-save";

// React control panel (optional; requires the React/MUI peer dependencies).
export { default as TableMenu } from "./components/TableMenu";

// Injectable table-operations API. A host that renders TableMenu in a different
// JS realm/iframe from the tables (e.g. Bloom's toolbox) imports defaultTableApi
// *from the page frame's module* and passes it as TableMenu's tableApi prop, so
// every operation runs in the realm whose history manager owns the table.
export { defaultTableApi, useTableApi, TableApiContext } from "./components/TableApiContext";
export type { TableApi } from "./components/TableApiContext";

// Injectable background-color picker. A host (e.g. Bloom) implements
// ColorPickerProps with its own control and passes it as TableMenu's
// `colorPicker` prop; otherwise DefaultColorPicker (a plain color input) is used.
export {
  ColorPickerContext,
  DefaultColorPicker,
  useColorPicker,
} from "./components/ColorPickerContext";
export type { ColorPickerProps, ColorPickerComponent } from "./components/ColorPickerContext";
