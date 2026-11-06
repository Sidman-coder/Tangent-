# Tangent v3 Round 2: plan for approval

Status: approved 2026-11-04. All recommendations accepted.
Branch: `v3-core-loop`. Audit: [2026-11-ui-audit.md](../audits/2026-11-ui-audit.md), commit `3d57c48`.
Measured baseline: 482 tests pass, `npm run build` passes. Phase 3.1 commit to restore from: `9a5c954`.

## 1. Decisions needed from you

Approving the plan accepts every recommendation below. Reply with a number to change one.

| # | Decision | Why it can't just follow the prompt | Recommendation |
|---|---|---|---|
| 1 | **Name of the task kind column** | `tasks.kind` already exists with `school, academic-ec, side-ec, personal, commitment`, and capacity, undo, ChangeSets and filters all read it. The prompt's check constraint would fail on existing rows, and `add column if not exists` would silently do nothing. | New column `commitment_type`, TS type `TaskCommitment`, field `task.commitment`. Keep the prompt's function names (`classifyTaskKind`, `groupTodayTasks`). The old `kind` stays. |
| 2 | **Which page is Home** | `/` is Juann's bare capture screen. `/today` is the screen you describe in Phase A. Both have a mic and a list. | Today moves to `/`. The capture screen moves to `/capture` unchanged. `/today` redirects to `/`, `/?capture=1` redirects to `/capture`, and the phone mic still opens it. |
| 3 | **Overdue pile-up** | "Overdue items from earlier days stay until done or dismissed" would put every past imported calendar event and old Canvas item in red at the top of Must do. A dentist visit from last week can't be done late. The prompt also defines no Dismiss control. | Past imported calendar events don't count as overdue. Reminders and Canvas items from earlier days do, showing the newest 3 and a "+N older" line. Overdue rows get a small Dismiss action with Undo, stored in a new `tasks.overdue_dismissed_at`. |
| 4 | **Delete my data** (ground rule 8) | `/api/reset` exists, but `resetUserData` leaves `change_sets` and `ai_decisions` (both hold the student's request text), plus `events` and `ai_usage`. It keeps the login. Students cannot delete `events` rows. | Reuse the route and add `change_sets`, `ai_decisions` and `context_slots`. Keep `events` and `ai_usage` because they hold no student text, and say so in the "what we store" note. Don't delete the login in this round. I won't run it; you test it on a test account. |
| 5 | **Password reset link** (ground rule 8) | Reset emails land on `/settings?reset=1#security`, and E.1 moves that page. | Point new emails at `/settings/security?reset=1` and keep a client redirect for links already sent. No other auth code changes. You test it with real email. |
| 6 | **How I verify signed-in behavior** | The dev, preview and production apps share one Supabase project, sign-in is invite-only, and I must not enter your credentials or create accounts there. Ground rule 9 asks me to run every touched screen. | I verify UI on `/dev/app/*` sample routes, extended to cover new screens with a mocked API, and report what that can't prove. Real saves, sign-in and email go on your manual test list. |
| 7 | **May I test the SQL on a throwaway database?** | "Never run migrations yourself" is about your database. A broken migration is expensive to find later. | Yes: run all migrations, old and new, in an in-memory Postgres (PGlite) from the scratchpad, on empty and seeded data. It doesn't connect to Supabase and adds nothing to the repo. If you say no, the SQL ships unexecuted and I'll say so. |
| 8 | **Project link on chats** | `chat_sessions.plan_id` already exists, and the old ProjectChat used it. Adding `project_id` means two columns for one fact. | Reuse `plan_id`: add the foreign key and clear links to deleted projects. Scope, `task_id` and `summary` are added as you specified. |

Smaller choices I'll make unless you object are in section 12.

## 2. Audit summary

The full list is in the audit: 1 Critical, 11 High, 21 Medium, 13 Low.

| ID | Finding | Fixed in |
|---|---|---|
| **C1 Critical** | Sign-in and invite-only pages are unreadable in dark theme (hard-coded white card) | G, recommended first (section 11) |
| H1 | Today fails the 3-second rule | A |
| H2 | No `error.tsx`, `global-error.tsx` or `loading.tsx` anywhere | G |
| H3 | Muted text fails AA in light theme (3.2–3.5:1) | G tokens, recommended first |
| H4 | Primary button labels fail AA in dark theme (`liquid-glass.css` forces white) | G, recommended first |
| H5 | Controls under 44px (send button, toggles, checks, chips, arrows, rail) | A, D, E, G |
| H6 | `window.confirm` in Settings and Security | E |
| H7 | `viewport-fit=cover` missing, so safe areas don't apply | G |
| H8 | Bottom nav labels are 9px at 3.4:1 | G |
| H9 | Project page: "Add more above" with nothing above, delete has no error handling, blank while loading | D |
| H10 | Student-facing errors name `ANTHROPIC_API_KEY` | D, G |
| H11 | Invite-only explanation sits below the fold on phones | G |
| M1–M5, M17, M21, L5 | Two mics, chip clutter, three "Ask" flows, nested cards, browser timezone in dates, type sizes, placeholder copy, `composerInView` polling | A |
| M18 | No stored week start | B |
| M7, M9–M11, L9 | School stats order, plan vs project naming, three AI names, `/api/sessions` raw errors, stale comment | D, F.1, G |
| M16, M19 | Settings layout, incomplete export | E |
| M8, L10 | Approximate pace, stale model names in docs | F |
| M6, M12–M15, M20, L2, L4, L6–L8, L12 | Everything else | G, or Known issues with a reason |
| L1, L3, L11, L13 | `/path` and `/tangents`, OS theme, event tampering, entrance opacity | Known issues. `/tangents` is a decision for you at the end. |

## 3. Migrations, in order

All use the existing style: `begin; … commit;`, idempotent, and `to authenticated using (user_id = (select auth.uid()))`. You run them; the code works before they run.

**Missing-schema fallback (ground rule 3).** Adding a column to `TASK_COLUMNS` would break every task read until the migration runs. So `lib/schema-compat.ts` classifies errors, and the store retries once without the optional columns and strips them from writes. It re-checks every 60 seconds, so running a migration takes effect without a redeploy. The prompt names `42703` and `42P01`, but PostgREST also returns `PGRST204` and `PGRST205` for these cases, so all four are handled. It warns once, in development only.

### 1. `20261104000000_task_commitment_type.sql` (Phase A)

```sql
begin;
alter table public.tasks add column if not exists commitment_type text;
alter table public.tasks add column if not exists overdue_dismissed_at timestamptz;
alter table public.tasks drop constraint if exists tasks_commitment_type_check;
alter table public.tasks add constraint tasks_commitment_type_check
  check (commitment_type is null or commitment_type in ('fixed','reminder','flexible'));
create index if not exists tasks_user_commitment_type_idx
  on public.tasks (user_id, commitment_type);

update public.tasks set commitment_type = case
  when source = 'canvas' then 'fixed'
  when notes ~ '(^|· )From [^·]+$' then 'fixed'      -- calendar imports have no source marker
  when kind = 'commitment' then 'fixed'
  when plan_id is null and time <> '' and title ~*
    '\m(appointment|class|practice at|meeting|game|lesson|dentist|doctor|exam|test at)\M' then 'fixed'
  when plan_id is null
    and array_length(regexp_split_to_array(btrim(title), '\s+'), 1) <= 6
    and title ~* '\m(call|email|text|turn in|bring|pay|remind|submit|sign)\M' then 'reminder'
  else 'flexible'
end
where commitment_type is null and completed = false;
commit;
```

Three deviations from the prompt's backfill:
- Project steps never become `fixed` from their title (section 10, item 1).
- `kind='commitment'` maps to `fixed`, because students already marked those as commitments.
- Finished tasks are skipped. `tasks` has an `updated_at` trigger, so updating them would overwrite the time F.1 falls back on. Rows left null are classified by rules when read.

### 2. `20261104010000_project_color.sql` (Phase A)

`plans.color` already exists and is `not null`, so this only remaps values.

```sql
begin;
alter table public.plans add column if not exists color text;
with palette as (
  select array['violet','teal','rose','blue','amber','green','magenta','indigo','orange','cyan'] as keys
), ordered as (
  select p.id,
         row_number() over (partition by p.user_id order by p.created_at, p.id) as n
  from public.plans p, palette
  where not (p.color = any (palette.keys))
)
update public.plans p
   set color = palette.keys[((o.n - 1) % 10) + 1]
  from ordered o, palette
 where p.id = o.id;
commit;
```

From an empty start, round-robin gives the same sequence as `assignProjectColor`, and a test asserts that. Old hex values also map correctly when read, so this migration is optional for the app to work.

### 3. `20261104020000_profile_week_start.sql` (Phase B)

```sql
begin;
alter table public.profiles add column if not exists week_start smallint not null default 0;
alter table public.profiles drop constraint if exists profiles_week_start_check;
alter table public.profiles add constraint profiles_week_start_check check (week_start in (0, 1, 6));
commit;
```

### 4. `20261104030000_context_slots.sql` (Phase C)

`context_entries` has only `category`, `fact` and `source`, so it can't hold structured, project-linked values. A new table is needed.

```sql
begin;
create table if not exists public.context_slots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_id  uuid,
  slot_key    text not null check (slot_key ~ '^[a-zA-Z]{1,32}$'),
  value       jsonb not null,
  source      text not null check (source in ('answer','inferred','default','known')),
  updated_at  timestamptz not null default now(),
  foreign key (project_id, user_id) references public.plans (id, user_id) on delete cascade
);
alter table public.context_slots drop constraint if exists context_slots_one_per_slot;
alter table public.context_slots add constraint context_slots_one_per_slot
  unique nulls not distinct (user_id, project_id, slot_key);
create index if not exists context_slots_user_project_idx on public.context_slots (user_id, project_id);
alter table public.context_slots enable row level security;
-- four policies "own rows: select/insert/update/delete", drop-then-create
commit;
```

Deviation: the prompt asks for a unique index on `coalesce(project_id, …)`. The Supabase client can't target an expression index in an upsert. `unique nulls not distinct` gives the same guarantee and allows a one-call atomic upsert. The schema already uses a Postgres 15 feature (`on delete set null (col)`), so this is available.

### 5. `20261104040000_chat_scope.sql` (Phase D)

```sql
begin;
alter table public.chat_sessions add column if not exists task_id uuid;
alter table public.chat_sessions add column if not exists scope text not null default 'general';
alter table public.chat_sessions add column if not exists summary text;
alter table public.chat_sessions drop constraint if exists chat_sessions_scope_check;
alter table public.chat_sessions add constraint chat_sessions_scope_check
  check (scope in ('general','task','project'));

-- Clears links to already-deleted projects. No chat content changes.
-- The updated_at trigger is paused so these chats don't jump to the top of the library.
alter table public.chat_sessions disable trigger chat_sessions_set_updated_at;
update public.chat_sessions c set plan_id = null
 where c.plan_id is not null and not exists (
   select 1 from public.plans p where p.id = c.plan_id and p.user_id = c.user_id);
alter table public.chat_sessions enable trigger chat_sessions_set_updated_at;

alter table public.chat_sessions drop constraint if exists chat_sessions_task_fk;
alter table public.chat_sessions add constraint chat_sessions_task_fk
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete set null (task_id);
alter table public.chat_sessions drop constraint if exists chat_sessions_plan_fk;
alter table public.chat_sessions add constraint chat_sessions_plan_fk
  foreign key (plan_id, user_id) references public.plans (id, user_id) on delete set null (plan_id);

create index if not exists chat_sessions_user_scope_idx on public.chat_sessions (user_id, scope);
create index if not exists chat_sessions_user_task_idx on public.chat_sessions (user_id, task_id);
create index if not exists chat_sessions_user_plan_idx on public.chat_sessions (user_id, plan_id);
-- One continuing thread per task and per project
create unique index if not exists chat_sessions_one_task_thread
  on public.chat_sessions (user_id, task_id) where scope = 'task' and task_id is not null;
create unique index if not exists chat_sessions_one_project_thread
  on public.chat_sessions (user_id, plan_id) where scope = 'project' and plan_id is not null;
commit;
```

The `default 'general'` is the backfill. The first time a project chat opens, it adopts that project's newest linked session, which is how the old ProjectChat found its thread, so old project conversations come back. The first time a task chat opens, it copies that task's `task_chat_messages` into the new thread. The old rows stay.

### 6. `20261104050000_profile_notification_prefs.sql` (Phase E)

```sql
begin;
alter table public.profiles add column if not exists notification_prefs jsonb not null default '{}'::jsonb;
alter table public.profiles drop constraint if exists profiles_notification_prefs_check;
alter table public.profiles add constraint profiles_notification_prefs_check
  check (jsonb_typeof(notification_prefs) = 'object');
commit;
```

### 7. `20261104060000_task_completed_at.sql` (Phase F)

```sql
begin;
alter table public.tasks add column if not exists completed_at timestamptz;
create index if not exists tasks_user_completed_at_idx on public.tasks (user_id, completed_at);
commit;
```

No RLS changes are needed for the altered tables; they already have it. If a phase lands on a later date, the filename uses that date.

## 4. Phase A: Today, task kinds, colors, spacing

### Wireframes

**Today, phone (390px)**

```
┌──────────────────────────────────────┐
│ Good afternoon, Juann       [≡ Filter•]│  • = filter active
│ ┌──────────────────────────────────┐ │
│ │ (mic)  Type or say anything… (send)│ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ 3 must-dos · next: Dentist at     │ │  slide, max 120px
│ │ 3:30 PM · 2 plan steps left       │ │
│ └──────────────────────────────────┘ │
│                 ● ○ ○                │
│                                      │
│ MUST DO  3                           │
│ ▌Turn in permission form    [Done]   │  overdue: red stripe
│ ▌Overdue · was Mon, Nov 3   Dismiss  │
│ ▌Dentist appointment        [Done]   │
│ ▌Tue, Nov 4 · 3:30 PM                │
│ ▌Bring lab goggles          [Done]   │
│ ▌Tue, Nov 4 · Anytime                │
│                                      │
│ ┌─ TODAY'S PLAN  2 ── soft shading ┐ │
│ │▌APUSH: read ch. 12 notes  [Done] │ │
│ │▌Tue, Nov 4 · 4:30 PM · APUSH     │ │
│ │▌         Not today · Too big     │ │
│ │▌SAT vocab set 3           [Done] │ │
│ │▌Planned for Mon, Nov 3 (amber)   │ │
│ │▌         Not today · Too big     │ │
│ └──────────────────────────────────┘ │
│                                      │
│ COMING UP  5                      ▸  │  collapsed
├──────────────────────────────────────┤
│ Today Calendar Projects Chats Settings│  labels fixed in G
└──────────────────────────────────────┘
```

**Today, desktop (1440px)**

```
┌────┬───────────────────────────────────────────────────────────┐
│ T  │  Good afternoon, Juann                          [≡ Filter]│
│    │  ┌─────────────────────────────────────────────────────┐  │
│ ⌂  │  │ (mic)  Type or say anything…                  (send)│  │
│ ▦  │  └─────────────────────────────────────────────────────┘  │
│ ▤  │  [‹] 3 must-dos · next: Dentist at 3:30 PM · 2 left  [›]   │
│ 💬 │                         ● ○ ○                             │
│ ⚙  │                                                           │
│    │  MUST DO  3                                               │
│    │  ▌Turn in permission form   Overdue · was Mon, Nov 3      │
│    │  ▌                                        Dismiss  [Done] │
│    │  ▌Dentist appointment       Tue, Nov 4 · 3:30 PM   [Done] │
│    │                                                           │
│    │  ░ TODAY'S PLAN  2 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│    │  ░▌APUSH: read ch. 12   Tue, Nov 4 · 4:30 PM · APUSH     ░ │
│    │  ░▌                        Not today · Too big   [Done]  ░ │
│    │                                                           │
│    │  COMING UP  5  ▸                                          │
└────┴───────────────────────────────────────────────────────────┘
Content stays one centered column, max about 720px.
```

**Top slider, each slide**

```
Slide 1, Today at a glance (tap scrolls to Must do)
┌────────────────────────────────────────────────┐
│ 3 must-dos · next: Dentist at 3:30 PM · 2 plan │
│ steps left                                     │
└────────────────────────────────────────────────┘    ● ○ ○

Slide 2, Send to
┌────────────────────────────────────────────────┐
│ Send to   [ Auto | Calendar | Project ]        │
│ ●Robotics  ●APUSH  ●SAT prep  ●College ess… →  │  only when Project is on
└────────────────────────────────────────────────┘    ○ ● ○

Input row while a destination is set, so it stays visible on any slide:
│ (mic) [→ Robotics ×] Type or say anything… (send)│

Slide 3, From Tangent (hidden when empty, leaving 2 dots)
┌────────────────────────────────────────────────┐
│ 2 questions to improve your plans     [Answer] │
│ Finish setting up (2 left)              [Open] │
└────────────────────────────────────────────────┘    ○ ○ ●
```

### Files

**Create**
- `lib/task-when.ts`, `.test.ts`: date and time format
- `lib/task-kind.ts`, `.test.ts`: classification rules, 20+ examples
- `lib/task-kind-ai.ts`: Haiku fallback and cache, server only
- `lib/today-sections.ts`, `.test.ts`: grouping and overdue
- `lib/schema-compat.ts`, `.test.ts`: missing-schema detection
- `components/today/TodaySections.tsx`, `TodaySlider.tsx`, `TodayInput.tsx`, `TodayFilter.tsx`, `today.css`
- `components/projects/ColorPicker.tsx`
- The two migrations above

**Change**
- `lib/types.ts`, `lib/store.ts` (columns, fallback, `brandColor`/`PLAN_COLORS` replaced), `lib/task-colors.ts` + tests, `lib/load.ts`, `lib/spacing.ts`, `lib/schedule-slots.ts`, `lib/preview-week.ts`
- `lib/pipeline/changeset.ts`, `apply-core.ts`, `undo-core.ts`, `draft.ts`, `understand.ts`, `lib/ai/router.ts`, `lib/ai/models.ts`
- `app/api/tasks/route.ts`, `app/api/chat/route.ts`, `app/api/today/route.ts`, `app/(app)/page.tsx`, `app/(app)/today/page.tsx`, `app/manifest.ts`
- `components/ui/TaskRow.tsx`, `components/TaskDetail.tsx`, `components/AppShell.tsx`, `components/capture/CaptureMic.tsx`, `CaptureHome.tsx`, `components/add/AddFlow.tsx`, `components/PreviewCard.tsx`, `components/FeatureTour.tsx`, `components/settings/CalendarImport.tsx`
- Calendar, Projects, School card and chat library color call sites; `app/(app)/calendar/*`, `components/projects/ProjectStats.tsx`, `lib/dev/sample-state.ts`, `app/globals.css`, `docs/MANUAL-STEPS.md`

**Move:** `CaptureHome` moves to `app/(app)/capture/page.tsx`.

**Delete, if nothing still uses them:** `components/dashboard/TodayCard.tsx`, `TodayStep.tsx`, `lib/today-steps.ts`. Their behavior moves to the new sections first: optimistic overrides, receipts, Not today, split, Fresh start, once-a-day replan.

### Types and functions

```ts
// lib/types.ts
type TaskCommitment = "fixed" | "reminder" | "flexible";
// Task gains: commitment?: TaskCommitment; overdueDismissedAt?: string | null

// lib/task-when.ts
function formatTaskWhen(
  task: { date: string; time: string; endTime?: string | null },
  now: Date, timezone: string): string;
function taskEndTime(task: Pick<Task, "time" | "notes">): string | null;

// lib/task-kind.ts
type TaskSource = "capture" | "calendar" | "canvas" | "plan" | "manual";
function classifyTaskKind(input: {
  title: string; hasFixedTime: boolean; source: TaskSource; projectId?: string | null;
}): { kind: TaskCommitment; confidence: number };
function commitmentOf(task: Task): TaskCommitment;      // stored value, or rules when null
function commitmentLabel(kind: TaskCommitment): "Appointment" | "Reminder" | "Plan step";

// lib/task-kind-ai.ts (server only)
function classifyWithFallback(input: ClassifyInput): Promise<{ kind: TaskCommitment; confidence: number }>;

// lib/today-sections.ts
type TodayGroups = {
  mustDo: Task[]; olderOverdueCount: number; todaysPlan: Task[];
  comingUp: { date: string; tasks: Task[] }[];
};
function groupTodayTasks(tasks: Task[], now: Date, tz: string): TodayGroups;
function overdueStyle(task: Task, now: Date, tz?: string): "hard" | "soft" | null;
function glanceLine(groups: TodayGroups, now: Date, tz: string): string;

// lib/task-colors.ts
type SeriesKey = "violet" | "teal" | "rose" | "blue" | "amber" | "green"
               | "magenta" | "indigo" | "orange" | "cyan";
const SERIES_PALETTE: Record<SeriesKey, { label: string; light: string; dark: string }>;
const SERIES_CSS: string;                                  // one <style> from the palette
function assignProjectColor(existing: readonly string[]): SeriesKey;
function courseColor(courseName: string): SeriesKey;
function projectSeries(value: string | null | undefined, id: string): SeriesKey;
function taskSeries(task: Task, plans: Pick<Plan, "id" | "color">[]): SeriesKey | "personal" | "neutral";
function readableInk(backgroundHex: string): "#ffffff" | "#17132a";

// lib/spacing.ts, lib/load.ts
type PlacementRules = {
  maxPerProjectPerDay: number;          // 2
  bufferMinutes: number;                // 15
  preferredWindows?: { start: number; end: number }[];
};
// placeTask and spreadSessions gain an optional rules argument.
// A placement gains note: "Packed because the deadline is close" when the cap had to give.

// lib/schema-compat.ts
type SchemaErrorKind = "missing_column" | "missing_table" | null;
function schemaErrorKind(err: { code?: string; message?: string } | null): SchemaErrorKind;
function warnSchemaOnce(key: string, message: string): void;
```

### Behavior notes

- **Today's input** reuses AddFlow's save path; the "Goes to" row and chips are removed there. Send-to applies to the next input only, then returns to Auto.
- **The phone floating mic** hides while the Today input is in view. An `IntersectionObserver` replaces the 400ms polling (M1, L5). Capture mode and hold-to-talk are unchanged.
- **Phase C dependency:** until C lands, Slide 3's Answer opens the existing `GrillDeck`, and `preferredWindows` is simply absent.
- **School Blocks** appear in none of the three sections. They stay on the calendar and the placement rules still respect them.
- **Undo:** the Type selector and project color each write an action record through the existing undo paths.

## 5. Phase B: Plan preview, month by default

```
Desktop                                       Phone
┌────────────────────────────────────────┐    ┌─────────────────────────────┐
│ Plan preview        [Month | Week]     │    │ [Month | Week]              │
│ ‹   November 2026   ›                  │    │ ‹  November 2026  ›         │
│ Sun  Mon  Tue  Wed  Thu  Fri  Sat      │    │ S  M  T  W  T  F  S         │
│  26   27   28   29   30   31    1      │    │ ·  ·  ·  ·  ·  ·  1         │
│  dim  dim  dim  dim  dim  dim          │    │ 2  3 [4] 5  6  7  8         │
│   2    3  [ 4]   5    6    7    8      │    │    ●  ●     ●               │
│      ▬▬▬ ▬▬▬       ▬▬▬                 │    │       ∘∘                    │
│           ∘∘                           │    │ 9 10 11 12 13 14 15         │
│   9   10   11   12   13   14   15      │    │   ●●    ●                   │
│      ▬▬▬ +3         ▬▬▬                │    ├─────────────────────────────┤
│ ▬ new step (project color) ∘ existing  │    │ Tue, Nov 4        bottom sheet│
│ [Edit]                 [Discard][Confirm]   │ ● Read ch. 12 · 4:30 PM     │
└────────────────────────────────────────┘    │   Because the quiz is Friday│
Hover on ▬: title, Tue, Nov 4 · 3:30 PM, why  │ ∘ Dentist · 3:30 PM         │
Click a day: switches to that week            └─────────────────────────────┘
```

**Create:** `lib/month-grid.ts`, `.test.ts`, `components/preview/MonthPreview.tsx`, `PreviewDaySheet.tsx`, migration 3.
**Change:** `components/PreviewCard.tsx`, `lib/preview-week.ts` (+ week start), `lib/task-filters.ts` (`endOfWeek`), `lib/project-stats.ts` (`workloadByWeek`), `lib/store.ts` (profile select), `lib/types.ts`, `app/(app)/calendar/*` (reads the week start), `lib/dev/sample-state.ts`.

```ts
type WeekStart = 0 | 1 | 6;
type MonthGridItem = {
  key: string; date: string; kind: "new" | "existing"; title: string;
  when: string; why?: string; color?: SeriesKey | "neutral";
};
type MonthCell = {
  date: string; inMonth: boolean; isToday: boolean;
  newItems: MonthGridItem[]; existing: MonthGridItem[];
  newOverflow: number; existingOverflow: number;   // show 2 new, 3 existing
};
function buildMonthGrid(monthStart: string, weekStart: WeekStart,
  items: MonthGridItem[], today?: string): MonthCell[][];
function previewRange(items: MonthGridItem[]): {
  first: string; last: string; minMonth: string; maxMonth: string;
};
function weekLabel(weekStartDate: string): string;   // "Nov 2–8"
```

Edit, Confirm, Discard, Enter, Esc, plan notes and kind labels stay as they are.

## 6. Phase C: Context engine

```
┌────────────────────────────────────────────┐
│ Tangent knows enough: 60%  ▓▓▓▓▓▓░░░░      │
│ How many hours a week can you give this?   │
│ [1–2] [3–5] [6–10] [10+]                   │
│ Type answer · Skip            Stop planning│
└────────────────────────────────────────────┘
After 5 in a row: Want to keep going or plan now?  [Keep going] [Plan now]
```

**Worked example, "help me get ready for the SAT in a month":** deadline and outcome are inferred, so the score starts at 0.40. Tangent asks hours (0.60), then the once-ever work-time question (0.70), then drafts. That's two questions.

**When the flow ends:** the score reaches 0.70 and `deadline` and `hoursPerWeek` are both settled, or nothing is left to ask, or the student stops. Skipping deadline or hours applies the stated default and counts as filled. Skipping anything else removes it from this session without adding score, so the loop always finishes. There are at most 7 project slots.

**Scope:** this flow applies to plan and project requests only. "Dentist Friday 2pm" still saves with no questions.

**Cost:** questions come from templates, so asking them costs no AI. At most one Haiku call per request, for inference when the rules aren't sure.

**Before the migration:** if `context_slots` is missing, the flow falls back to the old `clarifyQuestions`.

**Create:** `lib/context/slots.ts`, `.test.ts` (types, weights, scoring), `lib/context/infer.ts`, `.test.ts`, `lib/context/flow.ts`, `.test.ts`, `lib/context/store.ts`, `components/grill/SlotQuestionCard.tsx`, migration 4.
**Change:** `lib/grill-queue.ts` + tests, `lib/ai/clarify.ts`, `lib/ai/plan-brief.ts`, `lib/ai/student-context.ts`, `lib/ai/models.ts`, `lib/spacing.ts`, `lib/pipeline/understand.ts`, `app/api/grill/route.ts`, `app/api/grill-queue/route.ts`, `app/api/chat/route.ts`, `components/add/AddFlow.tsx`, `components/console/ClarifyCard.tsx`, `components/grill/GrillDeck.tsx`, `HelpPlanBetter.tsx`, `components/settings/GrillQueue.tsx`, `components/today/TodaySlider.tsx`, `components/PreviewCard.tsx`, `lib/pipeline/event-types.ts`.

```ts
type SlotKey = "outcome" | "deadline" | "hoursPerWeek" | "currentLevel"
             | "hardestPart" | "constraints" | "bestTimeForThis";
type GlobalSlotKey = "preferredWorkTimes" | "focusLength" | "weekendAvailability";
type SlotValue = {
  value: string | number | string[];
  source: "answer" | "inferred" | "default" | "known";
  updatedAt: string;
};
type SlotMap<K extends string> = Partial<Record<K, SlotValue>>;
const SLOT_WEIGHTS: Record<SlotKey, number>;   // .25 .20 .15 .15 .10 .10 .05
const ENOUGH = 0.7;
const SLOT_DEFAULTS: { deadline: "2 weeks"; hoursPerWeek: 3 };

function computeSufficiency(
  projectSlots: SlotMap<SlotKey>, globalSlots: SlotMap<GlobalSlotKey>,
  knownFacts: KnownFacts, requestText: string,
): { score: number; missing: SlotKey[] };
function inferSlotsFromText(text: string, today: string): SlotMap<SlotKey>;
function inferSlotsWithFallback(text: string, today: string): Promise<SlotMap<SlotKey>>;

type FlowState = {
  answered: SlotMap<SlotKey>; skipped: SlotKey[]; inARow: number;
  stopped: boolean; askedGlobal: GlobalSlotKey[];
};
type FlowStep =
  | { type: "ask"; slot: SlotKey | GlobalSlotKey; card: SlotQuestion; score: number }
  | { type: "check_in"; score: number }
  | { type: "draft"; assumptions: string[]; queueSlots: SlotKey[] };
function nextStep(state: FlowState, sufficiency: Sufficiency, global: SlotMap<GlobalSlotKey>): FlowStep;
function slotQuestion(slot: SlotKey | GlobalSlotKey, context: { title?: string }): SlotQuestion;
function slotToFact(slot: SlotKey | GlobalSlotKey, value: SlotValue, projectTitle?: string): string;
function rankSlotQueue(projects: ProjectSufficiency[]): QueuedSlot[];   // (1 − score) × weight
function answerChangesPlan(slot: SlotKey, before: SlotValue | undefined, after: SlotValue): boolean;
function preferredWindows(slot: SlotValue | undefined): { start: number; end: number }[] | undefined;
```

The Settings screen for this queue is built in Phase E. Until then the current Settings list gets the new data.

## 7. Phase D: Chat model

```
Expanded Home chat, phone                Desktop, same column at max 720px
┌──────────────────────────────┐        ┌────────────────────────────────┐
│ Chat with Tangent     [Done] │        │ Chat with Tangent       [Done] │
│                              │        │  (messages scroll here)        │
│      what's due this week? ▸ │        │  ◂ You have 3 things due…      │
│ ◂ You have 3 things due…     │        │  ┌ Preview card, inline ─────┐ │
│ ┌ Preview card, inline ────┐ │        │  │ Confirm · Edit · Discard  │ │
│ │ Confirm · Edit · Discard │ │        │  └───────────────────────────┘ │
│ └──────────────────────────┘ │        │ (mic) Ask anything…     (send) │
│ (mic) Ask anything…   (send) │        ├────────────────────────────────┤
├──────────────────────────────┤        │ MUST DO 3   (sections slide    │
│ MUST DO 3      (slid down)   │        │ TODAY'S PLAN 2   down below)   │
└──────────────────────────────┘        └────────────────────────────────┘
The slider is hidden. Esc or Done collapses. Reduced motion: instant.

Chats library (/ai)
┌──────────────────────────────┐
│ Chats                        │
│ [Search chats…]              │
│ [All] Projects Tasks General │
│ ● SAT prep        2h ago     │
│   Planned three weeks of…    │
│ ● Read ch. 12     Yesterday  │
│ ○ General         Mon        │
└──────────────────────────────┘
No composer on this page.
```

**Create**
- `lib/chat/context.ts`, `.test.ts`, `lib/chat/scope.ts`, `.test.ts`, `lib/chat/library.ts`, `.test.ts`, `lib/chat/store.ts`
- `components/chat/ChatPanel.tsx` (shared thread and composer), `HomeChat.tsx`, `TaskChatSheet.tsx`, `ProjectChatPanel.tsx`, `ChatLibrary.tsx`, `chat.css`
- `app/api/chat-thread/route.ts`: find or create a thread by scope
- Migration 5

**Restore from `9a5c954^` as a starting point, then rewrite:** `components/projects/ProjectChat.tsx` becomes `ProjectChatPanel`; `components/TaskChatModal.tsx` becomes `TaskChatSheet`; `app/api/task-chat/route.ts` is replaced by `/api/chat` with scope, because the old route bypassed the pipeline. `InlinePreview.tsx` is not restored; the shared `PreviewCard` covers it.

**Change**
- `app/(app)/ai/page.tsx`: becomes the library. The composer, `BriefPanel`, `ModeSwitch`, suggestions and starters leave this page; I'll list exactly what moved or was removed in the end report.
- `components/console/*`: kept where shared, removed where unused.
- `components/AppShell.tsx` (Chats nav and icon), `components/CommandPalette.tsx`, `components/add/AddFlow.tsx`, `components/capture/CaptureHome.tsx`, `components/TaskDetail.tsx`, `components/settings/AiActivity.tsx`, `components/FeatureTour.tsx`
- `app/(app)/projects/[id]/page.tsx` (Open chat; also H9), `lib/ask-handoff.ts`, `lib/ask-route.ts` + tests, `lib/store.ts`, `app/api/sessions/route.ts` (M11, validation), `app/api/chat/route.ts`, `app/api/path/route.ts` (H10), `lib/ai/models.ts`, `lib/types.ts`

```ts
type ChatScope =
  | { type: "general" }
  | { type: "task"; taskId: string }
  | { type: "project"; projectId: string };

const CHAT_CONTEXT_TOKEN_BUDGET = 1500;
function estimateTokens(text: string): number;                  // chars / 4
function formatChatContext(data: ChatContextData, budget?: number): string;
function buildChatContext(scope: ChatScope): Promise<string>;

function scopeOfSession(session: ChatSession): ChatScope;        // works before the migration
function canContinueGeneral(lastAt: string | null, now: Date): boolean;   // within 2 hours
function shouldSummarize(messageCount: number, lastSummarizedAt: number): boolean;  // every ~6

type LibraryEntry = {
  id: string; scope: ChatScope["type"]; title: string; preview: string;
  color: SeriesKey | "neutral"; updatedAt: string; href: string | null; taskId?: string;
};
function libraryEntries(sessions: ChatSession[], tasks: Task[], plans: Plan[]): LibraryEntry[];
function filterLibrary(entries: LibraryEntry[], tab: "all" | "projects" | "tasks" | "general",
  query: string): LibraryEntry[];
```

- **Opening an entry:** task chat uses `openTask(id, { chat: true })`; project chat uses `/projects/[id]?chat=1`; General uses `/?chat=<id>`.
- **Orphans:** a chat whose task or project was deleted opens read-only on Home.
- **Before the migration:** `scopeOfSession` infers scope from `plan_id` and `task_ids`, and `task_id` isn't written.
- **Deliberately kept:** the `goal` route to `/tangents?new=1`. Whether Tangents stays is an end-of-round decision.

## 8. Phase E: Settings

```
Desktop
┌────┬──────────────────┬───────────────────────────────────────────┐
│    │ Settings         │ Schedule & School                         │
│rail│ ▸ Account        │ When you're busy and when you work best.  │
│    │   Security       │                                           │
│    │ ▌ Schedule       │ School blocks                             │
│    │   Notifications  │ Days            Mon–Fri              [▾]  │
│    │   Context        │ Start and end   8:00 AM – 3:00 PM         │
│    │   AI activity    │                              [Save]       │
│    │   Data & privacy │ Canvas      Connected · Reconnect         │
│    │                  │ Week starts on  Sunday               [▾]  │
└────┴──────────────────┴───────────────────────────────────────────┘
Content max width 720px.

Phone, list                      Phone, one page
┌──────────────────────────┐    ┌──────────────────────────┐
│ Settings                 │    │ ‹ Settings               │
│ Account               ›  │    │ Data & privacy           │
│ Security              ›  │    │ What we store, plainly.  │
│ Schedule & School     ›  │    │ [Export my data]         │
│ Notifications         ›  │    │ [Clear local cache]      │
│ Context               ›  │    │ Delete my data           │
│ AI activity           ›  │    │ Type DELETE to confirm   │
│ Data & privacy        ›  │    │ [________] [Delete]      │
└──────────────────────────┘    └──────────────────────────┘
```

**Create**
- `app/(app)/settings/layout.tsx` and `account`, `security`, `schedule`, `notifications`, `context`, `activity`, `data` pages
- `components/settings/SettingsNav.tsx`, `SettingsRedirect.tsx`, `components/ui/settings.css`
- `components/ui/SettingsSection.tsx`, `SettingRow.tsx`, `Toggle.tsx`, `TextField.tsx`, `Select.tsx`, `FormMessage.tsx`, `ConfirmPanel.tsx`
- `lib/settings-routes.ts`, `.test.ts`, `lib/data-export.ts`, `.test.ts`, `app/api/export/route.ts`, migration 6

**Change:** `app/(app)/settings/page.tsx` (split up), `components/ui/Button.tsx` (rename `quiet` to `ghost`, keeping an alias until callers move; add loading spinner), all `components/settings/*`, `components/settings/SecuritySettings.tsx` (reset `next` path, H6), `app/api/context/route.ts` (`forget_all`), `app/api/cron/proactive/route.ts` (respect quiet hours and nudge times), `app/api/reset/route.ts`, `lib/store.ts` (`resetUserData`, profile prefs), `components/CommandPalette.tsx`, `components/AppShell.tsx`, `components/PreviewCard.tsx`, `components/RecentChanges.tsx`, `components/dashboard/SetupNudge.tsx`, `components/FeatureTour.tsx`, `app/(app)/ai/page.tsx` (deep links).

```ts
type SettingsPage = "account" | "security" | "schedule" | "notifications"
                  | "context" | "activity" | "data";
function legacySettingsTarget(search: string, hash: string): string | null;
function settingsLanding(isDesktop: boolean, search: string, hash: string): string | null;

type NotificationPrefs = { nudgeTimes?: string[]; quietHours?: { start: string; end: string } };
function inQuietHours(prefs: NotificationPrefs, localTime: string): boolean;

const EXPORT_TABLES: readonly string[];
function redactExportRow(table: string, row: Record<string, unknown>): Record<string, unknown>;
```

- **Export:** runs on the server, and the test proves `canvas_feeds.ics_url` never leaves, because it embeds a private Canvas token.
- **Old links:** `/settings#ai-activity`, `#onboarding`, `#security`, `?activity=…` and `?reset=1#security` all still work. Hash fragments never reach the server, so these redirects run in the browser, along with the phone and desktop split.
- **Homes the prompt didn't name:** Appearance and "What Tangent helps with" go on Account.
- **Web push doesn't exist today.** The app has browser notifications and an in-app feed, not `PushManager`. The Notifications page manages what exists; building real push is out of scope, and it's flagged in section 10.

## 9. Phases F and G

### F.1 Completion time

- **Change:** migration 7, `lib/store.ts` (set and clear centrally in `updateTask`, the path `completeTask`, `toggleTask`, undo, `apply-core` and `voice-handler` share; any direct write found gets moved to it), `lib/pipeline/undo-core.ts`, `lib/project-stats.ts` + tests, `components/projects/ProjectStats.tsx`, School card.
- `paceOf` returns `{ …; approximate: boolean }`. It's true only when `updated_at` was used.
- Fixes M7 and M8.

```ts
function completionPatch(completed: boolean, now: Date): { completed_at: string | null };
function completionTime(task: StatTask): { at: string | null; approximate: boolean };
```

### F.2 AI quality and cost

- **Change:** `lib/ai/models.ts`, `lib/ai/call.ts`, `lib/ai/student-context.ts`, `lib/pipeline/fixtures/requests.json`, `lib/pipeline/grade.ts` + tests, `scripts/eval-pipeline.ts`. I load the `claude-api` skill before touching these.
- **Model routing:** the app already runs Haiku 5.5 and Sonnet 5.5, so this extends the table. New tasks: `classify`, `summary`, `slot_extract`, `chat`. Aliases over existing tasks: `title` to `chatTitle`, `route` to `intentRouter`, `plan_draft` to `plan`, `plan_extend` to `extendPlan`.
- **Caching and usage:** caching and token logging already exist, so this adds coverage for stable prompts and a cached-vs-uncached query.
- **Evals:** 20+ kind cases, 15+ slot cases, 15+ routing cases. Rule-based ones also run in `npm test` and in `--check`, at no cost. I'll ask before any paid run.

```ts
function chatTier(text: string, scope: ChatScope): "fast" | "smart";
function buildCompactContext(opts?: { maxFacts?: number; budgetTokens?: number }): Promise<string>;
function gradeKindCase(c: KindCase, got: TaskCommitment): Grade;
function gradeSlotCase(c: SlotCase, got: SlotMap<SlotKey>): Grade;
function gradeRouteCase(c: RouteCase, got: AskRoute): Grade;
```

### F.3 Pilot analytics

- **Create:** `lib/analytics.ts`, `.test.ts`, `lib/analytics-rules.ts`, `.test.ts`, `app/api/app-open/route.ts`, `docs/tangent/pilot-metrics.sql`.
- **Change:** `lib/pipeline/event-types.ts`, `app/api/events/route.ts`, `components/AppShell.tsx`, plus one call at each event's source.
- `signup` and `week_two_return` fire from the first app open, so the sign-in routes stay untouched.
- First-event races are handled in the SQL with `count(distinct user_id)`, so no extra migration.

```ts
type PilotEvent = "signup" | "first_capture" | "capture" | "first_plan_confirmed" | "plan_confirmed"
  | "task_done" | "not_today" | "too_big" | "fresh_start" | "auto_replan" | "grill_answered"
  | "grill_skipped" | "grill_stopped" | "chat_started" | "week_two_return";
type PilotProps = Partial<{
  projectId: string; taskId: string; sessionId: string; count: number;
  slotKey: SlotKey | GlobalSlotKey; kind: TaskCommitment; scope: ChatScope["type"];
}>;
function trackEvent(name: PilotEvent, props?: PilotProps): Promise<void>;
function sanitizePilotProps(props: unknown): PilotProps;         // runtime allowlist
function isWeekTwoOpen(signupAt: string, now: Date): boolean;    // day 7 to day 14
```

### F.4 and F.5

- **Docs:** `docs/tangent/PROJECT.md`, `CONTEXT.md`, `AGENTS.md`, `docs/tangent/decisions/2026-11-chat-model.md`, `2026-11-grill-sufficiency.md`, as you listed. PROJECT.md's stale test count and model names are corrected too.
- **AGENTS.md** today says "at most 3 questions" and "no new AI chat surfaces". Those lines get replaced, not just added to.
- **Clean-up:** only touched code moves, into `lib/today/*`, `lib/context/*`, `lib/chat/*`, and last in the phase, so a failure is easy to separate. Public behavior stays identical and the tests prove it. `lib/store.ts` keeps re-exporting moved functions, so untouched callers don't change.

### G. Remaining audit findings and release check

**Create:** `app/error.tsx`, `app/global-error.tsx`, `app/loading.tsx`, `app/(app)/loading.tsx`.

**Change:**
- `app/layout.tsx` (H7)
- `app/globals.css` and `app/liquid-glass.css` (H3, H4, H8, L6, L7, L8)
- `app/(auth)/auth.css` and `layout.tsx` (C1, H11, M20, L2)
- Calendar (M6), repeated fetches and `/api/health` (M13, M14), `console.*` cleanup (M15), Projects gutters (L12)

Then the full re-audit, the "Release readiness" verdict, the final Review notes, and `docs/MANUAL-STEPS.md` in full.

## 10. Risks, and what I think is a bad idea

Nothing here has been changed silently. **Built with a change** means the recommendation is in this plan and you can veto it. **Built as you asked** means I'd do it your way and just want you to know.

**Built with a change**
1. **A start time doesn't mean an appointment.** Tangent's own planner gives steps a time, so "Take practice exam" at 4:30 inside an SAT project would become `fixed`, then show red when missed. That breaks "calm, not guilty". Project steps stay `flexible` unless the student explicitly typed a time for that step at capture. "SAT practice test Saturday 8am" with no project is still `fixed`.
2. **Calendar imports have no source marker,** so the backfill matches the `From …` note. A student note ending that way could be misclassified; the Type selector fixes it. New imports save `commitment_type = 'fixed'` directly, so the guess is only needed for old rows.
3. **Send-to on a slider can be forgotten.** If the student picks Robotics and swipes away, nothing shows it's still set. I'm adding a small removable chip in the input row.
4. **Two mics on a phone.** Keeping the floating mic beside a new input mic repeats audit finding M1. It hides while the input is on screen.
5. **The Haiku fallback can't block saving.** If the call fails or is over budget, the rules' answer is used.

**Built as you asked, with a concern**
6. **The slider hides the questions.** Questions move two swipes away. Carousels are often ignored, so answer rates may fall. `grill_answered` will show it during the pilot. If it does, move the count next to the Today header.
7. **Month view on short plans.** A three-step plan shows as a few dots in an empty month, and phones show only dots. For plans inside one week, Week would say more. Month stays the default as you asked; changing that is one line.
8. **`chat` on Haiku by default.** It's cheaper, but students may judge Tangent by chat quality. `chatTier` sends planning chats to Sonnet. The routing evals cover the switch, not answer quality, so watch this in the pilot.
9. **Reversing Juann's work.** Project colors replace Juann's four-color rule, and Today replaces the capture screen as Home. Worth telling Juann before this merges. `AGENTS.md` would normally call for a Council Review on this much scope; I'm treating your prompt as the decision, as with the v3 brief, and the decision records capture why. Ask if you want the Council run.
10. **Everything in one branch.** Seven phases touching Today, chat, Settings and the store is a big merge, and since all environments share one database, the migrations reach production data as soon as you run them. They're additive and the old code ignores them, so order is forgiving. Still, take a backup first; this goes in `MANUAL-STEPS.md`.
11. **Analytics rows are written by students' sessions,** so numbers can technically be forged (L11). That's acceptable for a 20–30 student pilot.
12. **Nudge times need a cron schedule to matter.** I can make `cron/proactive` respect them, but it can only act when the cron runs. Check the schedule on Vercel, which is off-limits to me; this goes in `MANUAL-STEPS.md`. Real push, for a closed tab on a phone, would be a separate project.

**Technical risks**
- **`lib/store.ts` fallback.** It affects every task read and is covered by unit tests with a fake client, but not against real Supabase. This is the riskiest code in Phase A, so it lands with tests first.
- **Undo for new fields.** Kind and color undo need new paths in `undo-core`. Each gets a test.
- **Hidden preview pane.** Motion stalls while the Browser pane is hidden, so I force a paint before measuring, as in the audit.
- **Not testable in emulation:** on-screen keyboard, notch and safe areas, real push. These go on the manual list.

## 11. Order of work

Phases run A to G as you specified, with one suggested exception: a small first commit for **C1, H3, H4 and H7**, the contrast tokens and viewport. Otherwise every phase's "nothing got worse" check starts from known failures, and each new screen inherits failing text colors. If you'd rather keep strict order, they stay in G.

Other dependencies are handled by landing the seam first:
- A.5's preferred times take an optional argument that C fills.
- Slide 3 opens the existing `GrillDeck` until C.
- Settings' Schedule page gets work times in E, after C.

Each phase ends with: tests and build, a strict diff re-read, screens at 1440 and 390 in light and dark, console check, Review notes in the audit, and one commit. No pushes. This plan file goes in with the first commit, since the prompt allowed only the audit to be committed in Phase 0.

## 12. Smaller choices I'll make unless you object

- **Time ranges:** there's no end-time column, so a range shows only when the notes state a duration or the task is a School Block. No migration.
- **"Dismiss"** on a hard-overdue row hides it from Must do. It doesn't complete or delete it.
- **Palette keys** are stored in `plans.color`, not hex. Light and dark values live in one TS object, emitted as CSS variables, so `[data-theme]` keeps working.
- **Old four-color tokens (`--cat-*`)** go away where stripes and blocks change. `kind`-based filters and capacity estimates are unaffected.
- **`/ai` keeps its URL** and is renamed Chats in the nav.
- **`ghost`** replaces `quiet` as the Button variant name.
- **Week start choices** are Sunday, Monday and Saturday; the default is Sunday.
- **Calendar** starts on the student's week start. Preview, `endOfWeek` and `workloadByWeek` all use it, which fixes today's mix of Monday and Sunday.
- **Sample state** gets new kinds, palette colors, overdue examples and chats, so dev routes exercise real states. Dev routes gain `projects/[id]`, `chats`, each Settings page, and `?v2=1` for the flag.
