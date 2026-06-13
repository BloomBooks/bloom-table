// TableApi: the single object through which the React panel performs every
// DOM-mutating / table-reading operation. Components call useTableApi() instead
// of importing the operations statically.
//
// Why this exists: a host (e.g. Bloom) may render TableMenu in a *different*
// JS realm/iframe from the one where the tables were attached. The library's
// history manager is a per-module singleton, and structural ops no-op when the
// table isn't attached in *that module's* manager. By injecting an api object
// that was built in the page frame's module, the handlers close over the
// page-frame realm and operate on the manager that actually has the table.
//
// The default value is built from this module's own static imports, so a
// consumer that passes no api (e.g. the demo) behaves exactly as before.

import { createContext, useContext } from "react";
import * as Structure from "../structure";
import { BloomTable } from "../BloomTable";
import {
  setupContentsOfCell,
  contentTypeOptions,
  getCurrentContentTypeId,
} from "../cell-contents";
import { render } from "../table-renderer";
import {
  applyCellPerimeter,
  ensureEdgesArrays,
  applyUniformInner,
  setDefaultBorder,
  applyOuterBorders,
} from "../edge-utils";
import { getCellPerimeterValueMap, getTableOuterBorderValueMap } from "../border-state";
import {
  getCellAlign,
  setCellAlign,
  getCellCorners,
  setCellCorners,
  getCellPadding,
  setCellPadding,
  getGapX,
  setGapX,
  getGapY,
  setGapY,
} from "../table-model";

/** Every table operation the React panel needs, bundled so a host can inject a
 *  realm-correct implementation. Types are derived from the real functions. */
export interface TableApi {
  // Controller constructor (instances close over the providing realm's module).
  BloomTable: typeof BloomTable;
  // structure
  getRowIndex: typeof Structure.getRowIndex;
  getRowAndColumn: typeof Structure.getRowAndColumn;
  canUndo: typeof Structure.canUndo;
  undoLastOperation: typeof Structure.undoLastOperation;
  getTargetTable: typeof Structure.getTargetTable;
  // cell contents
  setupContentsOfCell: typeof setupContentsOfCell;
  contentTypeOptions: typeof contentTypeOptions;
  getCurrentContentTypeId: typeof getCurrentContentTypeId;
  // rendering
  render: typeof render;
  // edge (border) writes
  applyCellPerimeter: typeof applyCellPerimeter;
  ensureEdgesArrays: typeof ensureEdgesArrays;
  applyUniformInner: typeof applyUniformInner;
  setDefaultBorder: typeof setDefaultBorder;
  applyOuterBorders: typeof applyOuterBorders;
  // border-state reads
  getCellPerimeterValueMap: typeof getCellPerimeterValueMap;
  getTableOuterBorderValueMap: typeof getTableOuterBorderValueMap;
  // per-cell alignment
  getCellAlign: typeof getCellAlign;
  setCellAlign: typeof setCellAlign;
  // per-cell corners / padding
  getCellCorners: typeof getCellCorners;
  setCellCorners: typeof setCellCorners;
  getCellPadding: typeof getCellPadding;
  setCellPadding: typeof setCellPadding;
  // per-table gaps
  getGapX: typeof getGapX;
  setGapX: typeof setGapX;
  getGapY: typeof getGapY;
  setGapY: typeof setGapY;
}

/** The api built from this module's own functions; used when no api is injected. */
export const defaultTableApi: TableApi = {
  BloomTable,
  getRowIndex: Structure.getRowIndex,
  getRowAndColumn: Structure.getRowAndColumn,
  canUndo: Structure.canUndo,
  undoLastOperation: Structure.undoLastOperation,
  getTargetTable: Structure.getTargetTable,
  setupContentsOfCell,
  contentTypeOptions,
  getCurrentContentTypeId,
  render,
  applyCellPerimeter,
  ensureEdgesArrays,
  applyUniformInner,
  setDefaultBorder,
  applyOuterBorders,
  getCellPerimeterValueMap,
  getTableOuterBorderValueMap,
  getCellAlign,
  setCellAlign,
  getCellCorners,
  setCellCorners,
  getCellPadding,
  setCellPadding,
  getGapX,
  setGapX,
  getGapY,
  setGapY,
};

export const TableApiContext = createContext<TableApi>(defaultTableApi);

/** Read the injected table api (falls back to defaultTableApi via the context). */
export const useTableApi = (): TableApi => useContext(TableApiContext);
