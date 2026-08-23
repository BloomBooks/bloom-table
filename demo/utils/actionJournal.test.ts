import { describe, it, expect, beforeEach } from "vite-plus/test";
import {
  ActionJournal,
  JournalStorage,
  describeHistoryEvent,
  formatJournalSection,
  journalStorageKey,
  kMaxJournalEntries,
  kStartOverDescription,
  readJournal,
  recordAction,
  startOverJournal,
  clearJournal,
} from "./actionJournal";

// A localStorage stand-in, so a test can also make writing fail.
function fakeStorage(): JournalStorage & { data: Map<string, string>; failWrites?: boolean } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem(this: { failWrites?: boolean }, key: string, value: string) {
      if (this.failWrites) throw new Error("quota exceeded");
      data.set(key, value);
    },
    removeItem: (key: string) => void data.delete(key),
  };
}

const key = journalStorageKey("exercises/alphabet.html");

describe("journalStorageKey", () => {
  it("keys the journal per example, next to the attempt", () => {
    expect(key).toBe("bloom-table.journal:exercises/alphabet.html");
  });
});

describe("recordAction", () => {
  let storage: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    storage = fakeStorage();
  });

  it("appends actions oldest first and persists them", () => {
    recordAction(storage, key, { description: "Add Row at 2" }, 1000);
    recordAction(storage, key, { description: "Add Column at 1" }, 2000);
    const journal = readJournal(storage, key);
    expect(journal.entries.map((e) => e.description)).toEqual(["Add Row at 2", "Add Column at 1"]);
    expect(journal.entries.map((e) => e.timestamp)).toEqual([1000, 2000]);
    expect(journal.olderEntriesDropped).toBe(false);
  });

  it("keeps the newest entries and flags the drop once the cap is passed", () => {
    for (let i = 1; i <= 5; i++) recordAction(storage, key, { description: `Action ${i}` }, i, 3);
    const journal = readJournal(storage, key);
    expect(journal.entries.map((e) => e.description)).toEqual(["Action 3", "Action 4", "Action 5"]);
    expect(journal.olderEntriesDropped).toBe(true);
  });

  it("caps at 500 entries by default", () => {
    expect(kMaxJournalEntries).toBe(500);
    let journal: ActionJournal = { entries: [], olderEntriesDropped: false };
    for (let i = 0; i < kMaxJournalEntries + 3; i++) {
      journal = recordAction(storage, key, { description: `Action ${i}` }, i);
    }
    expect(journal.entries.length).toBe(kMaxJournalEntries);
    expect(journal.entries[0].description).toBe("Action 3");
    expect(journal.olderEntriesDropped).toBe(true);
  });

  it("does nothing when no example is selected", () => {
    const journal = recordAction(storage, null, { description: "Add Row" }, 1000);
    expect(journal.entries.length).toBe(1);
    expect(storage.data.size).toBe(0);
  });

  it("survives a storage that refuses to write", () => {
    storage.failWrites = true;
    expect(() => recordAction(storage, key, { description: "Add Row" }, 1000)).not.toThrow();
  });
});

describe("readJournal", () => {
  it("returns an empty journal for a missing or corrupt value", () => {
    const storage = fakeStorage();
    expect(readJournal(storage, key).entries).toEqual([]);
    storage.setItem(key, "{not json");
    expect(readJournal(storage, key).entries).toEqual([]);
    storage.setItem(key, JSON.stringify({ v: 1, dropped: false, entries: "nope" }));
    expect(readJournal(storage, key).entries).toEqual([]);
  });

  it("drops entries that lost their description or timestamp", () => {
    const storage = fakeStorage();
    storage.setItem(
      key,
      JSON.stringify({ v: 1, dropped: false, entries: [{ t: 1, d: "Add Row" }, { t: 2 }, {}] }),
    );
    expect(readJournal(storage, key).entries).toEqual([{ timestamp: 1, description: "Add Row" }]);
  });
});

describe("startOverJournal", () => {
  it("replaces the journal with a single Start Over marker", () => {
    const storage = fakeStorage();
    for (let i = 1; i <= 4; i++) recordAction(storage, key, { description: `Action ${i}` }, i, 2);
    expect(readJournal(storage, key).olderEntriesDropped).toBe(true);

    startOverJournal(storage, key, 9000);
    const journal = readJournal(storage, key);
    expect(journal.entries).toEqual([{ timestamp: 9000, description: kStartOverDescription }]);
    expect(journal.olderEntriesDropped).toBe(false);
  });

  it("leaves later actions after the marker", () => {
    const storage = fakeStorage();
    recordAction(storage, key, { description: "Add Row" }, 1000);
    startOverJournal(storage, key, 2000);
    recordAction(storage, key, { description: "Add Column at 1" }, 3000);
    expect(readJournal(storage, key).entries.map((e) => e.description)).toEqual([
      kStartOverDescription,
      "Add Column at 1",
    ]);
  });
});

