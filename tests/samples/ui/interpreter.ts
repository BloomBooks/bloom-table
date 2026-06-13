import type { Page, Locator } from "@playwright/test";
import type { BorderStyle, BorderWeight, Command, OuterSide } from "./dsl";

const SELECTED_FILL = "#2b6e77"; // kBloomBlue — a selected edge in the BorderSelector SVG
const OUTER: OuterSide[] = ["top", "right", "bottom", "left"];

const STYLE_LABEL: Record<BorderStyle, string> = {
  none: "None",
  solid: "Solid",
  dashed: "Dashed",
  dotted: "Dotted",
  double: "Double",
};
const WEIGHT_LABEL: Record<BorderWeight, string> = { 0: "0 (None)", 1: "1", 2: "2", 4: "4" };

/** Drives the demo UI editor harness to build a table from a recipe of DSL commands. */
export class UiInterpreter {
  private path: number[] = []; // cell-index path from the outer table into nested tables
  private focused = false;

  constructor(private page: Page) {}

  async run(commands: Command[]): Promise<void> {
    for (const cmd of commands) {
      await this.exec(cmd);
      await this.page.waitForTimeout(25);
    }
  }

  // ---- table / cell addressing -------------------------------------------------
  private curTable(): Locator {
    let loc = this.page.locator("#attempt-container > .bloom-table");
    for (const idx of this.path) {
      loc = loc
        .locator(":scope > .bloom-cell")
        .nth(idx)
        .locator(":scope > .bloom-table");
    }
    return loc;
  }

  private async colCount(): Promise<number> {
    const widths = (await this.curTable().getAttribute("data-column-widths")) || "";
    return widths ? widths.split(",").length : 0;
  }

  private async cell(r: number, c: number): Promise<Locator> {
    const cols = await this.colCount();
    return this.curTable()
      .locator(":scope > .bloom-cell")
      .nth(r * cols + c);
  }

  private async focusCell(r: number, c: number): Promise<void> {
    const cell = await this.cell(r, c);
    const editable = cell.locator(":scope > [contenteditable]");
    // Focus via .focus() rather than a click: the table's edge-overlay buttons are
    // absolutely positioned over the cells and would intercept a real click. Programmatic
    // focus still fires the `focusin` the toolbar listens for (so the menu targets this cell).
    if (await editable.count()) {
      await editable.first().evaluate((el) => (el as HTMLElement).focus());
    } else {
      await cell.click({ force: true });
    }
    this.focused = true;
    await this.page.waitForTimeout(40);
  }

  private async ensureFocus(): Promise<void> {
    if (!this.focused) await this.focusCell(0, 0);
  }

  // ---- toolbar helpers ---------------------------------------------------------
  private toolBtn(label: string): Locator {
    return this.page.locator(`button[aria-label="${label}"]:visible`).first();
  }

  private section(name: string): Locator {
    return this.page
      .locator(".table-menu div")
      .filter({ has: this.page.locator("h2", { hasText: name }) })
      .first();
  }

  private async setMenu(section: Locator, label: string, optionTitle: string): Promise<void> {
    await section.locator(`button[aria-label="${label}"]`).first().click();
    await this.page.locator(`[role="menuitemradio"][title="${optionTitle}"]`).first().click();
    await this.page.waitForTimeout(30);
  }

  private async clickRadio(section: Locator, ariaLabel: string): Promise<void> {
    await section.locator(`button[aria-label="${ariaLabel}"]`).first().click();
    await this.page.waitForTimeout(40);
  }

  private async fillInput(section: Locator, ariaLabel: string, value: string): Promise<void> {
    await section.locator(`input[aria-label="${ariaLabel}"]`).first().fill(value);
    await this.page.waitForTimeout(40);
  }

  /** Select exactly `outer` (+ optionally inner, table-level only) then apply style/weight. */
  private async setBorders(
    sectionName: "Table" | "Cell",
    outer: Set<OuterSide>,
    inner: boolean | null,
    style: BorderStyle,
    weight: BorderWeight,
  ): Promise<void> {
    const sec = this.section(sectionName);
    const svg = sec.locator('[aria-label="Border selector"]');
    for (const e of OUTER) {
      const rect = svg
        .locator("rect")
        .filter({ has: this.page.locator("title", { hasText: `Toggle ${e} border` }) });
      const selected = (await rect.getAttribute("fill")) === SELECTED_FILL;
      if (selected !== outer.has(e)) {
        await rect.click();
        await this.page.waitForTimeout(20);
      }
    }
    if (inner !== null) {
      const g = svg
        .locator("g")
        .filter({ has: this.page.locator("title", { hasText: "Toggle inner borders" }) });
      const innerSelected = (await g.locator("rect").first().getAttribute("fill")) === SELECTED_FILL;
      if (innerSelected !== inner) {
        await g.click();
        await this.page.waitForTimeout(20);
      }
    }
    await this.setMenu(sec, "Style", STYLE_LABEL[style]);
    if (style !== "none") await this.setMenu(sec, "Weight", WEIGHT_LABEL[weight]);
  }

