# Code review findings — bloom-table

Multi-agent review run on 2026-08-12 (workflow `bloom-table-review-fix-cycle-1`, run `wf_ae2aa90d-eb3`).
Seven reviewers (five code areas, architecture, test coverage) produced 50 bug claims, 31 refactor
proposals, and 32 test-gap findings. Every bug claim was then adversarially re-verified by an
independent agent tracing the code; 49 of 50 were confirmed. A judge agent merged the refactor
proposals and approved 4 with implementation plans.

**Status (updated 2026-08-21): the bug fixes have been applied** to the working tree by a
follow-up run of the same workflow (Opus 5 fixers, one per file cluster). After the fixes the
suite has 277 passing tests in 26 files (up from 183 in 19) and `tsc --noEmit` is clean. Nothing
was committed. A few items were skipped with documented reasons (see the fixer reports in the
workflow journal): the merged-cell perimeter READ bug no longer reproduces after the renderer's
cover-map fix, and one table-size-buttons scenario proved unreachable. The four approved
refactors and the test-gap list below remain open for a later cycle.

## Confirmed bugs (49)

Grouped by severity. Each was confirmed by an independent verifier tracing the actual code.
Note: the two edge-array-splice findings (first high bug and the structure.ts finding from the
architecture reviewer) describe the same root defect, reported independently by two reviewers.

### High (12)

#### Table innerH/innerV sampling reads one cell's side and can misreport, then table-scope edits stamp the misread value everywhere

`src/border-state.ts:45`

getTableOuterBorderValueMap derives innerH/innerV by sampling only cellBorders[0][0].bottom/right (sampleInnerH/sampleInnerV, lines 45-58). But the renderer's zero-gap resolution assigns the winning stroke to ONE side of a shared boundary and keeps an explicit 'none' on the loser (table-renderer.ts:431-437). Failure scenario: on a default-bordered 2x2 zero-gap table, the user turns off the top-left cell's borders via the Cell panel. applyCellPerimeter's removal path writes h[1][0] = {north: none, south: materialized-default}, so the render model keeps the explicit 'none' on cell (0,0).bottom while the visible line is painted by the cell below. sampleInnerH now returns the 'none' spec, so the table map reports innerH = {weight 0, style none} even though visible inner lines exist. Then any table-scope edit round-trips the whole map: BorderControl.onChange -> applyBorderMapToTable -> applyUniformInner(innerH, {0,none}) erases every interior horizontal line (and setDefaultBorder to none as well). Net effect: the user changes only the OUTER border weight and all inner horizontal lines vanish. A symmetric failure happens when cellBorders[0][0].bottom is null because the south side won the boundary (e.g. sided entries left over from an earlier gap>0 edit after the gap is set to 0): the sampler falls back to EDGE_DEFAULT and misreports a heavier/colored inner line as the default.

**Suggested fix:** Sample the boundary, not one cell's side: resolve the shared edge the same way the renderer does (read both north/south via the readH/readV decomposition, pick the visible winner, fall back to edgeDefault only when both sides are unset). Better, scan all interior boundaries and report 'mixed' upward instead of pretending one sample represents the table.

#### stopPropagation on table mousemove starves ProximityDiv and the proximity gate

`src/drag-to-resize.ts:108`

