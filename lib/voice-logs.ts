export type VoiceLogEntry = {
  at: string;
  inputText: string;
  command: unknown;
  ok: boolean;
  detail?: string;
};

const logs: VoiceLogEntry[] = [];
const MAX = 200;

export function appendVoiceLog(entry: Omit<VoiceLogEntry, "at"> & { at?: string }) {
  logs.unshift({
    at: entry.at ?? new Date().toISOString(),
    inputText: entry.inputText,
    command: entry.command,
    ok: entry.ok,
    detail: entry.detail,
  });
  if (logs.length > MAX) logs.length = MAX;
}

export function getVoiceLogs(): VoiceLogEntry[] {
  return [...logs];
}
