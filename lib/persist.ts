import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Durability for the in-memory store.
//
// Everything in lib/store.ts hangs off `global`, so a process restart used to
// wipe every task, plan, chat, anchor and branch. This writes a JSON snapshot
// whenever the data actually changes and reads it back on boot.
//
// Where it lands, in order:
//   1. TANGENT_DATA_DIR, if you set it
//   2. ./.tangent-data, when the working directory is writable (local dev)
//   3. os.tmpdir(), otherwise
//
// Read the caveat in SETUP.md before trusting this in production: on Vercel
// only /tmp is writable and it is per-instance and ephemeral, so this gives you
// durability across local restarts, not a real database.

const SAVE_INTERVAL_MS = 2000;

function canWrite(dir: string): boolean {
  try {
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveFile(): string | null {
  const configured = process.env.TANGENT_DATA_DIR;
  const dir =
    configured ??
    (canWrite(process.cwd())
      ? path.join(process.cwd(), ".tangent-data")
      : path.join(os.tmpdir(), "tangent-data"));
  try {
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, "store.json");
  } catch (err) {
    console.warn("[persist] no writable location, running memory-only:", (err as Error).message);
    return null;
  }
}

const FILE = resolveFile();

export function loadSnapshot(): Record<string, unknown> | null {
  if (!FILE) return null;
  try {
    if (!fs.existsSync(FILE)) return null;
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8")) as Record<string, unknown>;
    console.log(`[persist] restored from ${FILE}`);
    return parsed;
  } catch (err) {
    // A corrupt snapshot must not take the app down with it.
    console.warn("[persist] snapshot unreadable, starting fresh:", (err as Error).message);
    return null;
  }
}

function writeNow(payload: string): void {
  if (!FILE) return;
  try {
    // Write-then-rename, so a crash mid-write can't leave a half file behind.
    const tmp = `${FILE}.tmp`;
    fs.writeFileSync(tmp, payload, "utf8");
    fs.renameSync(tmp, FILE);
  } catch (err) {
    console.warn("[persist] save failed:", (err as Error).message);
  }
}

/**
 * Polls a snapshot and writes only when it differs from the last one written.
 * Polling rather than hooking every mutator: the store mutates arrays in place
 * all over the file, so there is no single write path to intercept, and the
 * data is far too small for the comparison to matter.
 */
export function startAutosave(getSnapshot: () => Record<string, unknown>): void {
  if (!FILE) return;

  const gp = global as typeof global & { __tangentPersistTimer?: NodeJS.Timeout };
  if (gp.__tangentPersistTimer) return; // survive HMR without stacking timers

  let last = "";
  try {
    last = fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8") : "";
  } catch {
    last = "";
  }

  const flush = () => {
    let next: string;
    try {
      next = JSON.stringify(getSnapshot());
    } catch (err) {
      console.warn("[persist] snapshot failed:", (err as Error).message);
      return;
    }
    if (next === last) return;
    last = next;
    writeNow(next);
  };

  const timer = setInterval(flush, SAVE_INTERVAL_MS);
  // Don't hold the process open just for the autosave.
  timer.unref?.();
  gp.__tangentPersistTimer = timer;

  for (const signal of ["beforeExit", "SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      flush();
      if (signal !== "beforeExit") process.exit(0);
    });
  }

  console.log(`[persist] autosaving to ${FILE}`);
}
