// A Canvas sync that fails once is usually a blip (Canvas slow, a dropped
// connection). Try once more quietly before anyone is told anything.

export async function syncWithQuietRetry<T>(
  run: () => Promise<T>,
  opts: { waitMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  try {
    return await run();
  } catch {
    await sleep(opts.waitMs ?? 1500);
    return run();
  }
}