  // ---- dispatch ----------------------------------------------------------------
  private async exec(cmd: Command): Promise<void> {
    switch (cmd.op) {
      case "selectCell":
        return this.focusCell(cmd.r, cmd.c);
      case "enter": {
        const cols = await this.colCount();
        this.path.push(cmd.r * cols + cmd.c);
        this.focused = false;
        return;
      }
      case "up":
        this.path.pop();
        this.focused = false;
        return;

      case "insertColumnLeft":
        await this.ensureFocus();
        return void (await this.toolBtn("Insert Column Left").click());
      case "insertColumnRight":
        await this.ensureFocus();
        return void (await this.toolBtn("Insert Column Right").click());
      case "insertRowAbove":
        await this.ensureFocus();
        return void (await this.toolBtn("Insert Row Above").click());
      case "insertRowBelow":
        await this.ensureFocus();
        return void (await this.toolBtn("Insert Row Below").click());
      case "deleteColumn":
        await this.ensureFocus();
        return void (await this.toolBtn("Delete Column").click());
      case "deleteRow":
        await this.ensureFocus();
        return void (await this.toolBtn("Delete Row").click());

      case "clearBorders":
        await this.ensureFocus();
        return this.setBorders("Table", new Set(OUTER), true, "none", 0);
      case "tableBorders": {
        await this.ensureFocus();
        const outer = new Set(cmd.edges.filter((e): e is OuterSide => e !== "inner"));
        const inner = cmd.edges.includes("inner");
        return this.setBorders("Table", outer, inner, cmd.style, cmd.weight);
      }
      case "cellBorders":
        await this.focusCell(cmd.r, cmd.c);
        return this.setBorders("Cell", new Set(cmd.sides), null, cmd.style, cmd.weight);

      case "align": {
        await this.focusCell(cmd.r, cmd.c);
        const label = cmd.align === "start" ? "Left" : cmd.align === "end" ? "Right" : "Center";
        return void (await this.section("Cell")
          .getByRole("button", { name: label, exact: true })
          .click());
      }

      case "columnSize":
        await this.focusCell(0, cmd.c);
        return this.clickRadio(this.section("Column"), cmd.mode === "grow" ? "Grow" : "Hug");
      case "rowSize":
        await this.focusCell(cmd.r, 0);
        return this.clickRadio(this.section("Row"), cmd.mode === "grow" ? "Grow" : "Hug");
      case "columnSizeFixed":
        await this.focusCell(0, cmd.c);
        return this.fillInput(this.section("Column"), "Column width", cmd.value);
      case "rowSizeFixed":
        await this.focusCell(cmd.r, 0);
        return this.fillInput(this.section("Row"), "Row height", cmd.value);

      case "gapX":
        await this.ensureFocus();
        return this.fillInput(this.section("Table"), "Gap X", cmd.value);
      case "gapY":
        await this.ensureFocus();
        return this.fillInput(this.section("Table"), "Gap Y", cmd.value);
      case "pad":
        await this.focusCell(cmd.r, cmd.c);
        return this.fillInput(this.section("Cell"), "Cell padding", cmd.value);

      case "tableCorners":
        await this.ensureFocus();
        return this.setMenu(this.section("Table"), "Corners", String(cmd.radius));
      case "cellCorners":
        await this.focusCell(cmd.r, cmd.c);
        return this.setMenu(this.section("Cell"), "Corners", String(cmd.radius));

      case "contentType": {
        await this.focusCell(cmd.r, cmd.c);
        const label = cmd.type === "image" ? "Image" : cmd.type === "table" ? "Table" : "Text";
        return this.clickRadio(this.section("Cell"), label);
      }
      case "merge":
        await this.focusCell(cmd.r, cmd.c);
        return void (await this.toolBtn("Merge").click());
      case "split":
        await this.focusCell(cmd.r, cmd.c);
        return void (await this.toolBtn("Split").click());

      case "type": {
        await this.focusCell(cmd.r, cmd.c);
        await this.page.keyboard.press("Control+A");
        const lines = cmd.text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (i > 0) await this.page.keyboard.press("Enter");
          await this.page.keyboard.type(lines[i]);
        }
        return;
      }
      case "image":
        // The image content type inserts a placeholder picture; src isn't user-settable and
        // the oracle records images by presence. So this is just a content-type switch.
        await this.focusCell(cmd.r, cmd.c);
        return this.clickRadio(this.section("Cell"), "Image");

      default:
        throw new Error(`UiInterpreter: command not implemented yet: ${cmd.op}`);
    }
  }
}
