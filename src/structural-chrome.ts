// Whether a table gets the chrome that changes its structure: the row and
// column clusters (each a "..." menu pill paired with a "+" add button) and the
// table menu pill.
//
// Some tables have a shape their host decides, not the user. The host lays such
// a table out against a fixed number of rows and columns, so "Add Row Below" or
// "Delete Column" would break the very thing the host maintains, and offering
// them is a trap. The library cannot tell those tables apart from ordinary ones,
// so the host tells it, once, by installing a gate.
//
// This governs the structural chrome alone. The Cell menu (right-click) is not
// affected: its commands act within one cell, so they stay useful in a table
// whose rows and columns are fixed.

let gate: ((table: HTMLElement) => boolean) | undefined;

/**
 * Install the host's answer to "does this table get the structural chrome?",
 * called with each table as its chrome is about to be shown or repositioned.
 * Pass undefined to remove a gate, after which every table gets the chrome
 * again.
 */
export function setStructuralChromeGate(
  fn: ((table: HTMLElement) => boolean) | undefined,
): void {
  gate = fn;
}

/**
 * True when `table` gets the structural chrome. Every table does until a host
 * installs a gate, so a host that never calls setStructuralChromeGate sees the
 * behaviour the library has always had.
 */
export function structuralChromeAllowed(table: HTMLElement): boolean {
  return gate ? gate(table) : true;
}