updateCursorOnMouseMove calls event.stopPropagation() whenever getResizeInfo matches (cursor within 5px of a cell's right/bottom edge). This prevents the mousemove from bubbling to the document-level listeners that ProximityDiv (ProximityDiv.ts:21) and the proximity gate (table-size-buttons.ts:2011) rely on. Failure scenario: the user slides the cursor along a cell edge (a very common path when reaching for the row/column '+' buttons) — lastMousePageX/Y and gateMouseX/Y freeze, so pill opacity stops ramping and the gate can neither show nor hide affordances until the cursor leaves the 5px edge band. The stopPropagation buys nothing here (setting the cursor needs no exclusivity).

**Suggested fix:** Remove the stopPropagation() in updateCursorOnMouseMove (and consider having the gate/ProximityDiv listen in capture phase so no bubble-phase consumer can starve them).

#### Column drag start jumps for mm-valued and 'fill' columns

`src/drag-to-resize.ts:319`

updateColumnWidthPreview parses the original width with /([0-9.]+)px/ only, falling back to 50. But the size menu writes '10mm' for columns too (table-size-buttons.ts buildSizeControl uses the same '10mm' default for both dims), and columns can be 'fill'. baseDimension is only captured at mousedown when originalValue === 'hug' (line 144-149). Failure scenario: set a column to fixed 40mm (~151px) via the menu, then drag its edge — on the first mousemove the column snaps to 50px + delta, a visible ~100px jump. Same for a 'fill' column: it snaps to 50px instead of its current rendered width. The row path already handles this correctly via parseSizeToPx.

**Suggested fix:** Use parseSizeToPx for the column path, and capture baseDimension at mousedown for any non-pixel-parseable value ('hug', 'fill', percentages), not just 'hug'.

#### undo(table) applies another table's snapshot to the wrong table

`src/history.ts:139`

The history stack is global across all attached tables, but undo(table) pops the newest entry unconditionally and then applies entry.state to findTopLevelTable(table) - the table the CALLER passed - not to entry.table where the snapshot was captured. Failure scenario: page has tables A and B, both attached. User formats table A (entry pushed with A's innerHTML/attributes), then selects table B and clicks Undo in TableMenu (which calls undoLastOperation(B) -> tableHistoryManager.undo(B)). defaultUndoOperation strips ALL of B's attributes and replaces B's entire innerHTML with A's pre-operation content. B's content is destroyed and the destruction itself is not in history, so it is unrecoverable. undoLast() at line 166-169 has the same flaw in a second form: when entry.table is no longer attached it falls back to 'any attached table' (Set iteration order) and stamps the stale snapshot onto it.

**Suggested fix:** undo() should act on entry.table (verifying it is attached and matches the caller's top-level table, or keeping per-table history stacks). undoLast()'s fallback to an arbitrary attached table should be removed - if entry.table is gone, fail and drop or skip the entry.

#### prepare-for-save misses most body-level overlays: [data-overlay-group] selector matches nothing

`src/prepare-for-save.ts:27`

removeTableEditingArtifacts removes [data-overlay-group] and [data-table-overlay] elements, but no code anywhere in src/ ever sets data-overlay-group - the cluster containers in table-size-buttons.ts:311 are tagged data-overlay-cluster. So the selector is dead. Untagged edit-time elements appended to document.body that survive a save: ProximityDiv wrappers (plain absolute-positioned divs, ProximityDiv.ts:44-57) together with their children - the add-column/add-row pill buttons (makeOverlay, table-size-buttons.ts:262, no data tag at all), the row/column/table menu pills (data-btable-menu-pill), the cluster containers (data-overlay-cluster) - plus the open menu popup (data-btable-menu, appended at table-size-buttons.ts:1670), the paint-format badge (.bloom-paint-format-badge, appended at 1420), and the bloom-paint-format class on document.body (1427). A host that persists document.body.innerHTML (the documented Bloom flow) saves all of this UI chrome into the document; on reload the dead buttons/pills render as garbage content. Only delete-preview, add-preview, the pulse overlay, and the paint-format <style> are correctly tagged data-table-overlay.

**Suggested fix:** Tag every body-appended overlay (including the ProximityDiv wrapper itself) with data-table-overlay at creation, and delete the dead data-overlay-group branch. Add a test that runs ensureTableSizeButtons + hover flows and asserts body is clean after removeTableEditingArtifacts.

#### Row/column removals never splice the edge arrays, losing or misaligning all borders

`src/structure.ts:947`

Insertions splice data-edges-h/data-edges-v (copyEdgesForInsertedRow/Column) and moves reorder them, but removeColumnAt (line 947), removeRowAt (line 998), removeLastRow (line 284), and removeLastColumn (line 352) do not touch them. Failure scenario: a 2x2 table with full-size data-edges-h (3x2) and data-edges-v (2x3); removeRowAt(0) leaves edges-h at length 3 while the renderer's readH accepts only rows+1=2, rows-1=0, or 1 — so every horizontal border silently vanishes. Meanwhile edges-v still has 2 rows; readV happily uses edgesV[0] (old row 0's borders) for the surviving row, which was old row 1 — the wrong row's borders render. Same corruption for column removal against edges-v/edges-h column counts.

**Suggested fix:** In each removal operation, splice the matching line out of edges-v/edges-h (and the perpendicular arrays' per-line entries), mirroring copyEdgesForInsertedRow/Column; add a shared removeEdgesForLine helper in the lineAxisOps style.

#### Removing the row/column containing a merge anchor orphans its covered skip cells

`src/structure.ts:960`

removeColumnAt's span fix-up only handles `cellColumn < index && cellColumn + spanX > index`, i.e. anchors strictly left of the removed column. If the anchor itself is in the removed column (e.g. 2x2 table, setCellSpan(cell(0,0), 2, 1), then removeColumnAt(0)), the anchor is deleted while cell(0,1) keeps its bloom-skip class forever: display:none, so row 0 renders empty, and no operation can ever unskip it (its anchor is gone). removeRowAt (line 1011) has the identical hole for data-span-y anchors. The fix-up should detect an anchor at the removed index with span > 1, promote the next covered cell to be the new anchor (unskip it, give it span-1), then remove.

**Suggested fix:** Before removal, for each anchor at the removed line with span>1 along the removal axis: remove bloom-skip from the adjacent covered cell, transfer span-1 (via writeSpan) to it, and only then delete the line's cells.

#### removeLastRow/removeLastColumn ignore spans entirely, leaving spans pointing outside the table

`src/structure.ts:274`

Unlike removeRowAt/removeColumnAt, the removeLast* pair (lines 274-298 and 340-372) do no span bookkeeping. Failure scenario: 2x2 table, setCellSpan(cell(0,0), 1, 2) — cell(1,0) is bloom-skip — then removeLastRow(). The last-row cells (including the skip cell) are removed, but the anchor keeps data-span-y="2" in a now 1-row table. The renderer emits --span-y:2 into a 1-row grid, and any later setCellSpan on that anchor throws (its unmark loop calls getCell(table, 1, 0), which asserts 'Row index 1 would be out of bounds'). Same for removeLastColumn with data-span-x. Also note removeLastRow will happily remove the final row (removeRowAt asserts rowCount > 1), and its `rowHeightsAttr.split(",").length === 0` guard is dead code since split never returns an empty array.

**Suggested fix:** Delegate removeLastRow/removeLastColumn to removeRowAt/removeColumnAt(count-1) so span (and, once fixed, edge) handling exists in one place.

#### Structural remove/blank-insert ops never splice the edge arrays, silently discarding all authored borders

`src/structure.ts:990`

insertLineAt splices data-edges-h/data-edges-v only when sourceIndex != null (line 875: `if (sourceIndex != null) ops.copyEdges(...)`), and removeRowAt, removeColumnAt, removeLastRow, and removeLastColumn never touch the edge arrays at all. Once a user has edited any border, ensureEdgesArrays (edge-utils.ts) has written full-size arrays: H is (R+1)xC, V is Rx(C+1). Failure scenario: author borders on a 3x3 table, then Delete Row from the menu -> data-edges-h is still 4 rows but the table has 2; the renderer's shape detection in readH/readV (table-renderer.ts:235-312) accepts only lengths R+1, R-1, or 1, so the mismatched arrays match nothing, every entry reads as undefined, and ALL authored borders visually revert to the default. Worse, the next border edit runs ensureEdgesArrays which pads/truncates at the END, so the surviving borders are shifted relative to the rows/columns they were authored on. Existing removeRowAt/removeColumnAt tests (structure.test.ts:341-464) never set edge arrays, which is why this is green. Fix inside the existing lineAxisOps pattern: add removeEdges(table, index, info) (splice V row `index` and merge/drop H boundary `index+1` keeping the perimeter fixed, mirroring what moveRowAt already does correctly) and call ops.copyEdges with empty entries for blank inserts; add tests mirroring the duplicateRowAt edge-splice tests at structure.test.ts:1047.

#### Renderer assigns edge strokes to display:none skip cells, so merged cells lose borders

`src/table-renderer.ts:461`

bloom-skip cells are display:none, yet buildRenderModel writes borders to them or silently drops them instead of rerouting to the merge anchor. (a) Perimeter loops (lines 448-515) never check bloom-skip: in a 2x2 table where cell(0,0) has data-span-y=2, the bottom perimeter for column 0 is written to cells[idx(1,0)] — the hidden skip cell — so the merged cell renders with NO bottom border while its neighbor column shows one. (b) Interior loops drop the winning stroke when the winning side's cell is skip (lines 389-394, 431-437): for an anchor spanning columns 0-1, the boundary at c=2 computes iLeft=idx(r,1) (skip), so a west-side or tie-favored-left spec is discarded and the anchor's right edge is unpainted. (c) The anchor's trailing border instead comes from the covered interior boundary (between c=0 and c=1), i.e. from the wrong edge entry — visually wrong whenever authored edges differ from the default. Borders should resolve against the span geometry: covered boundaries are interior to the merge (no stroke), and boundary strokes belonging to a merged region paint on the anchor.

**Suggested fix:** Map each grid position to its covering anchor (like structure.ts findSpanCover) inside buildRenderModel; skip boundaries interior to a merge, and route perimeter/interior winners for covered positions to the anchor's cellBorders entry.

#### resetTableSizeButtons leaks ProximityDiv instances and wrapper divs; preview divs go stale

`src/table-size-buttons.ts:104`

resetTableSizeButtons nulls proxColCluster/proxRowCluster/proxColAdd/proxRowAdd/proxTablePillTL without calling destroy(). Each ProximityDiv registered itself in the module-global globalInstances array (ProximityDiv.ts:59) and appended a wrapper div to document.body. After reset + re-ensure, new instances are created while the old ones remain in globalInstances forever — every document mousemove then calls updateOpacity() (which does getBoundingClientRect) on an ever-growing list of dead instances, and in a real host the orphaned wrapper divs (with their buttons) stay in the DOM. Additionally deletePreviewDiv/addPreviewDiv (lines 220, 2379) are not nulled by reset: if the host replaces body content, ensureDeletePreviewDiv/ensureAddPreviewDiv keep returning a detached div, so the delete/add hover previews silently never appear again.

**Suggested fix:** In resetTableSizeButtons, call destroy() on each ProximityDiv before nulling it, remove/null deletePreviewDiv and addPreviewDiv, and null tablePillTL's DOM too.

#### Enter in a nested table inserts two paragraphs; attachTextEditing is not idempotent and never detached

`src/text-editing.ts:6`

attachTextEditing adds a keydown listener on the table div with no guard and no teardown. Three concrete failures: (1) Nested tables are attached in their own right (setupContentsOfCell cell-contents.ts:174, attachClonedNestedTables BloomTable.ts:35, and the demo's attachAllTables which attaches every .bloom-table including inner ones). A keydown in a nested cell's contenteditable bubbles through the inner table div AND the outer table div; both handlers run, the first inserts <p><br></p> and moves the caret inside it, the second inserts a second <p> nested inside the first - every Enter press produces two nested paragraphs. (2) Calling attachTable twice on the same table (e.g. React StrictMode double-running the demo's effect, or a host re-attaching after content reload) stacks duplicate listeners with the same double-insert result, unlike dragToResize.attach which guards with a Set (drag-to-resize.ts:58). (3) detachTable (attach.ts:54) removes history and drag-to-resize wiring but never removes this listener, so a detached 'read-only' table still rewrites Enter keypresses.

**Suggested fix:** Give attachTextEditing an attach guard (WeakSet or data flag), have the handler ignore events whose nearest .bloom-table ancestor is not this table (or stopPropagation), and return/expose a detach that detachTable calls.

### Medium (19)

#### Cell perimeter READ is span-unaware while the WRITE is span-aware, so merged cells read the wrong edges

`src/border-state.ts:92`

applyCellPerimeter (edge-utils.ts:250-347) handles spans: a cell with data-span-x=2 writes its right border at boundary c+sx and loops rows r..r+sy. But resolveCellPerimeterSpecs (border-state.ts:82-99) and getCellOwnPerimeter (border-state.ts:140-168) ignore spans entirely: they take model.cellBorders[index] and borrow from the immediate grid neighbor (r, c+1)/(r+1, c), which for a merged cell is its own bloom-skip placeholder — whose cellBorders sides are never populated (the renderer guards assignments with leftIsSkip/rightIsSkip). Failure scenario: merge two cells horizontally, set the merged cell's right border to 2px red via the Cell panel (write lands at boundary c+2), then reopen the panel: getCellPerimeterValueMap reads sides.right from the boundary interior to the span (unset/default) and the borrow target is the skip cell (null), so the UI shows the default instead of the red border just applied. The same asymmetry corrupts copy-properties: getCellOwnPerimeter snapshots the merged cell's right/bottom from boundaries inside its own span. The renderer has a related span blind spot (it resolves boundaries between a host cell and its own skip cells at table-renderer.ts:346-397), but the reader/writer mismatch in this area stands on its own.

**Suggested fix:** In resolveCellPerimeterSpecs and getCellOwnPerimeter, compute sx/sy via getSpan and read right from boundary c+sx (neighbor at (r, c+sx)) and bottom from boundary r+sy, skipping over bloom-skip placeholders — mirroring applyCellPerimeter's indexing. Also reuse getTableCells instead of the inline table.children filter (border-state.ts:79-81, 150-153).

#### setupContentsOfCell dispatches content-changed even when the change never happened

`src/cell-contents.ts:205`

With putInHistory=true, addHistoryEntry can refuse to run doIt (table detached, or another operation in progress - it just console.warns and returns) or doIt can throw and be swallowed (history.ts:100). setupContentsOfCell cannot see either outcome and unconditionally dispatches kTableCellContentChangedEvent claiming the cell now has targetType. A host listening to wire an editor onto the new content acts on a cell whose DOM was never rebuilt (or was left half-rebuilt). formatting-commands.applyContentType works around exactly this by re-checking getCurrentContentTypeId after the entry closes (formatting-commands.ts:113-117); the direct putInHistory path has no such guard.

**Suggested fix:** After the addHistoryEntry call, verify cell.dataset.contentType === targetType before dispatching, mirroring applyContentType.

#### BorderControl.apply() skips the weight/style interdependency normalization that resolveEdge performs

`src/components/BorderControl/BorderControl.tsx:45`

formatting-commands.ts resolveEdge (lines 168-183) keeps weight and style consistent: setting a real style on a weight-0 edge bumps weight to 1; weight 0 forces style 'none'. BorderControl's apply() (lines 45-59) merges the raw change with no such normalization. Failure scenario: an edge shows weight 0 / style 'none' (both menus enabled per interdependencyDisabled's both-none branch). The user picks 'dashed' in the Style menu: the map becomes {weight 0, style 'dashed'}, toSpec writes it as an explicit none, so nothing appears on screen — and interdependencyDisabled now returns styleDisabled: true (weight 0 + visible style), locking the very menu the user just used, with 'dashed' displayed in a disabled control next to an invisible border. Same edit via the toolbar border-props path (resolveEdge) would have produced a visible 1px dashed line. Two edit paths, two behaviors.

**Suggested fix:** Normalize inside apply() with the same rules as resolveEdge (extract resolveEdge's weight/style coupling into shared logic under BorderControl/logic and use it in both places).

#### CellSection border map is memoized on cell identity, so BorderControl shows stale borders after undo or paint-format

`src/components/CellSection.tsx:100`

borderValueMap is useMemo'd on [api, currentCell]. TableMenu forceUpdates on tableHistoryUpdated and on table attribute mutations, but the memo returns the cached map because the cell element identity is unchanged, and borderControlKey (cell index) is also unchanged, so BorderControl neither remounts nor receives a new props.valueMap (its sync effect keys on props.valueMap identity). Failure scenario: select a cell, set its border weight to 3, press Undo. The table renders with the old border, but the Borders control still shows weight 3. Same staleness after Paint Format applies borders to the selected cell. TableSection avoids this by rebuilding its map on every render; CellSection should do the same (the build is cheap).

**Suggested fix:** Drop the useMemo (or include the forceUpdate tick in its deps) so the map is re-read from the DOM on every panel re-render.

#### RadioGroup has no radio semantics or keyboard model

`src/components/RadioGroup.tsx:20`

The component is named and used as a radio group (content type, alignment, row/column size) but renders plain buttons with aria-pressed and no wrapping role='radiogroup', no role='radio'/aria-checked, no group label, and no arrow-key navigation with roving tabindex. A screen reader announces three unrelated toggle buttons, so 'Left pressed' + 'Center not pressed' does not convey a single-choice control, and every tile is a separate tab stop. Also each IconButton calls onMouseDown preventDefault, so the buttons can never receive focus by click, making the selected state invisible to focus-tracking AT.

**Suggested fix:** Render role='radiogroup' with aria-label, give tiles role='radio' + aria-checked, and implement roving tabindex with ArrowLeft/ArrowRight handling.

#### Disabled panel sections are still keyboard-operable and crash on Enter

`src/components/TableMenu.tsx:193`

When no cell is selected, TableMenu wraps the sections in a div with pointerEvents:'none' and aria-disabled, but pointer-events does not block keyboard interaction and aria-disabled on a container does not disable descendant buttons. RowSection/ColumnSection always render their IconButtons (they are real MUI buttons, not disabled). Failure scenario: with no cell selected, Tab to 'Insert Row Above' and press Enter -> handleInsertRowAbove -> getTargetTableFromSelection() executes currentCell!.closest(...) with currentCell === null -> TypeError thrown from the click handler. Screen-reader users also get no indication the controls are inert.

**Suggested fix:** Pass a real disabled prop down to the section buttons (IconButton already forwards MUI props), or add inert/tabIndex=-1 to the wrapper, and guard every handler with an early return instead of assert/non-null assertions.

#### Undo leaves the panel pointing at a detached cell; selection dies and Undo cannot be repeated

`src/components/TableMenu.tsx:35`

Undo restores table.innerHTML (history.ts defaultUndoOperation, line 234), which replaces every cell element. The host (demo Toolbar.tsx) only updates currentCell on focusin, so after one Undo the currentCell prop references a detached node; currentCell.closest('.bloom-table') returns null, hasContext goes false, the whole panel greys out, and the Undo button disables even though history still has entries. Failure scenario: click a cell, add a row, click the panel's Undo -> panel immediately shows 'Click in a table cell to edit it' and a second Undo is impossible until the user re-clicks a cell. TableMenu could re-resolve the selection (e.g. remember row/column and look the cell up again after tableHistoryUpdated) or history could restore focus.

**Suggested fix:** On tableHistoryUpdated, if currentCell is no longer connected (currentCell.isConnected === false), re-resolve the equivalent cell by row/column in the restored table and refocus it.

#### Edge detection is span-unaware: dragging a spanning cell's edge resizes the wrong column/row

`src/drag-to-resize.ts:443`

getResizeInfo maps the hovered cell to a column via getRowAndColumn, which returns the cell's START column. For a cell with data-span-x=2 starting at column 0, its visible right edge is the boundary of column 1, but the drag resizes column 0. Failure scenario: merge a cell rightward, grab its right edge, drag — the width written to data-column-widths[0] moves the boundary between columns 0 and 1 (in the middle of the merged cell), not the edge under the cursor. Same issue for the bottom edge of a data-span-y cell (line 424).

**Suggested fix:** Add the cell's span to the index: for column resize use column + spanX - 1, for row resize use row + spanY - 1.

#### Detaching the last table mid-drag strands the drag state and latches the body cursor

`src/drag-to-resize.ts:90`

detach() removes the document mousemove/mouseup listeners when attachedTables becomes empty, without checking dragState.isDragging. Failure scenario: a drag is in progress (body cursor latched to ew-resize) and the host detaches the table (e.g. page teardown, table deletion via the menu triggering a host detach) — handleGlobalMouseUp never fires, so dragState stays isDragging=true and document.body.style.cursor remains 'ew-resize' for the rest of the session; a later re-attach starts with a poisoned dragState pointing at a removed element.

**Suggested fix:** In detach(), if dragState.isDragging (and especially if dragState.targetElement is the detached table), run the mouseup cleanup path (resetDragState + restore body cursor) before removing global listeners.

#### Exception during performOperation leaves partial DOM mutation with no undo entry

`src/history.ts:99`

addHistoryEntry captures stateBeforeOperation, runs performOperation, and on throw merely console.errors and returns - the captured pre-state is discarded. Any operation that mutates then throws leaves the table half-changed and unrecoverable. Concrete case: setupContentsOfCell's doIt (cell-contents.ts:156-187) first sets cell.dataset.contentType and replaces cell.innerHTML, then throws if the template produced != 1 root element - the cell is already rebuilt, the error is swallowed, no history entry exists, and the caller has no way to know it failed (addHistoryEntry returns void).

**Suggested fix:** In the catch block, restore stateBeforeOperation via defaultUndoOperation (it was captured precisely for this), and return a boolean success so callers like setupContentsOfCell can skip their host notification.

#### removeTableEditingArtifacts targets a stale attribute; current overlay chrome leaks into saved HTML

`src/prepare-for-save.ts:27`

The function removes `[data-overlay-group]`, but nothing in the codebase sets that attribute anymore: cluster containers set `data-overlay-cluster` (table-size-buttons.ts:311), the row/column/table pills and the two '+' add buttons carry no marker at all, each is wrapped in an unmarked ProximityDiv wrapper appended to document.body, and the paint-format badge uses only a class. Failure scenario: a host that persists document.body.innerHTML (the documented Bloom use case in this file's own header comment) saves the pills, add buttons, ProximityDiv wrappers, and any active paint badge into the document; on reload they are dead DOM. Fix without changing behavior otherwise: set `data-table-overlay` (already handled at line 32) on every body-appended overlay root -- have ProximityDiv stamp its wrapper, and stamp the paint badge and menu popup -- then delete the dead `[data-overlay-group]` branch and removeWithProximityWrapper; add a prepare-for-save test that runs ensureTableSizeButtons + showEdgeOverlays first.

#### data-gap-x/data-gap-y are per-boundary but never spliced by insert/remove/move

`src/structure.ts:843`

The renderer treats gaps as per-boundary lists (hasPositiveGapX indexes gapX[c]), and the module doc says data-gap-x has C-1 entries. insertLineAt splices sizes and edges but not gaps; removals and moveRowAt/moveColumnAt don't touch them either. Failure scenario: a 3-column table with data-gap-x="0,20px" (gap only between columns 1 and 2); addColumnAt(0) shifts every boundary right by one, but the gap list stays put, so the gap now appears between the wrong pair of columns and the border sided-painting logic switches modes on the wrong boundary.

**Suggested fix:** Splice the gap arrays alongside the size arrays in insertLineAt, the removals, and the moves (when the array is per-boundary length; leave single-value arrays alone).

#### setCellSpan reads current span from CSS vars while data-* is the declared source of truth

`src/structure.ts:458`

setCellSpan derives currentSpanX/Y from cell.style.getPropertyValue("--span-x") (lines 458-459), but its own comment (line 487) and every other reader (changeCellSpan, findSpanCover, buildRenderModel, table-model getSpan) use data-span-x/y. Failure scenario: a cell whose span was set via table-model's setSpan(), or hand-authored HTML with data-span-x="2" plus bloom-skip classes, before any render() has mirrored the CSS vars: setCellSpan(cell, 1, 1) reads current=1x1, hits the early-return at line 461, and the unmerge silently no-ops — data-span-x stays "2" and the covered cells stay skipped. changeCellSpan(cell, -1, 0) hits the same wall because it computes from data-* but delegates to setCellSpan.

**Suggested fix:** Read the current span from data-span-x/y (e.g. reuse getSpan from table-model) and keep the CSS vars write-only mirrors.

#### Concise (interior-only) edge arrays are silently corrupted by structural inserts

`src/structure.ts:135`

The renderer explicitly supports interior-only edge arrays (readH accepts length rows-1; readV accepts cols-1), but copyEdgesForInsertedRow/Column only splice when the arrays are full-sized (guards at lines 135 and 142 require rows/rows+1 and cols+1/cols). Failure scenario: a table authored with the documented concise form, data-edges-h of length rows-1; addRowAt inserts a row, the array is left untouched, and now its length equals (new rows)-2 — matching none of readH's accepted sizes — so every authored horizontal border disappears from the next render.

**Suggested fix:** Either normalize concise arrays to the unified full-size form on attach/first mutation, or teach the splice helpers the concise layout.

#### ensureTableSizeButtons re-adds anonymous document/window listeners after every reset

`src/table-size-buttons.ts:134`

resetTableSizeButtons sets installed=false but the focusin, contextmenu, window resize, window scroll, and tableHistoryUpdated listeners added by ensureTableSizeButtons are anonymous closures that are never removed. The next attachTable calls ensureTableSizeButtons again and adds a second copy of each. Failure scenario: any host that resets and re-attaches N times runs N focusin handlers and N contextmenu handlers per event (each contextmenu handler calls openMenu, so the menu is built N times, the last one winning); the test suite itself accumulates hundreds of duplicates across test files sharing a module registry. Contrast with the gate, which correctly uses a separate gateInstalled flag that reset does NOT clear.

**Suggested fix:** Keep references to the handlers and remove them in resetTableSizeButtons, or (matching the gate's pattern) never clear installed and make the handlers read resettable state instead.

#### Scroll/resize with no active table adopts an arbitrary table and shows its pills, bypassing the proximity gate

`src/table-size-buttons.ts:1885`

repositionEdgeOverlays, when overlayTable is null, adopts the table of the selected cell or simply the FIRST .bloom-table in the document, then calls applyAnchorPositioning, which sets tablePillTL/colAddBtn/rowAddBtn display:'flex' whenever the table has bounds (lines 2200-2202). Failure scenario: the page loads, the user scrolls without ever moving the mouse near a table — the scroll listener fires scheduleOverlayReposition, the first table on the page is adopted, and its table pill and '+' buttons appear (the table pill's minOpacity is 0.6, clearly visible) even though the pointer is nowhere near it. The gate only corrects this on the next mousemove.

**Suggested fix:** Don't adopt a table in repositionEdgeOverlays; if overlayTable is null there is nothing to reposition. Let showEdgeOverlays (focus/gate driven) be the only entry point that sets overlayTable.

#### '+' hover preview shows the insert at the selected row/column, but the click inserts at the table's far edge

`src/table-size-buttons.ts:2458`

ensureAddHover wires the row '+' to showAddPreview('row','below') and updateAddPreviewGeometry computes the bar at the SELECTED cell's row boundary (r === row of the selected cell). But tryInsertRowBelow/tryInsertColumnRight (lines 2237-2261) always append at the table's far edge, regardless of selection (the comment at 2233 says so explicitly). Failure scenario: in a 3-row table with row 0 selected, hovering the row '+' pulses a bar just below row 0; clicking inserts a row after row 2. The preview actively misleads.

**Suggested fix:** Make updateAddPreviewGeometry use the last row/column (or the table bounds' maxBottom/maxRight) to match what the buttons actually do.

#### Delete preview keyed to .cell--selected while menu commands act on menuTargetCell; can also throw for nested tables

`src/table-size-buttons.ts:2336`

updateDeletePreviewGeometry (and showDeletePreview) locate the row/column via the document-wide '.bloom-cell.cell--selected', but tryRemoveRow/tryRemoveColumn act on getMenuCell() = menuTargetCell (the right-clicked cell). Failure scenario: cell A is selected; the user right-clicks INSIDE cell B's editable (selection-highlight's mousedown returns early for clicks inside an editable, so selection stays on A); the context menu targets B; hovering 'Delete Row' draws the red X over A's row while clicking deletes B's row. Second failure: with a nested table, the selected cell can belong to a different table than overlayTable — getRowAndColumn(overlayTable, selected) at line 2341 then throws an uncaught assert ('Cell not found in the table') from a mouseenter handler. Same document-wide selected-cell lookup problem exists in updateAddPreviewGeometry (line 2429).

**Suggested fix:** Use menuTargetCell (falling back to the overlay table's ownSelectedCell) for the delete preview, and guard getRowAndColumn with a cell-belongs-to-table check.

#### Enter handler hijacks keydown on any div, not just contenteditable ones

`src/text-editing.ts:7`

The condition is only `event.key === "Enter" && event.target instanceof HTMLDivElement`. Cells themselves are divs and can hold focus (setupContentsOfCell sets cell.tabIndex = -1 for table cells; cells also get focused by BloomTable.focusEditableInCell when no editable is found). With focus on a non-editable div inside the table, pressing Enter is preventDefault-ed and a <p> is inserted at wherever the document's current selection happens to be - possibly in a different cell or outside the table entirely. It also swallows Shift+Enter and Ctrl+Enter, and `instanceof HTMLDivElement` fails cross-realm (table living in an iframe document while the library is loaded in the parent - Bloom's hosting model).

**Suggested fix:** Require (event.target as HTMLElement).isContentEditable, let modified Enter keys through (or handle Shift+Enter as <br>), and prefer a duck-type/nodeName check over instanceof.

### Low (18)

#### setColumnWidth/setRowHeight push a history entry (and dispatch events) even when the index is out of bounds

`src/BloomTable.ts:307`

The bounds check lives inside the perform closure, which silently returns; addHistoryEntry still sees a 'successful' operation, pushes an entry labeled 'Set Column N Width', and dispatches tableHistoryUpdated. Failure scenario: ctrl.setColumnWidth(99, '100px') on a 2-column table - nothing changes, but the user's next Ctrl+Z consumes a do-nothing entry (Undo appears broken: pressing it once visibly does nothing, the real previous edit needs a second press). render() is also called even when the history manager refused the operation entirely.

**Suggested fix:** Validate the index before calling addHistoryEntry and return early on out-of-bounds.

#### ProximityDiv.destroy leaves the child's hover listeners attached

`src/ProximityDiv.ts:116`

The constructor attaches mouseenter/mousemove handlers to the child (lines 68-69) that close over the instance, but destroy() only removes the instance from globalInstances and removes the wrapper. If a caller re-parents the child after destroy (the child element is passed in from outside, so it outlives the wrapper), every hover still calls updateOpacity() on the destroyed instance and overwrites the child's opacity. Also, the document-level mousemove listener (line 21) is installed once and can never be removed, which is fine as a singleton but means the module can never be fully torn down.

**Suggested fix:** Store the onHover reference and removeEventListener both handlers in destroy().

#### Content-type sniffing regexes misidentify cells: 'text' wins over 'table', and the table regex matches any class containing 'table'

`src/cell-contents.ts:43`

getCurrentContentTypeId and setupContentsOfCell identify legacy cells (no data-content-type) with defaultCellContentsForEachType.find(...), which checks in array order: text first. A cell whose content is a nested bloom-table matches the TEXT regex first, because the nested table's cells contain contenteditable divs. Consequence: setupContentsOfCell(cell, 'table') on such a cell sees existing='text' != target='table' and destroys the existing nested table, replacing it with a fresh empty 2x2 template. Separately, the table regex /class=['"][^'"]*table[^'"]*['"]/ matches ANY class token containing the substring 'table' (e.g. Tailwind's 'table', 'timetable', 'sortable') - the exact collision the bloom- prefix convention exists to avoid.

**Suggested fix:** Order the sniffers most-specific-first (table before text) or match on the cell's direct child only; tighten the table regex to class boundaries with 'bloom-table'.

#### toHexColor cannot parse space-separated rgb() or named colors; alpha ignored

`src/color-utils.ts:14`

The rgb branch splits on commas only, so modern space-separated syntax ('rgb(10 20 30)' or 'rgb(10 20 30 / 50%)') parses r=10 and silently zero-fills g/b, yielding #0a0000; named colors ('red') and 4/8-digit hex fall through to the #000000 fallback. getComputedStyle currently serializes with commas so the panel path mostly works, but toHexColor is exported as a general helper and receives author-written values via border data attributes. representativeBorderColorHex additionally treats a side with style!='none' but width 0 or a fully transparent color as the representative color, returning black for rgba(0,0,0,0).

**Suggested fix:** Split on /[\s,\/]+/, handle 4/8-digit hex, and (in a browser context) fall back to canvas/computed-style normalization for named colors; skip zero-width and zero-alpha sides in representativeBorderColorHex.

#### BorderControl re-syncs valueMap on prop change but never re-syncs the edge selection

`src/components/BorderControl/BorderControl.tsx:23`

The useEffect at lines 28-30 copies props.valueMap into local state when the upstream map changes (the comment says 'e.g., switching cells/tables'), but `selected` is initialized once from the first map and never recomputed. CellSection works around this with key-based remounting, but its key is the cell's index within its table (CellSection.tsx:106-115): switching from cell 3 of table A to cell 3 of table B keeps key "3", so the component does not remount — the value map re-syncs while the selection computed for the old cell's border pattern persists, and the next Style/Weight click applies to edges the user never chose for this cell. TableSection's instance (TableSection.tsx:167) has no key at all, so switching between tables keeps the first table's selection.

**Suggested fix:** Recompute the selection (computeInitialSelection) in the same effect that re-syncs valueMap when the identity of the edited object changes, or key the control on something globally unique to the cell/table rather than a per-table index.

#### Inner-plus toggle flips innerH and innerV independently, so a split selection swaps instead of toggling

`src/components/BorderControl/BorderSelector.tsx:19`

computeInitialSelection groups edges by value tuple and can legitimately select innerH without innerV (e.g. innerH matches top/bottom while innerV differs). BorderSelector's toggle('inner') (lines 19-31) then deletes innerH and adds innerV — one click swaps which inner axis is selected rather than selecting or deselecting 'inner' as a unit, and the group opacity (line 275: full opacity when either is selected) gives no hint of the split. The user clicks the plus expecting to deselect inner borders and silently ends up editing the other axis.

**Suggested fix:** Treat inner as a unit in the toggle: if either innerH or innerV is selected, remove both; otherwise add both. Or render the two inner bars as independently clickable if split selection is meant to be a real state.

#### Cell alignment mirror state goes stale when alignment changes outside the RadioGroup

`src/components/CellSection.tsx:82`

align is local state re-synced only when currentCell identity changes. Paint Format (formatting-commands.ts applyAlignment / CellSettings copy) writes data-align on the selected cell without changing cell identity, and the effect deps [currentCell, api] never fire, so the alignment radio keeps showing the pre-paint value. Failure scenario: select cell A (center), paint-format left-alignment from cell B onto A -> table shows left, panel radio still shows Center.

**Suggested fix:** Read alignment from the DOM on every render (api.getCellAlign) and use local state only as an optimistic echo, like Slider does, or re-sync on the panel's forceUpdate tick.

#### Padding slider shows 0 for cells that actually have the 8px default padding

`src/components/CellSection.tsx:218`

getCellPadding returns null when data-pad is absent, and firstPx(null) is 0, so a fresh cell (whose effective padding is the stylesheet default --cell-padding: 8px 10px) shows the slider at 0. Failure scenario: open the panel on a new cell, nudge the slider one notch to 1 -> the cell's padding visibly shrinks from 8px to 1px even though the UI suggested it was increasing from 0. Also writing `${v}px` collapses the two-value default shape to uniform padding without the UI indicating that.

**Suggested fix:** When data-pad is absent, seed the slider from the computed padding of the cell (or from the default constant) rather than 0.

#### Hover pulse overlay is never cleaned up on unmount or selection change

`src/components/CellSection.tsx:91`

The pulse overlays are added on onMouseEnter and removed only on onMouseLeave. If the selected cell changes while the pointer stays inside a section (e.g. focus moved by keyboard), the later onMouseLeave closure clears using the NEW currentCell's document but the overlay drawn for the old cell may sit over a region that no longer matches; and if the panel unmounts while hovered (host hides the toolbox), the overlay div stays in the page until something else calls clearPulse. clearPulse removes all overlays in the document so self-healing usually occurs, but nothing guarantees it after unmount.

**Suggested fix:** Add a useEffect cleanup in Section (or the sections that pulse) that calls clearPulse on unmount and when currentCell/table changes.

#### Row size radios read the drag-active row but write to the focused cell's row

`src/components/RowSection.tsx:38`

The displayed size (lines 37-49) prefers data-ui-active-row-index (set by drag-to-resize during a row drag) while onChangeSize (line 61) always uses api.getRowIndex(currentCell). While a drag is in progress, or if the attribute ever lingers (mouseup handling in drag-to-resize removes it, but only on the happy path), the radio shows row N's height while clicking a radio mutates row M. ColumnSection has no such asymmetry, which shows the intent drifted.

**Suggested fix:** Use one row-resolution helper for both the read and the write (either honor data-ui-active-row-index in both places or in neither).

#### Merge/Split buttons only ever change horizontal span

`src/components/TableMenu.tsx:95`

handleExtendCell/handleContractCell always call setSpan with (x+1, y) / (max(1,x-1), y). A cell merged vertically (span-y > 1, e.g. produced by loading example HTML or a future selection-merge) cannot be split by the Split button: clicking it reduces x below... actually with x already 1 it becomes a no-op while y stays merged. The user sees a 'Split' button that does nothing on a vertically merged cell.

**Suggested fix:** Make Split reduce y when x is already 1 (and consider an Extend variant for y), or disable the buttons when they would no-op.

#### TableSection corner value state goes stale after Undo

`src/components/TableSection.tsx:145`

cornerValue is state seeded from getComputedStyle and re-synced only when the table prop identity changes. Undo restores the table's attributes on the same element, so after undoing a corner change the CornerMenu still shows the undone radius. Failure scenario: set table corners to 8, press Undo -> table renders square corners, Corners menu still shows 8.

**Suggested fix:** Derive the value during render (the component already re-renders on history events via TableMenu's forceUpdate) instead of caching it in state; keep setCornerValue only as the optimistic echo.

#### Per-mousemove console logging in row-resize preview and mousedown

`src/drag-to-resize.ts:373`

updateRowHeightPreview logs '[drag-to-resize] preview row ...' on every mousemove frame during a row drag, and getRowTopEdge (lines 581-616) emits five console.info lines per mousedown, plus handleMouseDown line 126. A single row drag floods the console with hundreds of lines in production. This is leftover debug output.

**Suggested fix:** Delete the console.log/console.info calls (or gate them behind a debug flag).

#### Stale inline cursor styles left on cell content elements

`src/drag-to-resize.ts:106`

updateCursorOnMouseMove writes target.style.cursor ('ew-resize'/'ns-resize'/'default') onto whatever element the pointer is over — often a contenteditable or other content node inside the cell. handleMouseLeave (line 154) only resets event.target of the leave event (the table div itself), so a child that last showed 'ew-resize' keeps that inline style when the pointer exits through it. Failure scenario: hover a cell's right edge, then move the mouse quickly out of the table — the child keeps cursor:ew-resize inline; and every touched element permanently gains a style="cursor: default" attribute that ends up in saved content unless prepare-for-save strips it.

**Suggested fix:** Track the single element whose cursor was last modified and clear it when the hover moves on; or set the cursor on the table element (or via a CSS class) instead of arbitrary event targets.

#### Host notification skipped when an empty cell is set to the default content type

`src/formatting-commands.ts:108`

applyContentType (and stampProperties at line 327-330) computes wasDifferent via getCurrentContentTypeId, which falls back to defaultCellContentTypeId for a cell with no data-content-type and no recognizable content (cell-contents.ts:101-107). An empty untyped cell therefore reports 'text' before the operation; applying content type 'text' to it excludes it from wasDifferent, yet setupContentsOfCell DOES rebuild it (existingContentType is undefined, so it does not match targetType and the template is written). The host never receives tableCellContentChanged for that cell and never wires its editor onto the freshly created contenteditable.

**Suggested fix:** Base wasDifferent on cell.dataset.contentType (raw, no default fallback) or on whether setupContentsOfCell actually rebuilt the cell (have it return that fact).

#### selection mousedown handler ignores event.button and hijacks interactive cell content

`src/selection-highlight.ts:63`

The capture-phase mousedown handler does not check event.button, so right-clicks and middle-clicks on a cell's non-editable area also get preventDefault() plus a forced focus/caret move. It also fires for ANY non-editable target inside a cell — e.g. a video with controls, an image the user wants to drag, or a nested-table structure — suppressing the native mousedown behavior for those elements. Failure scenario: middle-click-paste (Linux) into a cell's padding is swallowed; right-click's default focus behavior is replaced by a caret jump to end-of-content just before the context menu opens.

**Suggested fix:** Early-return unless event.button === 0, and consider whitelisting genuinely inert targets (cell padding) rather than intercepting every non-editable descendant.

#### Malformed edge JSON in a data attribute makes render() throw, killing the whole render

`src/table-model.ts:28`

parseJSONAttr throws on invalid JSON, and buildRenderModel calls getEdgesH/getEdgesV unguarded, so one truncated or hand-mangled data-edges-h attribute (persisted HTML is user-editable) turns every subsequent render() of that table into an exception — no sizes, spans, alignment, or backgrounds get applied at all. Structure ops that read edges (copyEdgesForInsertedRow via getEdgesV) throw too, and since the history manager catches the error after capturing state, the operation half-applies nothing but still logs a console error on every attempt.

**Suggested fix:** In the getters (or in the renderer), catch the parse failure, console.warn once, and return null so the table degrades to default borders instead of failing to render.

#### Overlay reposition misses scrolls of inner scroll containers

`src/table-size-buttons.ts:175`

window.addEventListener('scroll', scheduleOverlayReposition, {passive:true}) is non-capture, so it only fires for window scrolling — scroll events do not bubble out of inner scrollable elements. The pills and previews are positioned in viewport ('fixed') coordinates, so when the table sits inside a scrollable div (likely in the Bloom host, which has its own page panes), scrolling that container leaves the pills, delete preview and add preview stranded at their old positions. Note the paint badge already handles this correctly with capture-phase scroll (line 1432: window.addEventListener('scroll', positionPaintBadge, true)).

**Suggested fix:** Add the third argument {capture: true, passive: true} (matching the paint-badge listener) so scrolls anywhere in the document trigger a reposition.

## Refuted claims (1)

#### Undo via innerHTML replacement leaves nested tables dead (never re-attached) and leaks stale references

`src/history.ts:234` — claimed severity medium

defaultUndoOperation restores table.innerHTML, which recreates every nested .bloom-table as a fresh element. The old nested elements had been attached (history attachedTables Set, dragToResize attachedTables Set with per-element listeners, attachTextEditing listener); the new ones are attached to nothing. Failure scenario: create a table, set a cell's content type to 'table' (nested table is attachTable-ed), make one more history-tracked change, press Undo - the nested table reappears from the snapshot but drag-to-resize and Enter-handling no longer work in it, and border/size edits routed through it are refused by the history manager since neither it nor its detached ancestor registration match. Meanwhile the replaced elements stay in both attachedTables Sets forever (detachTable is never called for them; attach.ts's detachTable doesn't recurse into nested tables either), pinning detached DOM trees in memory.

The adversarial verifier could not confirm this; treat as not-a-bug unless re-established.

## Approved refactors (4)

A judge agent read the code, merged 31 proposals from the reviewers, and approved these four as
high-value, behavior-preserving, and implementable one at a time with tests staying green.
They are ordered by value and intended to run sequentially, after bug fixes.

### 1. GridView: one-pass grid model to replace per-cell DOM rescans (merges proposals 22, 2, part of 29)

**Files:** src/grid.ts (new), src/structure.ts, src/formatting-commands.ts, src/table-size-buttons.ts

Create src/grid.ts with no imports except getSpan from table-model (avoids cycles). Export: (1) cellsOf(table): HTMLElement[] — children filtered to .bloom-cell, same semantics as structure.getTableCells including the bloom-table class assert; (2) interface GridView { rows: number; cols: number; cells: HTMLElement[]; posOf: Map<HTMLElement, {row: number; column: number}>; cellAt(r, c): HTMLElement | undefined; coverAt(r, c): SpanCover | null } (move the SpanCover type here and re-export it from structure.ts); (3) buildGrid(table): GridView — single pass: parse data-column-widths/data-row-heights with the SAME tokenization as getTableInfo (split on comma, filter empty/whitespace tokens — do NOT use table-model getColumnWidths, which keeps empties), collect cells once, fill posOf by linear index math (row = floor(i/cols), col = i%cols), then build a rows×cols cover matrix in one sweep: for each non-skip cell, read getSpan once and stamp its SpanCover into every covered slot. cellAt indexes cells[r*cols+c]; coverAt indexes the matrix. Then rewire the hot paths WITHOUT changing exported signatures: (a) structure.findSpanCover(table, row, column) becomes buildGrid(table).coverAt(row, column) — verify identical results for skip cells and out-of-range positions (current version returns null when no non-skip cell covers the slot); (b) in insertLineAt, build one GridView before the per-position loop and route ops.coverAt/ops.cellAt through it (change lineAxisOps' cellAt/coverAt to take the grid, or capture the grid in a closure — the covers[] array is filled per perpendicular position, so this turns the insert from O(rows*cols^2) into O(rows*cols)); note the grid is built BEFORE any mutation, matching the existing 'collect before mutating' comment; (c) formatting-commands.getCellsInScope: build one grid, replace the per-cell getRowAndColumn try/catch with grid.posOf lookups (a cell missing from posOf is filtered out, preserving the catch-returns-false behavior); (d) table-size-buttons.getCellAt(table, r, c): replace the per-child getRowAndColumn loop with buildGrid(table).cellAt(r, c) ?? null, preserving the null-on-miss contract. Leave getRowAndColumn/getCell/getTableInfo implementations untouched — tests may match their exact assertion messages, and they are not the hot loops. Do NOT touch border-state/RenderModel caching in this session (separate follow-up). Run the full suite (183 tests) and tsc --noEmit after each of (a)-(d); structure.test.ts's span/merge/duplicate blocks are the safety net for coverAt equivalence.

### 2. Decompose table-size-buttons.ts: extract icons, widget kit, paint-format, and shared bounds-union (merges proposals 8, 23; includes 31's OverlayKind cleanup and 9's comment fix)

**Files:** src/table-size-buttons.ts, src/menu-icons.ts (new), src/menu-widgets.ts (new), src/paint-format.ts (new), src/attach.ts (unchanged via re-exports)

Conservative first-stage split moving only the parts with clean seams (~1,100 lines), keeping every existing export importable from ./table-size-buttons so attach.ts, paint-format.test.ts, proximity-gate.test.ts, and formatting-commands.test.ts are untouched. (1) src/menu-icons.ts: move all k*IconSvg constants, kIconAttr, kPaintRollerPath (lines ~62-85). Pure constants, zero risk. (2) src/menu-widgets.ts: move the stateless element factories — stylePill, makeGlyphPill, makeMenuHeader, makeDivider, setIconSlot, makeMenuItem, makeInfoNote, makeControlRow, setToggleActive, makeIconToggle, makeTextToggle, makeSampleToggle, makeNoneSample, makeBorderStyleToggle, makeBorderWeightToggle, makeCornerToggle, firstPx, makeSliderRow, makeColorInput, makeColorPairRow, plus their constants (kIconSlotPx, kItemIconColor, kNoneStroke, noneDiagonal, ColorEntry type). Verify each moved function reads NO module-level mutable state before moving (they take everything via parameters today). (3) src/paint-format.ts: move paintMode, isPaintFormatModeActive, ensurePaintFormatStyle/paintStyleInstalled, kPaintCursorUrl, makePaintFormatBadge, positionPaintBadge, onPaintPointerDown, onPaintKeyDown, enterPaintFormatMode, exitPaintFormatMode. Its only back-reference into the overlay system is the hideEdgeOverlays() call in enterPaintFormatMode — break it with an injected callback: export setPaintFormatOverlayHider(fn: () => void) (default no-op) and have table-size-buttons.ts register hideEdgeOverlays at module scope. updateProximityGate and applyAnchorPositioning switch their raw paintMode reads to isPaintFormatModeActive(). resetTableSizeButtons keeps calling exitPaintFormatMode via the import. (4) In table-size-buttons.ts, replace the two inline bounds-union copies with the existing visibleCellBounds helper: applyAnchorPositioning's inline loop (lines ~2171-2184) becomes const b = visibleCellBounds(table) with haveBounds = b !== null, and updateDeletePreviewGeometry/updateAddPreviewGeometry route through it too if their loops are verbatim equivalents (check the width/height<=0 filter matches; skip any copy that differs). (5) Re-export from table-size-buttons.ts: export { enterPaintFormatMode, exitPaintFormatMode, isPaintFormatModeActive } from './paint-format'. (6) Riding along, zero behavior change: drop the vestigial OverlayKind parameter from makeOverlay (single value, body does void kind), and fix the stale comments at old lines 151/395 claiming right-click opens all four sections (the handler passes ['cell']). Do NOT move the overlay/cluster lifecycle, menu sections, command handlers, or previews in this session — they share menuPopup/overlayTable/cluster state and are the risky 40%; leave a short module-header note naming them as the next extraction. Run vitest + tsc after each extraction step, not just at the end.

### 3. Extend lineAxisOps to removal and move: removeLineAt/moveLineAt cores, removeLast* become guarded wrappers (merges proposals 24, 1)

**Files:** src/structure.ts

Follow the file's own insertLineAt pattern (its comment: 'mirror drift has caused bugs before'). (1) Add removeLineAt(table, axis, index): void — a core reproducing the CURRENT remove*At body exactly, parameterized: collect the line's cells via getCell before mutating; span fix-up loop over all cells reducing the along-axis span when lineStart < index && lineStart + span > index — preserve the exact write semantics (setAttribute('data-span-x', String(n)) ALWAYS, even for n=1, and set/remove the --span-x CSS var only around 1); do NOT reuse writeSpan, which removes the attribute at 1 — that would change observable attributes that structure.test.ts's 'removeColumnAt reduces span' tests may assert; splice the size attribute list; removeChild the collected cells. Add per-axis fields to lineAxisOps as needed (along-span attr name, CSS var name, cell collector). Deliberately do NOT add edge-array splicing — the missing edge splice in removal is a known separate bug; this refactor is behavior-preserving. (2) removeRowAt/removeColumnAt keep their exact signatures, assert messages ('Cannot remove the only row/column', index bounds), description strings, and history wrapping; their performOperation bodies become removeLineAt calls. (3) removeLastRow/removeLastColumn keep their own guard policies unchanged (removeLastRow permits emptying the table; removeLastColumn refuses at <=1 with console.info) and their history labels, then call removeLineAt(table, axis, count-1) using getTableInfo counts. Two behavior deltas to verify against tests before committing: (a) removeLast* gains span fix-up it never had — confirm no test covers removeLast* with spans (grep structure.test.ts; the removeLastRow/removeLastColumn tests at lines 89-146 use plain tables); (b) removeLastRow's current numColumns from ''.split(',') yields 1 while getTableInfo yields 0 on an empty data-column-widths — confirm the 'does nothing if no rows exist' tests still pass. If either delta trips a test, preserve the old quirk inside the wrapper, not the core. (4) Add moveLineAt(table, axis, from, to): sizes splice; DOM reorder parameterized (row axis: splice whole R-row blocks; column axis: splice one element per row) followed by the same grid.flat().forEach(appendChild); edges via two axis-specific lambdas on lineAxisOps — travelingEdges (V arrays travel with a row; H arrays' per-row elements travel with a column) and boundaryEdges (H tops reorder keeping the final bottom fixed; V lefts reorder per row keeping the final right fixed). Preserve the existing guard asymmetry exactly (moveRowAt checks only v.length === R; moveColumnAt additionally checks per-row lengths) — do not 'fix' it here. moveRowAt/moveColumnAt keep signatures, asserts, from===to early return, and history labels. (5) Run structure.test.ts (64 references to these six functions, including the moveRowAt/moveColumnAt describe block and edge-boundary tests) plus the full suite and tsc. Expected net: structure.ts shrinks ~200-250 lines and every future axis fix lands once.

### 4. Single edge-entry decoder module shared by renderer and writers (merges proposals 10, 26 decoder part)

**Files:** src/edge-entries.ts (new), src/table-renderer.ts, src/edge-utils.ts

Create src/edge-entries.ts importing ONLY types from table-model (BorderSpec, VEdgeEntry, HEdgeEntry, HVVerticalEdgeCellSides, HVHorizontalEdgeCellSides) — no runtime imports, so both table-renderer and edge-utils can consume it with no cycle (edge-utils already imports resolveEdgeDefault from table-renderer; that stays). Export: (1) isBorderSpec(e: unknown): e is BorderSpec — the shape test currently in edge-utils.isSpec and inlined twice in table-renderer's readV/readH (weight is number, or hasOwnProperty style/color); (2) splitV(e) / splitH(e) — moved verbatim from edge-utils (spec applies to both sides; sided object preserved with ?? null; null/absent gives both null); (3) hasPositiveGap(tokens: string[], i: number): boolean — the clamped-index token parser currently triplicated as gapPositive, hasPositiveGapX, hasPositiveGapY (single value applies to all boundaries; parseFloat > 0; non-numeric token counts as positive unless '0'/'0px'); (4) entryAtV(edgesV, rows, cols, r, c) and entryAtH(edgesH, rows, cols, r, c) — the three-array-shape lookups from readV/readH (full R x (C+1) / (R+1) x C, interior-only, single-interior), returning the raw entry or undefined. Then rewire: table-renderer's readV becomes { const e = entryAtV(edgesV, rows, cols, r, c); const s = splitV(e); return { west: normalize(s.west), east: normalize(s.east) } } — normalize stays renderer-local because the writers must NOT normalize; readH likewise; hasPositiveGapX/Y become one-line wrappers over hasPositiveGap(gapX/gapY, i) (keep the wrappers — they close over the parsed gap arrays). edge-utils deletes its local isSpec/splitV/splitH/gapPositive and imports from edge-entries; applyCellPerimeter's gapPositive(gapX, c-1) calls become hasPositiveGap(gapX, c-1). Grep for any remaining inline copies (border-state.ts, table-size-buttons.ts) and route them through the module if found. Explicitly EXCLUDED: proposal 26's attach-time normalization of legacy array shapes — that changes persisted attributes and is not behavior-preserving; note it in the module header as a possible future simplification. Safety net: table-renderer.test.ts (818 lines), cell-perimeter-gap.test.ts, edge-analysis.test.ts, border-state.test.ts; run full suite + tsc. One decoder module means the writer and renderer can no longer silently disagree about the edge-entry encoding.

## Rejected / deferred refactor proposals

Rejections often carry sequencing advice (do X after refactor N lands) or reclassify the
proposal as a deliberate bug-fix/design decision; several are cheap follow-ups worth doing later.

- **Proposal 1 (removeLast* duplicate remove*At)** — Merged into approved item 3 (lineAxisOps removal/move cores).
- **Proposal 2 (findSpanCover O(n^2))** — Merged into approved item 1 (GridView).
- **Proposal 3 (span parsing in four places)** — Largely subsumed by GridView (which reads spans once via getSpan); the setCellSpan/writeSpan writer split cannot be consolidated blindly because removeColumnAt keeps data-span-x='1' while writeSpan removes it — an attribute-level behavior difference. Small residual value; do after item 1 lands.
- **Proposal 4 (eight perimeter loops in buildRenderModel)** — Valid dedupe but localized and inside the subtlest, best-tested code in the repo; lower value than the four approved. Revisit after the edge-entries module (approved item 4) lands, which shrinks the surrounding code first.
- **Proposal 5 (empty-token disagreement between getTableInfo and table-model)** — This is a latent-bug/policy question, not a behavior-preserving refactor: unifying the tokenizer changes observable counts for malformed attributes. Should be a deliberate bug fix with new tests deciding which semantics win.
- **Proposal 6 (DragToResize double history-detach)** — A real layering bug, but fixing it changes runtime behavior (who detaches history) — bug-fix track, not a refactor slot.
- **Proposals 7, 19, 31 (dead code: getColumnLeftEdge/getRowTopEdge, SelectedCellInfo, cell-contents-export)** — Pure wins but low value against four slots; recommend as a 15-minute follow-up deletion PR. Item 2's plan already folds in the OverlayKind parameter removal.
- **Proposal 9 (stale right-click menu comment)** — Two-line comment fix; folded into approved item 2's plan rather than spending a slot.
- **Proposal 11 (toOuter/toEdge triplication in border-state)** — Small local cleanup with two deliberate, undocumented behavioral differences between the copies — consolidation needs a decision about which differences are intentional. Below the cut.
- **Proposal 12 (applyCellPerimeter four side blocks)** — The tie-break/materialization logic is the subtlest in the file; parameterizing four side/axis permutations risks exactly the transposition bugs it aims to prevent, for modest line savings. Safer after item 4 gives it one decoder to lean on.
- **Proposal 13 (null vs weight-0 tri-state at the writer API)** — The typed version is an API redesign (not behavior-preserving); the docs-only version is worth doing but too small for a slot. The round-trip materialization it describes is a design bug to fix deliberately.
- **Proposal 14 (BorderValueMap dummy inner edges)** — Type redesign rippling through mixedState/selectionInit/UI components; moderate churn for a problem the showInner flag currently contains.
- **Proposals 15, 17, 30 (history: detach pruning, redo, unbounded set)** — Redo is a feature, not a refactor. Detach pruning and set pruning change observable behavior (canUndo, menu state, GC) — worthwhile designed work for a dedicated history session with new tests, not a behavior-preserving slot.
- **Proposal 16 (remote placeholder URLs in cell-contents)** — Product/asset decision (bundling a data: URI placeholder), not a refactor; behavior visibly changes. Flag to the maintainer.
- **Proposals 18, 25 (BloomTable selected-cell arithmetic duplicated 12x)** — Genuinely good and safe, but fifth on the list; it also composes better AFTER GridView lands (selectedPos can be grid.posOf plus the existing children.indexOf semantics preserved). Strong candidate for the next session.
- **Proposal 20 (RowSection/ColumnSection size-mode duplication)** — Real ~35-line duplication, but replacing the silent catch is behavior-adjacent and the payoff is small; below the cut.
- **Proposal 21 (TableSection repeated queries, CORNER_RADII)** — Trivial per-render micro-cleanup; not worth a slot.
- **Proposal 26 (edge polymorphism + attach-time normalization)** — Decoder half merged into approved item 4. The migrate-time array normalization is rejected: it rewrites persisted data-edges-* attributes, which is not behavior-preserving for hosts diffing saved HTML.
- **Proposal 27 (import cycles)** — Real but currently harmless (function-level, lazily invoked); the injection hooks add indirection without user-visible value today. Approved item 2 already introduces the callback pattern for paint-format; extend it to the remaining cycles when the full table-size-buttons split continues.
- **Proposal 28 (three size-accessor layers)** — Blocked on proposal 5's policy decision about empty-token semantics — unifying the layers without deciding that changes behavior on malformed attributes. Sequence: decide 5, then do 28 mechanically.
- **Proposal 29 (five copies of the .bloom-cell filter)** — The cellsOf helper is folded into approved item 1 (grid.ts exports it); replacing the remaining scattered copies wholesale is low value and the getTableCells console.debug removal is a (minor) behavior change.

## Test gaps (32)

From the test-coverage reviewer plus per-area reviewers. Suite at review time: 183 tests in 19
files (vitest via `pnpm test`, happy-dom/jsdom).

### High-value (9)

#### drag-to-resize.ts has zero test coverage (707 lines of core interaction logic)

`src/drag-to-resize.ts:40`

No test file touches DragToResize. Untested behaviors: (1) getResizeInfo edge detection (within 5px of a cell's bottom edge -> row resize, right edge -> column resize); (2) column drag preview writes data-column-widths and clamps at 50px minimum (updateColumnWidthPreview line 324); (3) row drag commits heights in mm via formatMm, and parseSizeToPx round-trips px<->mm; (4) the flex-center heuristic doubles deltaX when the parent is display:flex justify-content:center (line 189); (5) mouseup after >3px movement commits exactly ONE history entry whose undoOperation restores the pre-drag value and re-renders; a sub-3px wiggle commits nothing; (6) double-click on an edge sets the row/column to 'hug' as an undoable operation; (7) detach() removes the document-level mousemove/mouseup listeners only when the LAST table detaches. Test sketch: attach a 2x2 table, stub getBoundingClientRect on cells (the ProximityDiv tests already use this pattern), dispatch mousedown at the right edge of cell 0, document mousemove +40px, mouseup; assert data-column-widths[0] changed, tableHistoryManager.getLastOperationLabel() matches 'Resize Column 1', then tableHistoryManager.undo(table) and assert the original width string is back.

**Sketch:** Create src/drag-to-resize.test.ts covering edge detection, preview clamping, mm formatting for rows, one-history-entry-per-drag commit, undo restoration, dblclick auto-size, and detach listener cleanup. Consider exporting parseSizeToPx/formatMm for direct unit tests.

#### drag-to-resize.ts has zero test coverage

`src/drag-to-resize.ts:40`

There is no drag-to-resize test file at all, despite this being the most math-heavy pointer-interaction module. Untested behaviors: getResizeInfo edge thresholds (5px band on right/bottom edges, corner precedence where row wins), base-width derivation for 'hug' vs fixed px vs mm vs 'fill' originals, the Math.max(50/20) clamps, mm round-tripping (formatMm/parseSizeToPx), the flex-centered-parent delta doubling, the 3px movement threshold before hasStartedOperation, commit + undo restoring the exact original attribute value, double-click auto-size (row and column) with undo, and detach removing global listeners only when the last table detaches. All of these are unit-testable in happy-dom by dispatching mousedown/mousemove/mouseup with stubbed getBoundingClientRect, like proximity-gate.test.ts already does.

**Sketch:** Add src/drag-to-resize.test.ts covering: edge hit-testing (incl. a data-span-x cell), preview math for each original-value kind, commit/undo round-trip via tableHistoryManager, and double-click auto-size.

#### edge-utils write helpers (applyUniformOuter/Inner, applyOuterBorders, ensureEdgesArrays) have no direct tests

`src/edge-utils.ts:87`

Only applyCellPerimeter is tested (cell-perimeter-gap.test.ts). Untested: (1) ensureEdgesArrays sizes edgesV to R x (C+1) and edgesH to (R+1) x C and TRUNCATES oversized arrays with slice — the truncation path after a column/row removal is never verified, and a wrong slice would silently shift borders one cell over; (2) applyUniformOuter writes the four perimeters (H rows 0 and R, V columns 0 and C) without touching interior edges; (3) applyOuterBorders with differing top/right/bottom/left specs, including null meaning 'leave that side alone' vs style:'none' meaning force-off; (4) applyUniformInner writes only interior boundaries and its sided vs shared-spec behavior across zero vs positive gaps (the gapPositive helper, line 71, mirrors renderer logic and would drift undetected); (5) setDefaultBorder round-trip. Test sketch: build a 3x3 table via attachTable, call applyUniformOuter with {weight:2, style:'solid'}, read back getEdgesH/getEdgesV and assert exactly the 12 perimeter entries are set and the 12 interior entries untouched; then removeColumnAt and call ensureEdgesArrays and assert dimensions are (3x3+1... ) consistent with the new 3x2 grid.

**Sketch:** Create src/edge-utils.test.ts asserting the exact shape and content of the edges arrays after each writer, including the resize/truncate path after structural changes.

#### history.ts (TableHistoryManager) has no direct tests

`src/history.ts:14`

The undo engine underpinning every operation is only exercised incidentally (two undo() calls in formatting-commands.test.ts). Untested load-bearing semantics: (1) addHistoryEntry on a table NOT registered via attachTable returns WITHOUT executing performOperation (line 65-70) — callers silently no-op, which BloomTable.duplicateRowAt explicitly compensates for; (2) the 50-entry cap drops the oldest entry (line 96-98); (3) a performOperation that throws adds no history entry; (4) a failing undoOperation pushes the entry back and returns false (line 143-144); (5) undo on a detached table pushes the entry back (line 130); (6) undoLast() uses entry.table, falling back to any attached table (line 163-175); (7) findTopLevelTable resolves a nested .bloom-table to its outermost ancestor, so an edit inside a nested table snapshots and restores the TOP table's innerHTML; (8) defaultUndoOperation removes attributes added after the snapshot and restores removed ones (line 211-235); (9) operationInProgress blocks nested addHistoryEntry calls; (10) tableHistoryUpdated events fire with canUndo detail. Test sketch: reset() in beforeEach; attachTable(div); addHistoryEntry that sets an attribute; assert undo removes it; loop 55 entries and assert only 50 undos succeed; nest a .bloom-table inside a cell and assert an entry added via the inner table restores the outer table's state.

**Sketch:** Create src/history.test.ts as a pure unit suite around the exported tableHistoryManager singleton, using reset() between tests.

#### TableHistoryManager has no dedicated test file

`src/history.ts:1`

There is no history.test.ts. The only history coverage is incidental (formatting-commands.test.ts's two 'undo integration' cases and spies in cell-contents/BloomTable tests). Untested behaviors: undo against a second attached table (would have caught the cross-table corruption bug), undoLast and its fallback path, maxHistorySize trimming at 50, operationInProgress reentrancy (addHistoryEntry called from inside performOperation), performOperation throwing (partial-mutation handling), undo failure re-pushing the entry, defaultUndoOperation restoring attributes that were added/removed, tableHistoryUpdated event payloads, and clearHistory.

**Sketch:** Add src/history.test.ts covering each path; in particular a two-table test asserting undo(B) after editing A does not modify B.

#### No tests for removing a row/column that intersects a merge

`src/structure.test.ts:416`

structure.test.ts covers span reduction when the removed line is strictly inside a span whose anchor lies before it ('removeColumnAt reduces span when removing column'), but nothing tests removing the line that CONTAINS the anchor (which currently orphans skip cells), nor removeLastRow/removeLastColumn on a table with any span at all (which currently leaves data-span-y pointing past the table). Tests to write: (1) 2x2, anchor(0,0) span-x=2, removeColumnAt(0) → remaining cell must be visible (no bloom-skip) and carry no stale span; (2) 2x2, anchor(0,0) span-y=2, removeLastRow() → anchor's data-span-y must be 1 and a subsequent setCellSpan must not throw; (3) removing the last covered line of a span shrinks it by exactly one.

#### No tests that removals keep the edge arrays aligned

`src/structure.test.ts:859`

The suite thoroughly tests that INSERTS and MOVES splice data-edges-h/v ('inserted row inherits the source row's borders...', 'moveRowAt reorders... vertical edges', duplicate splice tests), but there is not a single assertion about the edge arrays after removeRowAt/removeColumnAt/removeLastRow/removeLastColumn. That asymmetry is exactly where the high-severity 'removals never splice edges' bug hides. Test to write: build a table with tagged full-size edges-h/edges-v (as the move tests do), removeRowAt(0), and assert edges-v dropped row 0's entries and edges-h has rows+1 boundary rows with the right survivors.

#### Renderer has no border tests involving merged (bloom-skip) cells

`src/table-renderer.test.ts:19`

table-renderer.test.ts exercises spans only for the CSS-variable pass ('applies span css variables per cell'); every border test uses an unmerged grid. Nothing verifies where a stroke lands when one side of a boundary is a display:none skip cell — the exact case the renderer currently gets wrong. Tests to write: (1) 2x2 with anchor(0,0) span-y=2 and default edges → the anchor's inline style must carry the bottom perimeter border (currently it lands on the hidden skip cell); (2) anchor(0,0) span-x=2 with an authored west-side spec on the boundary at c=2 → the anchor's borderRight must show it; (3) an authored edge on a boundary interior to a merge must not paint anywhere.

#### table-size-buttons menu actions and perimeter add/remove buttons untested

`src/table-size-buttons.ts:1707`

The largest file in the repo (2485 lines). Existing tests (proximity-gate.test.ts, paint-format.test.ts, prepare-for-save.test.ts) cover the proximity gate, paint-format mode, and scrubStaleAnchorNames, but the actual editing commands the buttons exist for are untested: menuAddColumn/menuAddRow (insert relative to the selected cell, line 1707/1721), menuMoveRow/menuMoveColumn (line 1733/1746), menuDuplicateRow/Column, menuMergeCell/menuSplitCell (line 1781/1793 — merge from the selected cell, split back), menuDeleteTable/menuCutTable/removeTable (line 1805-1835 — does cut write to the clipboard, does delete go through history so it can be undone?), and the perimeter cluster handlers tryInsertColumnRight/tryInsertRowBelow/tryRemoveColumn/tryRemoveRow (line 2237-2290). Test sketch: attachTable a 2x2 grid, focus a cell to select it, locate the injected overlay buttons in document.body (they carry data-overlay-group / are children of the cluster containers), dispatch click on the add-column-right button, assert data-column-widths gained an entry and cells count grew by rowCount, then tableHistoryManager.undoLast() and assert the table is back to 2x2. Same pattern for remove, move, merge/split via the pill menus (togglePillMenu -> menu item click).

**Sketch:** Add src/table-size-buttons.test.ts (or extend proximity-gate.test.ts's setup helpers) driving the injected buttons/menu items by dispatched clicks, asserting both the structural result and undoability. If DOM-driving proves brittle, export the menu* handlers for direct invocation.

### Medium-value (17)

#### Undo of structural operations is never tested (undo/redo boundary of the innerHTML snapshot)

`src/BloomTable.ts:55`

structure.ts ops are history-wrapped, but no test undoes a structural operation. The default undo path restores the whole table via innerHTML + attribute replacement (history.ts defaultUndoOperation), which is a very different code path from the targeted undoOperations and can silently lose things: cell content, data-column-widths/data-row-heights consistency, skip classes from merges, and event listeners on nested tables (innerHTML restore recreates nested .bloom-table elements that are no longer attached to dragToResize/text-editing — the exact problem attachClonedNestedTables at line 33 solves for duplication, with no equivalent on the undo path). Test sketch: 3x3 table with distinct text per cell, bt.removeRowAt(1), tableHistoryManager.undo(table), assert all 9 texts and data-row-heights are restored; merge cells via bt.setSpan then undo and assert bloom-skip classes are gone and cell count is back; undo a nested-table duplication and assert the nested table still resizes (or document the known limitation).

**Sketch:** Add an 'undo of structural ops' describe block to BloomTable.test.ts covering remove/add/merge/duplicate followed by undo, asserting content, size attributes, and skip-class restoration.

#### BloomTable selection-to-index math breaks with merged cells and is untested

`src/BloomTable.ts:63`

Every BloomTable op derives the selected cell's row/column as cellIndex % widths.length / Math.floor(cellIndex / widths.length) over Array.from(this.table.children). BloomTable.test.ts never sets .cell--selected, so all those branches run with sel === null and the focus-follow logic (focusEditableInCell targeting the new row/column at the selected column/row) is completely unexercised. Note the arithmetic is only correct while cells are direct children in strict row-major order INCLUDING skip cells; if a merge removed cells (structure.ts 2x2 merges add/remove cells) or a non-cell child exists, the derived column is wrong and addRow would copy the wrong source row. Test sketch: 3x3 table, add cell--selected to r1c2, bt.addRow(), assert the new bottom row inherited row 1's height/fill (sourceRow=1) and that the focused element is in column 2 of the new row; repeat with a merged cell earlier in the child list to pin (or expose) the index math under merges.

**Sketch:** Add tests that set .cell--selected before calling addRow/addColumn/addRowAt/removeRowAt, asserting source-row inheritance and focus target, including a variant with a merge present.

#### attach/detach/re-attach cycle untested; would expose duplicate keydown listeners

`src/attach.ts:54`

proximity-gate.test.ts calls detachTable only as teardown; no test attaches, detaches, and re-attaches the same element. attachTable calls attachTextEditing (adds a keydown listener with no guard, text-editing.ts line 6) but detachTable never removes it, and dragToResize.attach's Set guard is defeated after detach. So attach -> detach -> attach leaves TWO Enter handlers on the table; each Enter would insert two <p> elements. Also untested: detachTable makes tableHistoryManager.isAttached false so subsequent operations become silent no-ops, and attachTable on a div that already has data-column-widths must NOT add the two default columns/rows again. Test sketch: attachTable(div); detachTable(div); attachTable(div); assert column count is still 2 (no re-defaulting); dispatch an Enter keydown on a contenteditable child with a collapsed selection and assert exactly one <p> was inserted (this will likely fail today, catching a real leak).

**Sketch:** Add attach.test.ts covering re-attach idempotence, no-default-on-existing-attributes, and post-detach operation refusal. Fixing the finding likely requires attachTextEditing to keep a WeakSet guard or return a disposer.

#### attach/detach lifecycle untested: double attach, detach cleanup, nested tables

`src/attach.ts:10`

proximity-gate.test.ts calls detachTable only as teardown; nothing asserts the lifecycle contract itself: that attachTable twice on the same element is safe (it is not - duplicate keydown listeners), that detachTable actually stops drag-to-resize and history participation, that a detached table's operations are refused, that attachTable on saved content scrubs stale cell--selected/anchor names (the attach.ts:23-27 branch), or that attachTable creates the default 2x2 only when data attributes are missing. prepare-for-save.test.ts likewise covers only anchor names and selection classes - not one of the body-appended overlays it exists to strip (which is why the dead [data-overlay-group] selector went unnoticed).

**Sketch:** Add lifecycle tests: attach twice then count inserted paragraphs on Enter; attach + detach then assert no history entries accepted; extend prepare-for-save.test.ts to build the real size-button/menu/paint-badge overlays and assert document.body contains only the table afterward.

#### No tests for getCellPerimeterValueMap / getCellOwnPerimeter / getCellPerimeterColors — the read side of the edge model is untested

`src/border-state.test.ts:21`

border-state.test.ts covers only getTableOuterBorderValueMap's default resolution (two tests). cell-perimeter-gap.test.ts exercises the WRITE side (applyCellPerimeter) and asserts against the raw render model. Nothing tests the read functions the properties UI actually consumes: (a) getCellPerimeterValueMap borrowing a neighbor-owned stroke across a zero-gap boundary (the whole point of resolveCellPerimeterSpecs); (b) an explicit 'none' on the cell's own side suppressing the borrow (asserted indirectly on cellBorders in cell-perimeter-gap.test.ts:86-89 but never through the value-map API); (c) gap>0 behavior; (d) the out-of-table fallback map; (e) getCellOwnPerimeter's no-borrowing contract that copy-properties depends on (a borderless cell next to bordered neighbors must snapshot as borderless); (f) getCellPerimeterColors per-edge null fallback. Write these as round-trip tests: applyCellPerimeter then read back through each API.

**Sketch:** Add a border-state read-side suite mirroring cell-perimeter-gap.test.ts's scenarios but asserting on the three public read functions.

#### getTableOuterBorderValueMap's innerH/innerV sampling has zero test coverage

`src/border-state.test.ts:1`

Both existing tests assert only the four outer edges. The innerH/innerV sampling paths (border-state.ts:45-58) — including the one-cell-side sampling that produces the high-severity misreporting bug above, and the round trip through applyUniformInner — are never exercised. A test that (1) turns off one cell's borders, (2) reads the table map, and (3) asserts innerH still reflects the visible inner line would have caught the bug. Also untested: snapWeight bucket boundaries (1.5 -> 2, 3 -> 4, negative -> 0), through which every read passes.

**Sketch:** Add tests for inner sampling after asymmetric per-cell edits, and direct bucket tests for the weight snapping (exporting snapWeight or testing via specs with weight 3).

#### No tests for applyCellPerimeter on merged (spanning) cells or per-boundary gap tokens

`src/cell-perimeter-gap.test.ts:28`

cell-perimeter-gap.test.ts covers only 1x1 cells on uniform-gap tables. Untested: (a) a cell with data-span-x/y > 1 — the writer's span arithmetic (edge-utils.ts:251-252, rc = c+sx-1, loops over the span extent) has no coverage, and a test here would also have exposed the read/write span asymmetry reported above; (b) per-boundary gap lists like data-gap-x="0,8px" where gapPositive must pick the right token per boundary — every existing test uses a single uniform token, so the index math in gapPositive (edge-utils.ts:70-77) is never distinguished from 'first token wins'; (c) applyOuterBorders with a partial map (only `top` defined) leaving the other perimeters untouched — the undefined-skips-vs-null-clears contract at edge-utils.ts:153 is untested; (d) applyUniformOuter and setDefaultBorder have no direct tests at all.

**Sketch:** Add span round-trip tests (write via applyCellPerimeter on a merged cell, assert via buildRenderModel at the span's true boundaries), a mixed-gap-token table test, and partial applyOuterBorders tests.

#### No tests at all for the properties-UI layer outside BorderControl

`src/components/TableMenu.tsx:90`

Grepping the test suite shows the only component test is BorderControl.test.ts (plus its logic/ tests); TableMenu, CellSection, RowSection, ColumnSection, TableSection's React behavior, RadioGroup, Slider, and IconButton have zero coverage. Untested behaviors with real regression risk: (a) TableMenu's handler-to-index wiring (handleInsertRowBelow uses rowIndex+1, handleDeleteColumn uses getRowAndColumn().column — an off-by-one here would ship silently); (b) the currentCell normalization via closest('.bloom-cell') when the host passes a focused descendant; (c) the hasContext disabled state; (d) the tableHistoryUpdated listener binding to currentCell.ownerDocument for the cross-iframe case. A jsdom + @testing-library suite that renders TableMenu around a small fixture table and clicks each control would cover all of these.

**Sketch:** Add a TableMenu.test.tsx that mounts the panel with a fixture table, fires each add/remove/undo control, and asserts the resulting table structure and disabled states.

#### buildBorderMapFromTable is exported 'for testing' but has no test; Slider's anti-fight echo logic is untested

`src/components/TableSection.tsx:276`

TableSection exports buildBorderMapFromTable and applyBorderMapToTable specifically for tests, yet BorderControl.test.ts only exercises applyBorderMapToTable; the read side (corner-radius snapping to the [0,2,4,8] whitelist, innerH/innerV passthrough) is unverified, so a regression in getTableOuterBorderValueMap mapping would pass the suite. Separately, Slider.tsx lines 39-52 implement subtle controlled/uncontrolled echo logic (lastEmitted ref deciding whether to adopt a prop change) whose whole reason for existing is a race with the MutationObserver-driven re-render; a unit test should cover: drag emits value and local sticks, a genuinely external prop change (undo) is adopted, and the delayed echo of the user's own change does not snap the thumb back.

**Sketch:** Add tests for buildBorderMapFromTable round-tripping a table with mixed edges, and a Slider.test.tsx covering the three echo scenarios.

#### prepare-for-save: overlay removal and ProximityDiv wrapper cleanup untested

`src/prepare-for-save.ts:26`

prepare-for-save.test.ts has one test (anchor names + selection classes). Untested: (1) [data-overlay-group] elements are removed AND their ProximityDiv wrapper div is removed when left empty, but a wrapper that is document.body or still has children survives (removeWithProximityWrapper, line 54-61); (2) [data-table-overlay] elements (hover preview bars, delete-preview X) are removed; (3) legacy --hint-*-color inline properties are stripped from cells; (4) the crucial end-to-end property: after attachTable + interacting (which appends overlays to document.body), removeTableEditingArtifacts(document) leaves body.innerHTML free of ALL editing artifacts — this is the contract Bloom relies on when persisting body.innerHTML. Test sketch: attachTable a table, focus a cell so overlays are created, then call removeTableEditingArtifacts(document) and assert document.body contains no [data-overlay-group], no [data-table-overlay], no empty absolute-positioned wrapper divs, and no anchor-name styles anywhere.

**Sketch:** Extend prepare-for-save.test.ts with the end-to-end 'clean body after editing session' test; it doubles as a regression net for every future overlay anyone adds.

#### pulse-highlight.ts has zero test coverage

`src/pulse-highlight.ts:44`

No test exercises pulseRow/pulseColumn/pulseTableBorders/pulseCell/clearPulse. The span-aware filtering (target >= row && target < row + spanY) is exactly the kind of off-by-one logic that regresses silently, and the union-bounding-box + page-coordinate placement (scrollX/scrollY offsets at lines 68-69) is untested. Also untested: clearPulse removing all overlays before adding a new one (no accumulation), skipping zero-size cells, and the docOf ownerDocument routing.

**Sketch:** Add src/pulse-highlight.test.ts: build a table with a data-span-y=2 cell, stub cell rects, assert the overlay rect equals the union of the right cells for pulseRow/pulseColumn, and assert only one .bloom-sel-overlay exists after repeated pulses.

#### selection-highlight mousedown click-routing is untested

`src/selection-highlight.ts:26`

selection-highlight.test.ts covers only the focusin class management. The entire mousedown path is untested: clicking cell padding focuses the cell's own editable with the caret collapsed to the end; clicks inside the editable are left alone (no preventDefault); a non-text cell gets tabindex=-1 and is focused directly; ownEditable ignores a nested table's editables (the closest('.bloom-cell') === cell check). The nested-table discrimination in ownEditable is subtle and has no regression guard.

**Sketch:** Extend selection-highlight.test.ts with mousedown dispatch tests for: padding click focusing the editable, editable click not preventDefaulted, image-cell focus via tabindex, and a nested-table cell not stealing the outer cell's editable.

#### No tests for gap-list behavior across structural operations

`src/structure.test.ts:762`

data-gap-x/data-gap-y participate in border resolution per-boundary (renderer hasPositiveGapX/Y) and the module doc defines them as C-1/R-1 entry lists, yet no structure test inserts/removes/moves a line on a table that has per-boundary gaps. Writing the test (3-col table, data-gap-x="0,20px", addColumnAt(0), assert the gap still sits between the original column pair) would immediately surface the missing gap splicing and pin down the intended semantics before someone builds UI on top of it.

#### No renderer test combines merged cells (spans/skip) with border edge resolution

`src/table-renderer.test.ts:378`

The renderer suite has 23 tests: edge conflict resolution (heavier wins, tie-breaks, defaults, perimeters) is tested only on grids of ordinary 1x1 cells, and spans are tested only as CSS variables (--span-x/--span-y). Nothing verifies how borders render across a merge: for a cell with data-span-x=2, the interior V boundary it covers should not stroke through the merged cell; the skip cell must receive no border styles; and a neighbor's edge along the covered boundary must resolve against the spanning cell, not the skip placeholder. edge-utils' getSpan import (edge-utils.ts line 15) and the renderer's skip handling exist precisely for this and are unverified. Test sketch: 2x2 table, merge r0c0 across (span-x=2), set edgesV so the covered middle boundary has a spec, render, assert the spanning cell has no right-side border at the covered boundary, the skip cell has no inline border styles, and the table's outer perimeter is intact.

**Sketch:** Add a 'merged cells and edges' describe block to table-renderer.test.ts with horizontal, vertical, and 2x2 merge cases.

#### Size-button overlays' core behaviors untested: menu commands, '+' append semantics, previews, reset hygiene

`src/table-size-buttons.ts:2237`

proximity-gate.test.ts and paint-format.test.ts cover the gate, anchor scrubbing, and paint mode, but nothing tests: (a) tryInsertRowBelow/tryInsertColumnRight appending at the far edge and inheriting the last row/column's settings; (b) any menu command handler (menuAddRow/menuMoveRow/menuMergeCell/tryRemoveRow etc.) actually mutating the table via the target cell; (c) the delete/add hover previews' geometry and their hide-on-selection-loss paths; (d) menu open/close lifecycle (outside mousedown closes, Escape closes, same-pill toggle); (e) resetTableSizeButtons leaving no listeners/ProximityDiv instances behind (would have caught the leak findings). All are exercisable in happy-dom with the stubCellRects pattern already in proximity-gate.test.ts.

**Sketch:** Add a table-size-buttons.test.ts (or menu-commands.test.ts) covering the '+' append semantics, one representative menu command per category, preview geometry for a non-last-row selection (locking in the fixed behavior once the preview-mismatch bug is addressed), and a reset-then-reattach test asserting single-firing handlers and a stable ProximityDiv count.

#### text-editing.ts Enter-to-paragraph behavior untested

`src/text-editing.ts:6`

Zero coverage. Untested behaviors: (1) Enter with the event target being an HTMLDivElement prevents default and inserts <p><br></p> at the caret, replacing any selected content (range.deleteContents), and moves the caret inside the new paragraph; (2) Enter when selection.rangeCount is 0 is a no-op (returns early); (3) Enter on a non-div target (e.g. a <p> inside the editable) is deliberately ignored — is that intended? A test would pin the contract; (4) the code THROWS if window.getSelection() returns null (line 15) — worth a test documenting or motivating a guard. Test sketch: attachTextEditing(tableDiv) with a contenteditable div child, place a collapsed Range in it via document.createRange + selection.addRange, dispatch new KeyboardEvent('keydown', {key:'Enter', bubbles:true}) on the div, assert defaultPrevented and that the div now contains a <p> whose innerHTML is '<br>'.

**Sketch:** Create src/text-editing.test.ts; happy-dom supports Selection/Range well enough for this.

#### text-editing has zero tests

`src/text-editing.ts:1`

No test exercises the Enter handler at all: no test that Enter inside a contenteditable inserts a <p> and moves the caret, that Enter on a non-editable div is left alone, or that a nested-table keydown is handled exactly once. The double-paragraph nested-table bug and the non-contenteditable hijack would both have surfaced with a basic jsdom keydown-dispatch test.

**Sketch:** Add src/text-editing.test.ts dispatching KeyboardEvent('keydown', {key:'Enter', bubbles:true}) on editable and non-editable targets, including one inside a nested attached table.

### Low-value (6)

#### ProximityDiv destroy() and minOpacity option untested

`src/ProximityDiv.ts:39`

ProximityDiv.test.ts covers the opacity ramp math well, but destroy() (deregistration from globalInstances, wrapper removal) and the minOpacity constructor option (used by table-size-buttons with 0.16 and 0.6) have no coverage. A regression in destroy() directly enables the instance-leak bug reported separately.

**Sketch:** Add tests: after destroy(), a document mousemove no longer changes the child's opacity and the wrapper is out of the DOM; a minOpacity: 0.6 instance dims to 0.6, not 0.08.

#### color-utils.ts pure functions untested

`src/color-utils.ts:4`

toHexColor and representativeBorderColorHex have zero coverage despite being trivially unit-testable and feeding the color inputs in the properties panel. Cases: '#AbC' -> '#aabbcc'; 'rgb(255, 0, 128)' -> '#ff0080'; 'rgba(0,0,0,0.5)' ignores alpha; out-of-range 'rgb(300,-5,12)' clamps; garbage/undefined -> '#000000'; representativeBorderColorHex picks the first side whose style isn't 'none' and falls back to top. Note the regex /^([0-9.]+)/ family elsewhere accepts '1.2.3'; here parseFloat of an empty split segment yields NaN which hx() coerces to '00' — a test would pin that.

**Sketch:** Ten-line src/color-utils.test.ts table-driven test.

#### computeInitialSelection tie-break rules 2-4 are untested

`src/components/BorderControl/logic/selectionInit.test.ts:11`

selectionInit.test.ts covers only rule 1 (largest group) and the showInner filter. Untested: the outer-over-inner preference on ties, the contiguity score (e.g. {top,right} beating {top,bottom} at equal size), and the deterministic alphabetical fallback. The header comment marks this heuristic as an open design question (REVIEW by JH), which is exactly when pinning current behavior in tests matters — otherwise a later tweak silently changes which edges users find preselected. Also untested in the same folder: computeMixed* with an empty selection returning 'mixed' (mixedState.ts:13), a surprising sentinel worth documenting in a test.

**Sketch:** Add one test per tie-break rule with maps constructed to isolate it, plus an empty-selection test for computeMixedWeight/Style/Radius.

#### migrate.ts untested

`src/migrate.ts:1`

migrateTable's one behavior — setting tabindex=-1 on any .bloom-cell whose FIRST element child is a .bloom-table — has no test. Edge cases worth pinning: a cell whose nested table is the second child gets no tabindex (is that intended?), and a cell that already has tabindex keeps working. Since attachTable calls this on every load of saved content, a regression would silently break selection of nested-table cells. Test sketch: build a cell containing a nested .bloom-table first-child and one with text-then-table, run migrateTable, assert tabindex on the first only.

**Sketch:** Add a couple of cases to an attach.test.ts or a tiny migrate.test.ts.

#### migrate.ts has no test file

`src/migrate.ts:1`

migrateTable (sets tabindex=-1 on cells whose first element child is a nested bloom-table) is untested — there is no migrate.test.ts. It's small, but it runs against persisted user HTML, and its behavior (only firstElementChild counts; already-set tabindex preserved; throws on null) is exactly the kind of contract that silently changes during refactors. A short test file covering: nested-table cell gets tabindex=-1, plain cell untouched, table-not-first-child untouched, and null input throws, would lock it down.

#### pulse-highlight.ts untested

`src/pulse-highlight.ts:77`

clearPulse, pulseTableBorders, pulseRow, pulseColumn, pulseCell, pulseCellBorders have zero coverage. The interesting logic is target selection: pulseRow/pulseColumn must resolve the current cell's row/column and apply the pulse class to exactly those cells (and presumably handle skip cells and nested tables by scoping to the owning table), and clearPulse must remove all pulse classes including a previous pulse when a new one starts. Test sketch: 3x3 attached table, pulseRow(table, r1c1), assert exactly the three row-1 cells have bloom-pulse-* classes; pulseColumn immediately after and assert the row classes were cleared first.

**Sketch:** Small src/pulse-highlight.test.ts; cheap to write since it is pure DOM class manipulation.

## Planned fix cycle (not yet run)

The workflow's remaining phases, which failed on the session limit and still need to run:

1. **Fix bugs** — confirmed bugs grouped into disjoint per-file clusters, one fixer per cluster;
   each fixer keeps `pnpm test` and `pnpm typecheck` green and adds a regression test per fix.
2. **Refactor** — the four approved refactors, sequential, behavior-preserving.
3. **Tests** — write the missing tests above (test files only; a test exposing a production bug
   gets `test.skip` plus a comment rather than a silent code change).
4. **Final check** — full suite, typecheck, diff summary.
