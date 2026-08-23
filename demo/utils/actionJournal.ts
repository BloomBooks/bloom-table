// A running log of every table operation the user performs in the demo, kept so
// the debug snapshot can report the whole session and not only what the undo
// stack still holds. The undo stack is capped per table, drops entries whose
// table has left the DOM, and loses an entry the moment it is undone, so it is
// not a record of what the user did.
//
// This lives in the demo, not the library: it listens to the
// "tableHistoryUpdated" event that src/history.ts already dispatches and needs
// nothing from the library beyond that.

export const kMaxJournalEntries = 500;

// The marker written by startOverJournal, and the description the snapshot
// shows for it.
export const kStartOverDescription = "Start Over";

export interface JournalEntry {
  timestamp: number;
  description: string;
  // What the operation did, from the history entry: the value it wrote and the
  // cells it wrote to. Absent on a record written before details existed, and
  // on an operation whose call site knows nothing beyond its label.
  detail?: string;
}

// One action as the caller hands it over, before it gets a timestamp.
export interface JournalAction {
  description: string;
  detail?: string;
}

export interface ActionJournal {
  // Oldest first.
  entries: JournalEntry[];
  // True once the cap has thrown away at least one entry.
  olderEntriesDropped: boolean;
}

// Only the three localStorage methods the journal uses, so a test can pass a
// plain object instead of a real Storage.
export type JournalStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// The journal is keyed per example, exactly as the attempt HTML is, so
// switching examples does not mix two sessions together.
export function journalStorageKey(examplePath: string): string {
  return `bloom-table.journal:${examplePath}`;
}

const emptyJournal = (): ActionJournal => ({ entries: [], olderEntriesDropped: false });

// On-disk shape, kept short because it is rewritten on every operation.
interface StoredJournal {
  v: 1;
  dropped: boolean;
  // t: timestamp, d: description, x: detail (absent on older records).
  entries: { t: number; d: string; x?: string }[];
}

export function readJournal(storage: JournalStorage, key: string | null): ActionJournal {
  if (!key) return emptyJournal();
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return emptyJournal();
  }
  if (!raw) return emptyJournal();
  try {
    const parsed = JSON.parse(raw) as StoredJournal;
    if (!parsed || !Array.isArray(parsed.entries)) return emptyJournal();
    return {
      olderEntriesDropped: !!parsed.dropped,
      entries: parsed.entries
        .filter((e) => e && typeof e.d === "string" && typeof e.t === "number")
        .map((e) => ({
          timestamp: e.t,
          description: e.d,
          ...(typeof e.x === "string" && e.x.length > 0 ? { detail: e.x } : {}),
        })),
    };
  } catch {
    // A corrupt value is worth losing; the alternative is a broken button.
    return emptyJournal();
  }
}

export function writeJournal(
  storage: JournalStorage,
  key: string | null,
  journal: ActionJournal,
): void {
  if (!key) return;
  const stored: StoredJournal = {
    v: 1,
    dropped: journal.olderEntriesDropped,
    entries: journal.entries.map((e) => ({
      t: e.timestamp,
      d: e.description,
      ...(e.detail ? { x: e.detail } : {}),
    })),
  };
  try {
    storage.setItem(key, JSON.stringify(stored));
  } catch {
    // A full or blocked localStorage must not stop the user from editing.
  }
}

// Append one action and save. Returns the journal as it now stands.
export function recordAction(
  storage: JournalStorage,
  key: string | null,
  action: JournalAction,
  timestamp: number,
  maxEntries: number = kMaxJournalEntries,
): ActionJournal {
  const journal = readJournal(storage, key);
  journal.entries.push({ timestamp, ...action });
  if (journal.entries.length > maxEntries) {
    journal.entries.splice(0, journal.entries.length - maxEntries);
    journal.olderEntriesDropped = true;
  }
  writeJournal(storage, key, journal);
  return journal;
}

// "Start Over" throws away the attempt, so it throws away the journal too. The
// new journal opens with a marker, so a later snapshot says where the session
// restarted.
export function startOverJournal(
  storage: JournalStorage,
  key: string | null,
  timestamp: number,
): ActionJournal {
  const journal: ActionJournal = {
    entries: [{ timestamp, description: kStartOverDescription }],
    olderEntriesDropped: false,
  };
  writeJournal(storage, key, journal);
  return journal;
}

export function clearJournal(storage: JournalStorage, key: string | null): void {
  if (!key) return;
  try {
    storage.removeItem(key);
  } catch {}
}

// Turn one "tableHistoryUpdated" event detail into the line the journal keeps.
// Returns null for the events that are bookkeeping rather than a user action:
// the demo detaches and re-attaches tables whenever it re-injects the attempt
// HTML, and those events say nothing about what the user did.
export function describeHistoryEvent(eventDetail: unknown): JournalAction | null {
  if (!eventDetail || typeof eventDetail !== "object") return null;
  const source = eventDetail as { operation?: unknown; operationDetail?: unknown };
  const operation = source.operation;
  if (typeof operation !== "string" || operation.length === 0) return null;
  if (operation === "Detach Table" || operation === "Clear History") return null;
  // The event carries the history entry's own detail, undo and redo included.
  const detail =
    typeof source.operationDetail === "string" && source.operationDetail.length > 0
      ? source.operationDetail
      : undefined;
  // history.ts reports an undo as "Undo <label>" and a redo as "Redo <label>".
  const undone = /^Undo (.+)$/.exec(operation);
  if (undone) return { description: `Undo of ${undone[1]}`, detail };
  const redone = /^Redo (.+)$/.exec(operation);
  if (redone) return { description: `Redo of ${redone[1]}`, detail };
  return { description: operation, detail };
}

const timeOfDay = (timestamp: number) => new Date(timestamp).toISOString().slice(11, 23);

// The "## Actions since start" section of the debug snapshot, oldest first.
export function formatJournalSection(journal: ActionJournal): string[] {
  const lines: string[] = [];
  lines.push(`## Actions since start (${journal.entries.length})`);
  if (journal.olderEntriesDropped) lines.push("(older entries dropped)");
  if (journal.entries.length === 0) {
    lines.push("(no actions recorded)");
    return lines;
  }
  journal.entries.forEach((e, i) => {
    const what = e.detail ? `${e.description} — ${e.detail}` : e.description;
    lines.push(`${i + 1}. ${what} — ${timeOfDay(e.timestamp)}`);
  });
  return lines;
}
