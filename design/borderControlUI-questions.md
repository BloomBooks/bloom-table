# Clarifying questions

## BorderSelector geometry and behavior

> Which toggles exist exactly? Top, right, bottom, left, outer-all, none/clear, inner (plus)? Any per-corner toggles in the selector, or corners are only adjusted via the Corner menu?

Buttons: Top, right, bottom, left, inner (which is in the shape of a plus because it has one horizontal and one vertical member)
no corner selection

> For multi-cell selections: does “inner” refer to interior borders between cells in a selection? If a single cell is selected, should the inner toggle be hidden/disabled?

Current cell selection is out of scope for this component. It has a prop that controls that. SEtting the prop is out of scope.

> Should there be an “outer perimeter” toggle (apply only outer edges) distinct from “all sides”?

No

> Visual spec: Selected color and unselected 50% opacity—should we use MUI theme.primary for selected and theme.text.secondary at 50% for unselected? Any preferred sizes for the control (px width/height)?

No themeing for now.
size: use image for approximation

> Applying corner radius
> When borders are selected and the user changes corner radius, which corners are affected?

How these settings are used is out of scope for this component. Its props will include all the values it needs.

> Menu option sets
> Weight choices: confirm exact set. Proposed: none(0), 1px, 2px, 4px. Any others, like 8px?

That's enough.

> Style choices: which set? Proposed: none, solid, dashed, dotted, double? If “none” is chosen here, do we also set weight to 0 or leave weight unchanged?

Let's leave it unchanged for now. But disable the style menu if "none" is chosen.

> Corner radius choices: which set? Proposed: 0, 2, 4, 8, 12 (px). Any preference for units (px only)?

0, 2px, 4px, 8px.
px is good.

> Should “none” live in weight or style (or both)? If both exist, which one determines “no border”?
> Let's go with both. If both are none, keep the style one enabled. If only one is set to none, disable the other one.

> Mixed-state rules and display
> Mixed detection: If any selected border differs from others, we show mixed. Confirm.
> Right.

> Mixed iconography: okay to render a striped/hashed representative SVG or a “~” style indicator? Any preference for label text like “Mixed” in a tooltip?

Use the word "Mixed"

> When in mixed and the user opens a menu, should the highlighted item be:
> A) No item highlighted
> B) A synthetic “mixed” header only
> C) The most common value selected by default

A

## Data model and control pattern

> Do you want a controlled component API? e.g., props: selectedEdges, onSelectionChange, borderMap (per-edge styles), onApply(change) where change includes weight/style/radius.

the props should give the weight/style/radius of every border. From that, the control have some algorithm (its own, testable method) for determining an initial selection of the borders. E.g., given a set of values in which they are all the same, every border should be selected. Given a set where there are two subsets of values, choose the larger one, etc.

## Edges granularity:

> Sides only (top/right/bottom/left) plus inner vertical+horizontal groups?
> Right

> Should the UI support read-only/disabled state?

no

> Visuals for button SVGs
> Preferred icon size (e.g., 24x24 or 32x32), stroke color from theme, and hover/active states?

Do what is best, in materialui style

> Should icons adapt to light/dark mode from MUI theme automatically?
> No

## Accessibility and interactions

> Keyboard navigation: arrow keys to move between border toggles; space/enter to toggle; Esc to close menus—acceptable?

nothing added to the material ui, just whatever it has

> Tooltips on each toggle/menu button?
> Lots of tooltips

> Tech details
> MUI version to target (v5 or v6)?
> v5

> May I add @mui/material and @mui/icons-material via pnpm?
> This is just a markdown document you're building, don't go into that much implementation detail

> Keep components in components and use TypeScript with your existing vite/vitest setup?
> Yes. Component granularity, with separate files, is key.

## Edge cases

> If selection includes borders with some “none” and some visible, mixed is shown—confirm.
> Yes

> If a user sets style=none, should weight persist but remain irrelevant, or should we coerce weight to 0 for consistency?

Answered above

> Any need to support partial transparency (RGBA) for borders or just solid colors? If color support is in scope, where is color picked?

Color for borders is not in scope at all.
