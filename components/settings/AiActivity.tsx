"use client";

import "@/components/settings/ai-activity.css";

// Settings › AI Activity (Pipeline V2, step 3B): every request Tangent AI
// handled, what it understood, and what happened. The sibling of "What
// Tangent knows": that one is what Tangent KNOWS, this one is what it DID.
// Only rendered while TANGENT_PIPELINE_V2 is on (the API answers 404 when
// it's off). Details links elsewhere open a row with ?activity=<by>:<id>.

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import ActionReceipt from "@/components/ActionReceipt";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import Button from "@/components/ui/Button";
import {
  ACTIVITY_DAYS,
  ACTIVITY_EMPTY_TEXT,
  ACTIVITY_RESULTS,
  ACTIVITY_TYPES,
  CLEAR_CONFIRM_TEXT,
  RESULT_LABELS,
  TYPE_LABELS,
  confidenceLevel,
  formatCost,
  type ActivityDays,
  type ActivityResponse,
  type ActivityResult,
  type ActivityRow,
  type ActivityType,
} from "@/lib/ai-activity";

const STRENGTH_LABEL = { strong: "Strong", possible: "Possible", weak: "Weak" } as const;
const LEVEL_LABEL = { high: "High confidence", mid: "Some doubt", low: "Low confidence" } as const;

function when(iso: string, tz: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });
}

/** ?activity=cs:<id> (or id: / action:) from a Details link, read once. */
function focusFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const f = new URLSearchParams(window.location.search).get("activity");
  return f && /^(id|cs|action):[0-9a-f-]{36}$/i.test(f) ? f : null;
}