describe("clearJournal", () => {
  it("removes the stored journal", () => {
    const storage = fakeStorage();
    recordAction(storage, key, { description: "Add Row" }, 1000);
    clearJournal(storage, key);
    expect(storage.getItem(key)).toBeNull();
  });
});

describe("describeHistoryEvent", () => {
  it("takes the operation description straight from the event", () => {
    expect(describeHistoryEvent({ operation: "Add Row" })).toEqual({
      description: "Add Row",
      detail: undefined,
    });
  });

  it("keeps the operation's detail next to the description", () => {
    expect(
      describeHistoryEvent({
        operation: "Set Corners",
        operationDetail: "radius 8, row 2 (2 cells)",
      }),
    ).toEqual({ description: "Set Corners", detail: "radius 8, row 2 (2 cells)" });
  });

  it("names an undo and a redo by the operation they act on, detail and all", () => {
    expect(
      describeHistoryEvent({ operation: "Undo Add Row", operationDetail: "at the bottom edge" }),
    ).toEqual({ description: "Undo of Add Row", detail: "at the bottom edge" });
    expect(
      describeHistoryEvent({ operation: "Redo Add Row", operationDetail: "at the bottom edge" }),
    ).toEqual({ description: "Redo of Add Row", detail: "at the bottom edge" });
  });

  it("treats an empty or non-string detail as no detail", () => {
    expect(describeHistoryEvent({ operation: "Add Row", operationDetail: "" })).toEqual({
      description: "Add Row",
      detail: undefined,
    });
    expect(describeHistoryEvent({ operation: "Add Row", operationDetail: 7 })).toEqual({
      description: "Add Row",
      detail: undefined,
    });
  });

  it("ignores the events that are bookkeeping rather than a user action", () => {
    expect(describeHistoryEvent({ operation: "Detach Table" })).toBeNull();
    expect(describeHistoryEvent({ operation: "Clear History" })).toBeNull();
  });

  it("ignores a detail with no operation", () => {
    expect(describeHistoryEvent(undefined)).toBeNull();
    expect(describeHistoryEvent({})).toBeNull();
    expect(describeHistoryEvent({ operation: "" })).toBeNull();
    expect(describeHistoryEvent("Add Row")).toBeNull();
  });
});

describe("formatJournalSection", () => {
  it("heads the section with the count and lists the actions oldest first", () => {
    const storage = fakeStorage();
    // 1970-01-01T00:00:01.500Z and 00:00:02.250Z
    recordAction(storage, key, { description: "Add Row" }, 1500);
    recordAction(storage, key, { description: "Undo of Add Row" }, 2250);
    expect(formatJournalSection(readJournal(storage, key))).toEqual([
      "## Actions since start (2)",
      "1. Add Row — 00:00:01.500",
      "2. Undo of Add Row — 00:00:02.250",
    ]);
  });

  it("writes the detail after the description, and leaves a record without one alone", () => {
    const storage = fakeStorage();
    // What the library now reports for the owner's case, and an older record
    // saved before details existed.
    recordAction(storage, key, { description: "Start Over" }, 1000);
    recordAction(
      storage,
      key,
      { description: "Set Corners", detail: "radius 8, row 2 (2 cells)" },
      1500,
    );
    recordAction(
      storage,
      key,
      { description: "Undo of Set Corners", detail: "radius 8, row 2 (2 cells)" },
      2250,
    );
    // The detail survives the round trip through storage.
    expect(readJournal(storage, key).entries.map((e) => e.detail)).toEqual([
      undefined,
      "radius 8, row 2 (2 cells)",
      "radius 8, row 2 (2 cells)",
    ]);
    expect(formatJournalSection(readJournal(storage, key))).toEqual([
      "## Actions since start (3)",
      "1. Start Over — 00:00:01.000",
      "2. Set Corners — radius 8, row 2 (2 cells) — 00:00:01.500",
      "3. Undo of Set Corners — radius 8, row 2 (2 cells) — 00:00:02.250",
    ]);
  });

  it("says so when the cap has dropped older entries", () => {
    const storage = fakeStorage();
    for (let i = 1; i <= 3; i++) recordAction(storage, key, { description: `Action ${i}` }, i, 1);
    expect(formatJournalSection(readJournal(storage, key))).toEqual([
      "## Actions since start (1)",
      "(older entries dropped)",
      "1. Action 3 — 00:00:00.003",
    ]);
  });

  it("says so when nothing has been recorded", () => {
    expect(formatJournalSection({ entries: [], olderEntriesDropped: false })).toEqual([
      "## Actions since start (0)",
      "(no actions recorded)",
    ]);
  });
});
