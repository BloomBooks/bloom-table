# bloom-table

## Demo App

`pnpm dev`

## Notes

- Rendering is explicit and deterministic. The renderer reads data-\* attributes (column widths, row heights, spans, borders, corners) and applies styles.
- Call `attachTable(gridElement)` once after inserting demo HTML; it configures the renderer and triggers an initial render.
- The library styles cells, not the text inside them. Font family, size, weight, italics and text colour belong to the host — in Bloom's case to its own text styling, which is where a user already sets them. So a design this library cannot match because a letter should be large or a line italic is not a gap in the library and nothing here should grow to cover it; note it and move on.
- A host that lays some tables out itself can withhold the chrome that changes a table's structure — the row and column clusters (each a "..." pill and a "+" button) and the table menu pill — by calling `setStructuralChromeGate((table) => boolean)`. The gate is asked about each table as that chrome is about to be shown or repositioned, and refusing one leaves the rest of that table's editing untouched, the right-click Cell menu included. Bloom uses it for a calendar month grid, whose seven columns and day rows its own layout code depends on.
- The same host can filter a menu item by item, by calling `setCellMenuItemFilter((itemId, cell, table) => boolean)`. There is one menu, and this decides what it offers: the composition asks the filter about each item as it builds, and leaves out the ones the host refuses. The ids are in `cellMenuItemIds` — `contentType` (and `contentType:<type id>` for one button within that row), the Format rows `alignment`, `padding`, `fill` (the Fill picker alone), `borderColor`, `borderStyle`, `borderWeight` and `corners`, then `paintFormat` (`copyProperties` and `pasteProperties` in the Table menu) and the Cell menu's `merge` and `split`. A section whose every item is refused disappears with its divider and its header, so a filter never leaves a stray rule behind. Install no filter and every menu offers everything, as before. Write the filter as a list of what to keep: a host that names what to remove silently gains any item a later version of the library adds. Bloom allows a calendar cell only `contentType`, `contentType:text` and `contentType:image`, because Merge would leave a month short of cells and the Format section's borders fight the edges its layout writes. `borderColor`, `borderStyle` and `borderWeight` are the three rows inside the border scope group: a row of tabs — All, Outer, Inner, Border Brush — above a panel holding them, saying which edges a choice writes, where Outer and Inner are the perimeter of the selection and the boundaries between its own cells, and Border Brush loads a brush that paints one cell edge per click instead of applying anything. Refusing all three takes the tabs with them. This governs the DOM menus; the optional React `TableMenu` panel composes its own controls.
- A host that wants that same menu on a button of its own calls `openCellMenu(cell, { x, y })`, which is the path a right-click takes. It returns false while Paint Format or Border Brush mode runs, and opens nothing.
- A host that has to show a cell's items beside items of its own renders the exported React component `CellMenuItems` inside its own MUI menu. It is the component the library's own popup mounts, so there is one renderer of these items and the two menus cannot come to differ: the commands are MUI `MenuItem` rows with the library's icons, the Content Type row is its label on one line and the options below it as toggle buttons with the chosen one pressed, and a divider falls wherever the item group changes. It heads them with a "Table Cell" section heading, small, grey and upper case like the library's other section headings but starting at the left edge of the menu's content rather than at the icon gutter, so the same heading appears wherever the items do and the library's popup adds none of its own; a cell whose host filters every item away gets no heading either. The props are `cell` (the cell whose menu this is), `localize`, `closeMenu` and `renderFormatControls`. The items come already filtered by `setCellMenuItemFilter`, and each acts on the cell it was given. Labels are English, because the library does not localize; pass `localize: (englishLabel, id) => string` to supply your own wording, where `id` is the item's id, `<choice id>:<option id>` for one button of the Content Type row, or `tableCell` for the heading. `closeMenu` is called just before a command runs, so the host's menu is out of the way of whatever the command changes; choosing a content type leaves the menu open. Because the component is the menu's currency, react, react-dom, @mui/material, @mui/icons-material and @emotion/react are required peer dependencies, and a host must supply the one shared copy of React.
  - The Format rows are sliders and colour pickers, and they are still the library's own DOM widgets: the component draws them only where the host passes `renderFormatControls: (container) => void`, which the library's popup does and a host need not. A host that leaves it out gets no Format section, and gains one for free if those rows ever become part of the component.
- The right-click reaches such a host through `setCellMenuOpenHandler((cell, table, position) => boolean)`. A right-click on a cell asks the handler first; a handler that answers true has opened a menu of its own and the library opens none, and one that answers false leaves the menu to the library, as does having no handler. Bloom answers true for a picture in a calendar month grid, where the menu has to carry the image commands as well as the content type, and false everywhere else. Together with `CellMenuItems` and `openCellMenu` this gives a host both routes to one menu whose cell items come from the library.

## Releases

**Releasing is on demand — nothing publishes when you merge.** Push your work to `master`,
then run the `Release` workflow (Actions -> Release -> Run workflow) and pick `patch`,
`minor` or `major`. One click does the whole thing:

1. builds `dist/` from the current `master`
2. only if that build succeeded: bumps the version in `package.json` and commits that to
   `master`
3. publishes the immutable tag `dist-v<new version>`, holding `dist/` plus a package.json
   trimmed to entry points, exports and peer dependencies
4. writes a GitHub Release whose notes are the commit subjects since the last release

The run's summary prints the exact line to paste into Bloom. Publishing is **refused if
`dist-v<version>` already exists** — tags are immutable, so choose a larger bump or pass an
exact `version` input.

Bloom installs the tag as a GitHub dependency, because Bloom is yarn 1 and cannot build this
pnpm + vite-plus project on install:

```jsonc
// src/BloomBrowserUI/package.json
"bloom-table": "github:BloomBooks/bloom-table#dist-v1.0.1",
```

Pin the exact ref, not a semver range: the tag _is_ the version, so different Bloom branches
can hold different library builds and re-installing an unchanged ref can never change what
Bloom gets. To work against a local build instead, run `pnpm build` here and `pnpm link
bloom-table` in Bloom.

`dist/` is gitignored and lives only in those tags; `master` carries source only. This is not
on npm. See the header comment in `.github/workflows/release.yml`.