export default function AiActivity() {
  const { refresh } = useAppState();
  const tz = useUserTimezone();
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ActivityResult | "">("");
  const [type, setType] = useState<ActivityType | "">("");
  const [days, setDays] = useState<ActivityDays>(30);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const focusRef = useRef<string | null>(focusFromUrl());
  const viewedRef = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({ page: String(page), days: String(days) });
    if (result) params.set("result", result);
    if (type) params.set("type", type);
    if (q) params.set("q", q);
    const focus = focusRef.current;
    if (focus) params.set("focus", focus);
    if (!viewedRef.current) params.set("view", "1");
    viewedRef.current = true;
    try {
      const res = await fetch(`/api/ai-activity?${params}`, { cache: "no-store" });
      const body = (await res.json()) as ActivityResponse | { ok: false; message?: string };
      if (!res.ok || !body.ok) throw new Error(("message" in body && body.message) || "Couldn't load AI activity.");
      setData(body);
      if (focus) {
        focusRef.current = null;
        if (body.focusId) {
          setPage(body.page);
          setOpen(body.focusId);
          requestAnimationFrame(() => document.getElementById(`aia-${body.focusId}`)?.scrollIntoView({ block: "center" }));
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load AI activity.");
      setData((d) => d ?? { ok: true, rows: [], page: 1, pages: 1, total: 0, owner: false, focusId: null });
    }
  }, [page, days, result, type, q]);

  useEffect(() => {
    void load();
  }, [load]);

  // Search waits for a pause in typing.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const toggle = (id: string) => {
    const opening = open !== id;
    setOpen(opening ? id : null);
    if (opening) {
      void fetch("/api/ai-activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expanded: id }) }).catch(() => {});
    }
  };

  const remove = async (id: string) => {
    setData((d) => (d ? { ...d, rows: d.rows.filter((r) => r.id !== id), total: Math.max(0, d.total - 1) } : d));
    const res = await fetch(`/api/ai-activity/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) void load();
  };

  const clearAll = async () => {
    setClearing(true);
    const res = await fetch("/api/ai-activity", { method: "DELETE" }).catch(() => null);
    setClearing(false);
    setConfirmClear(false);
    if (!res?.ok) setError("Couldn't clear AI activity.");
    setPage(1);
    setOpen(null);
    void load();
  };

  const owner = data?.owner ?? false;
  const rows = data?.rows ?? [];
  const filtered = !!(result || type || q);
  const cols = owner ? 9 : 6;

  return (
    <section id="ai-activity" className="settings-panel">
      <div className="settings-panel-head">
        <div>
          <h2>AI Activity</h2>
          <p>
            Every request Tangent AI handled, what it understood, and what happened. For what Tangent knows about you, see{" "}
            <a href="#what-tangent-knows">What Tangent knows</a>.
          </p>
        </div>
        {rows.length > 0 && !confirmClear && (
          <div className="knows-head-actions">
            <button type="button" className="knows-secondary" onClick={() => setConfirmClear(true)}>
              Clear activity
            </button>
          </div>
        )}
      </div>

      {confirmClear && (
        <div className="aia-confirm" role="alertdialog" aria-label="Clear AI activity" aria-describedby="aia-confirm-text">
          <span id="aia-confirm-text">{CLEAR_CONFIRM_TEXT}</span>
          <Button variant="danger" size="sm" loading={clearing} loadingLabel="Clearing…" onClick={() => void clearAll()}>
            Clear activity
          </Button>
          <Button variant="quiet" size="sm" onClick={() => setConfirmClear(false)}>
            Keep it
          </Button>
        </div>
      )}

      <div className="aia-filters" role="group" aria-label="Filter AI activity">
        <select className="settings-select aia-select" aria-label="Result" value={result} onChange={(e) => (setResult(e.target.value as ActivityResult | ""), setPage(1))}>
          <option value="">Any result</option>
          {ACTIVITY_RESULTS.map((r) => (
            <option key={r} value={r}>
              {RESULT_LABELS[r]}
            </option>
          ))}
        </select>
        <select className="settings-select aia-select" aria-label="Type" value={type} onChange={(e) => (setType(e.target.value as ActivityType | ""), setPage(1))}>
          <option value="">Any type</option>
          {ACTIVITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <div className="aia-days" role="radiogroup" aria-label="Time range">
          {ACTIVITY_DAYS.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={days === d} className={days === d ? "is-on" : ""} onClick={() => (setDays(d), setPage(1))}>
              {d} days
            </button>
          ))}
        </div>
        <input type="search" className="aia-search" placeholder="Search what you asked" aria-label="Search what you asked" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error && (
        <p className="settings-status" role="alert">
          {error}
        </p>
      )}

      {data === null ? (
        <span className="settings-skeleton" aria-label="Loading" />
      ) : rows.length === 0 ? (
        <p className="knows-empty aia-empty">{filtered ? "Nothing matches these filters." : ACTIVITY_EMPTY_TEXT}</p>
      ) : (
        <>
          <table className="aia-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">You asked</th>
                <th scope="col">Tangent understood</th>
                <th scope="col">Plan</th>
                <th scope="col">Changes</th>
                <th scope="col">Result</th>
                {owner && (
                  <>
                    <th scope="col">Models</th>
                    <th scope="col">Tokens</th>
                    <th scope="col">Est. cost</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const level = confidenceLevel(r.confidence);
                const isOpen = open === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr id={`aia-${r.id}`} className={`aia-row${isOpen ? " is-open" : ""}`}>
                      <td data-label="When" className="aia-when">
                        {when(r.createdAt, tz)}
                      </td>
                      <td data-label="You asked" className="aia-asked">
                        <button type="button" className="aia-expand" aria-expanded={isOpen} aria-controls={`aia-why-${r.id}`} onClick={() => toggle(r.id)}>
                          <span>{r.request || "(no words saved)"}</span>
                          {r.source === "voice" && <span className="aia-voice">Voice</span>}
                        </button>
                      </td>
                      <td data-label="Understood">
                        <span className="aia-understood">
                          {level && <span className={`aia-dot is-${level}`} title={LEVEL_LABEL[level]} aria-label={LEVEL_LABEL[level]} role="img" />}
                          {TYPE_LABELS[r.type]}
                        </span>
                      </td>
                      <td data-label="Plan">{r.plan ?? <span className="aia-none">—</span>}</td>
                      <td data-label="Changes">{r.changes > 0 ? r.changes : <span className="aia-none">—</span>}</td>
                      <td data-label="Result">
                        <span className={`aia-chip is-${r.result}`}>{RESULT_LABELS[r.result]}</span>
                      </td>
                      {owner && (
                        <>
                          <td data-label="Models" className="aia-owner">{r.usage?.models.join(", ") || "—"}</td>
                          <td data-label="Tokens" className="aia-owner">
                            {r.usage && r.usage.inputTokens + r.usage.outputTokens > 0 ? `${r.usage.inputTokens.toLocaleString()} in · ${r.usage.outputTokens.toLocaleString()} out` : "—"}
                          </td>
                          <td data-label="Est. cost" className="aia-owner">{r.usage ? formatCost(r.usage.costUsd) : "—"}</td>
                        </>
                      )}
                    </tr>
                    {isOpen && (
                      <tr className="aia-why-row">
                        <td colSpan={cols} id={`aia-why-${r.id}`}>
                          <Why row={r} onUndone={() => void refresh().then(load)} onDelete={() => void remove(r.id)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {data.pages > 1 && (
            <nav className="aia-pages" aria-label="AI activity pages">
              <Button variant="quiet" size="sm" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>
                Newer
              </Button>
              <span>
                Page {data.page} of {data.pages}
              </span>
              <Button variant="quiet" size="sm" disabled={data.page >= data.pages} onClick={() => setPage(data.page + 1)}>
                Older
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

function Why({ row, onUndone, onDelete }: { row: ActivityRow; onUndone: () => void; onDelete: () => void }) {
  const w = row.why;
  const level = confidenceLevel(row.confidence);
  return (
    <div className="aia-why">
      <h3>Why Tangent did this</h3>
      <dl className="aia-facts">
        <div>
          <dt>Understood as</dt>
          <dd>
            {TYPE_LABELS[row.type]}
            {w.intent && <span className="aia-token">{w.intent}</span>}
          </dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{level ? `${LEVEL_LABEL[level]} (${Math.round((row.confidence ?? 0) * 100)}%)` : "Not scored"}</dd>
        </div>
        <div>
          <dt>Decided by</dt>
          <dd>{w.whoDecided}</dd>
        </div>
      </dl>

      {w.candidates.length > 0 && (
        <div className="aia-block">
          <h4>Plans it considered</h4>
          <ul>
            {w.candidates.map((c, i) => (
              <li key={i}>
                {c.title} <span className={`aia-strength is-${c.strength}`}>{STRENGTH_LABEL[c.strength]} match</span>
              </li>
            ))}
          </ul>
          {w.chosen && (
            <p>
              Chose {w.chosen}. {w.chosenHow}
            </p>
          )}
        </div>
      )}
      {w.candidates.length === 0 && w.chosen && (
        <div className="aia-block">
          <h4>Plan</h4>
          <p>
            {w.chosen}. {w.chosenHow}
          </p>
        </div>
      )}

      {w.question && (
        <div className="aia-block">
          <h4>Question and answer</h4>
          <p>Tangent asked: {w.question}</p>
          {w.answer && <p>{w.answer}</p>}
        </div>
      )}

      {w.assumptions.length > 0 && (
        <div className="aia-block">
          <h4>Assumptions</h4>
          <ul>
            {w.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {(w.changes.length > 0 || w.skippedDuplicates > 0) && (
        <div className="aia-block">
          <h4>Changes</h4>
          {w.changes.length > 0 && (
            <ul>
              {w.changes.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
          {w.skippedDuplicates > 0 && (
            <p>
              Skipped {w.skippedDuplicates} already on your calendar.
            </p>
          )}
        </div>
      )}

      <div className="aia-why-actions">
        {w.undo && <ActionReceipt actionId={w.undo.actionId} label={w.undo.label} onUndone={onUndone} />}
        {w.draftOpen && (
          <Link className="aia-link" href="/ai">
            Open draft
          </Link>
        )}
        <button type="button" className="aia-delete" onClick={onDelete}>
          Delete from log
        </button>
      </div>
    </div>
  );
}
