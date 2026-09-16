// Inline SVG icon constants shared by the edge-overlay buttons, the "..."
// menus, and Paint Format mode. Kept as strings (not React components) so the
// core attach path stays free of React / MUI.

// MUI "Add" glyph. fill:currentColor lets the button color drive the glyph
// color.
export const kAddIconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" style="width:18px;height:18px;display:block;fill:currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
// Inline glyphs (16px, fill:currentColor) for menu items that have no toolbar
// icon: directional move arrows, copy, and delete-table.
export const kIconAttr = `viewBox="0 0 24 24" width="16" height="16" style="width:16px;height:16px;display:block;fill:currentColor"`;
// Directional "add" glyphs: a "+" paired with the edge line the new row/column
// lands against. The "+" sits on the side the line is being added.
export const kAddRowAboveIconSvg = `<svg ${kIconAttr}><rect x="10.5" y="2" width="3" height="11" rx="0.5"/><rect x="6" y="6" width="12" height="3" rx="0.5"/><rect x="3" y="19" width="18" height="2.5" rx="1"/></svg>`;
export const kAddRowBelowIconSvg = `<svg ${kIconAttr}><rect x="3" y="2.5" width="18" height="2.5" rx="1"/><rect x="10.5" y="11" width="3" height="11" rx="0.5"/><rect x="6" y="15" width="12" height="3" rx="0.5"/></svg>`;
export const kAddColumnLeftIconSvg = `<svg ${kIconAttr}><rect x="6" y="6" width="3" height="12" rx="0.5"/><rect x="1.5" y="10.5" width="12" height="3" rx="0.5"/><rect x="19" y="3" width="2.5" height="18" rx="1"/></svg>`;
export const kAddColumnRightIconSvg = `<svg ${kIconAttr}><rect x="2.5" y="3" width="2.5" height="18" rx="1"/><rect x="15" y="6" width="3" height="12" rx="0.5"/><rect x="10.5" y="10.5" width="12" height="3" rx="0.5"/></svg>`;
export const kMoveUpIconSvg = `<svg ${kIconAttr}><path d="M12 4l-7 7h4v7h6v-7h4z"/></svg>`;
export const kMoveDownIconSvg = `<svg ${kIconAttr}><path d="M12 20l7-7h-4V6H9v7H5z"/></svg>`;
export const kMoveLeftIconSvg = `<svg ${kIconAttr}><path d="M4 12l7-7v4h7v6h-7v4z"/></svg>`;
export const kMoveRightIconSvg = `<svg ${kIconAttr}><path d="M20 12l-7-7v4H6v6h7v4z"/></svg>`;
export const kCopyIconSvg = `<svg ${kIconAttr}><path d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>`;
// MUI "ContentPaste" glyph, for Paste properties.
export const kPasteIconSvg = `<svg ${kIconAttr}><path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg>`;
export const kCutIconSvg = `<svg ${kIconAttr}><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3z"/></svg>`;
export const kTrashIconSvg = `<svg ${kIconAttr}><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
export const kInfoIconSvg = `<svg ${kIconAttr}><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`;
// MUI "FormatPaint" glyph (paint roller), for Paint format.
export const kPaintRollerPath =
  "M18 4V3c0-.55-.45-1-1-1H5c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V6h1v4H9v11c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-9h8V4z";
export const kPaintIconSvg = `<svg ${kIconAttr}><path d="${kPaintRollerPath}"/></svg>`;

// The border scope tabs' 20x20 glyphs: a cell grid whose perimeter square and
// interior cross say which edges that tab changes. The set the tab does not
// touch is drawn thin and grey, the set it does is 2px currentColor, so the
// selected tab's Bloom-blue reaches only the edges it writes.
export const kScopeAllIconSvg = `<svg width="20" height="20" viewBox="0 0 20 20" style="display:block"><rect x="3" y="3" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 3v14M3 10h14" stroke="currentColor" stroke-width="2"/></svg>`;
export const kScopeOuterIconSvg = `<svg width="20" height="20" viewBox="0 0 20 20" style="display:block"><path d="M10 3v14M3 10h14" stroke="#c9cdcf" stroke-width="1"/><rect x="3" y="3" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
export const kScopeInnerIconSvg = `<svg width="20" height="20" viewBox="0 0 20 20" style="display:block"><rect x="3" y="3" width="14" height="14" fill="none" stroke="#c9cdcf" stroke-width="1"/><path d="M10 3v14M3 10h14" stroke="currentColor" stroke-width="2"/></svg>`;
export const kScopeBrushIconSvg = `<svg width="20" height="20" viewBox="0 0 20 20" style="display:block"><path d="M13.6 2.9l3.5 3.5-7.4 7.4-3.5-3.5z" fill="currentColor"/><path d="M5.5 11.2L2.6 17.4l6.2-2.9z" fill="currentColor"/></svg>`;

// The cursor the table takes while Border Brush is loaded: the same brush,
// drawn large with a white keyline so it reads over any cell fill. The hotspot
// is the bristle tip at 3,25.
export const kBorderBrushCursorUrl = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'><path d='M19 2.5l6.5 6.5-11 11-6.5-6.5z' fill='%231d94a4' stroke='white' stroke-width='1.6'/><path d='M7.2 14.8L2.5 25.5l10.7-4.7z' fill='%2319818f' stroke='white' stroke-width='1.6'/></svg>") 3 25, crosshair`;
