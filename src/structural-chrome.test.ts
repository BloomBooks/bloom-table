import { describe, it, expect, afterEach } from "vite-plus/test";
import { setStructuralChromeGate, structuralChromeAllowed } from "./structural-chrome";

const makeTable = (id: string): HTMLElement => {
  const table = document.createElement("div");
  table.className = "bloom-table";
  table.id = id;
  return table;
};

describe("the structural chrome gate", () => {
  // The gate is module state shared by every test in the process.
  afterEach(() => setStructuralChromeGate(undefined));

  it("allows the chrome on every table when no host installed a gate", () => {
    expect(structuralChromeAllowed(makeTable("a"))).toBe(true);
  });

  it("asks the host's gate about each table and reports its answer", () => {
    const calendar = makeTable("calendar");
    const ordinary = makeTable("ordinary");
    setStructuralChromeGate((table) => table.id !== "calendar");

    expect(structuralChromeAllowed(calendar)).toBe(false);
    expect(structuralChromeAllowed(ordinary)).toBe(true);
  });

  it("passes the table itself to the gate", () => {
    const table = makeTable("a");
    let seen: HTMLElement | null = null;
    setStructuralChromeGate((t) => {
      seen = t;
      return true;
    });

    structuralChromeAllowed(table);
    expect(seen).toBe(table);
  });

  it("replaces an installed gate with the next one", () => {
    setStructuralChromeGate(() => false);
    setStructuralChromeGate(() => true);
    expect(structuralChromeAllowed(makeTable("a"))).toBe(true);
  });

  it("allows the chrome again once the gate is removed", () => {
    setStructuralChromeGate(() => false);
    expect(structuralChromeAllowed(makeTable("a"))).toBe(false);

    setStructuralChromeGate(undefined);
    expect(structuralChromeAllowed(makeTable("a"))).toBe(true);
  });
});
