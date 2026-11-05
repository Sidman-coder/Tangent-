// New code ships before its migration runs. These helpers tell "that column or
// table isn't there yet" apart from a real failure, so the store can fall back
// to the old behavior instead of taking the app down.

export type SchemaErrorKind = "missing_column" | "missing_table" | null;

type PostgresLikeError = { code?: string; message?: string } | null | undefined;

/** Postgres reports 42703/42P01; PostgREST reports PGRST204/PGRST205 when its
 *  schema cache doesn't have the column or table. */
export function schemaErrorKind(err: PostgresLikeError): SchemaErrorKind {
  if (!err) return null;
  if (err.code === "42703" || err.code === "PGRST204") return "missing_column";
  if (err.code === "42P01" || err.code === "PGRST205") return "missing_table";
  const message = err.message ?? "";
  if (/column .* does not exist/i.test(message)) return "missing_column";
  if (/relation .* does not exist/i.test(message)) return "missing_table";
  return null;
}

const warned = new Set<string>();

/** One line per missing piece, in development only. Takes a fixed message, never
 *  student content. */
export function warnSchemaOnce(key: string, message: string): void {
  if (process.env.NODE_ENV !== "development" || warned.has(key)) return;
  warned.add(key);
  console.warn(`[schema] ${message}`);
}

/** How long to trust "that column isn't there" before asking again, so running
 *  the migration takes effect without a restart. */
export const SCHEMA_RECHECK_MS = 60_000;

/** Remembers missing optional columns, by name. */
export function createColumnMemo(recheckMs: number = SCHEMA_RECHECK_MS) {
  const missingSince = new Map<string, number>();
  return {
    isMissing(column: string, now: number = Date.now()): boolean {
      const since = missingSince.get(column);
      if (since === undefined) return false;
      if (now - since >= recheckMs) {
        missingSince.delete(column);
        return false;
      }
      return true;
    },
    markMissing(column: string, now: number = Date.now()): void {
      missingSince.set(column, now);
    },
  };
}
