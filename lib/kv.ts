// Shared key-value storage.
//
// Replaces the old process-memory + /tmp snapshot approach, which could not work
// on Vercel: every serverless instance had its own copy of the workspace, so the
// same request could return your tasks or an empty workspace depending on which
// lambda answered it. Anything that must outlive one request goes through here.
//
// Two backends, chosen by environment:
//
//   1. Upstash Redis REST — used whenever the URL/token pair is present. Vercel
//      KV exposes the identical REST API under KV_REST_API_*, so either works.
//      Plain fetch, no SDK: one less dependency and no cold-start cost.
//   2. A local JSON file — used only when no credentials are set, so `npm run
//      dev` works offline with no setup. Single-process only; never production.
//
// A missing backend must never take the app down, so every failure degrades to
// the in-process cache and logs loudly rather than throwing at the caller.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type RedisConfig = { url: string; token: string };

function redisConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

export function backendName(): "redis" | "file" {
  return redisConfig() ? "redis" : "file";
}

// In production the file backend is never right: on Vercel only /tmp is writable
// and it belongs to one instance, which is precisely the bug this replaced. Say
// so loudly rather than quietly serving each instance its own data again.
if (process.env.NODE_ENV === "production" && !redisConfig()) {
  console.error(
    "[kv] No UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_*) " +
      "set in production. Falling back to per-instance file storage: data WILL " +
      "appear and disappear between requests. See SETUP.md."
  );
}

/** True when a real shared store is configured. Surfaced in /api/health. */
export function isShared(): boolean {
  return redisConfig() !== null;
}

// ─── Redis over REST ─────────────────────────────────────────────────────────

async function redisCommand<T>(cfg: RedisConfig, command: (string | number)[]): Promise<T> {
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Redis ${command[0]} failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { result?: T; error?: string };
  if (body.error) throw new Error(`Redis ${command[0]} error: ${body.error}`);
  return body.result as T;
}

// ─── Local file fallback ─────────────────────────────────────────────────────
// One JSON object holding every key, so the dev experience matches Redis.

function localFile(): string | null {
  const configured = process.env.TANGENT_DATA_DIR;
  let dir: string;
  if (configured) {
    dir = configured;
  } else {
    try {
      fs.accessSync(process.cwd(), fs.constants.W_OK);
      dir = path.join(process.cwd(), ".tangent-data");
    } catch {
      dir = path.join(os.tmpdir(), "tangent-data");
    }
  }
  try {
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, "kv.json");
  } catch (err) {
    console.warn("[kv] no writable location, memory only:", (err as Error).message);
    return null;
  }
}

const FILE = localFile();

function readFileMap(): Record<string, string> {
  if (!FILE) return {};
  try {
    if (!fs.existsSync(FILE)) return {};
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Record<string, string>;
  } catch (err) {
    console.warn("[kv] local store unreadable, starting empty:", (err as Error).message);
    return {};
  }
}

function writeFileMap(map: Record<string, string>): void {
  if (!FILE) return;
  // Write-then-rename: a crash mid-write can't leave a half-written file.
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(map), "utf8");
  fs.renameSync(tmp, FILE);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function kvGet(key: string): Promise<string | null> {
  const cfg = redisConfig();
  if (cfg) {
    try {
      return await redisCommand<string | null>(cfg, ["GET", key]);
    } catch (err) {
      console.error("[kv] GET failed:", (err as Error).message);
      return null;
    }
  }
  return readFileMap()[key] ?? null;
}

export async function kvSet(key: string, value: string): Promise<boolean> {
  const cfg = redisConfig();
  if (cfg) {
    try {
      await redisCommand(cfg, ["SET", key, value]);
      return true;
    } catch (err) {
      console.error("[kv] SET failed:", (err as Error).message);
      return false;
    }
  }
  try {
    const map = readFileMap();
    map[key] = value;
    writeFileMap(map);
    return true;
  } catch (err) {
    console.error("[kv] local SET failed:", (err as Error).message);
    return false;
  }
}

/** Adds to a set. Used to keep an index of workspaces for the cron jobs. */
export async function kvSetAdd(key: string, member: string): Promise<void> {
  const cfg = redisConfig();
  if (cfg) {
    try {
      await redisCommand(cfg, ["SADD", key, member]);
    } catch (err) {
      console.error("[kv] SADD failed:", (err as Error).message);
    }
    return;
  }
  try {
    const map = readFileMap();
    const members = new Set<string>(map[key] ? (JSON.parse(map[key]) as string[]) : []);
    members.add(member);
    map[key] = JSON.stringify(Array.from(members));
    writeFileMap(map);
  } catch (err) {
    console.error("[kv] local SADD failed:", (err as Error).message);
  }
}

export async function kvSetMembers(key: string): Promise<string[]> {
  const cfg = redisConfig();
  if (cfg) {
    try {
      return (await redisCommand<string[] | null>(cfg, ["SMEMBERS", key])) ?? [];
    } catch (err) {
      console.error("[kv] SMEMBERS failed:", (err as Error).message);
      return [];
    }
  }
  const raw = readFileMap()[key];
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}
