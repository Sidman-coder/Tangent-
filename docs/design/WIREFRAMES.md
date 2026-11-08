# Round 3 wireframes

ASCII wireframes at **1440** (desktop) and **390** (phone) for each screen. They show structure, order and hierarchy, not exact pixels. Tokens and components are defined in [TANGENT-STYLE.md](TANGENT-STYLE.md). All names are made up (sample data only).

Legend: `(●)` filled violet primary · `[ ]` secondary/ghost button · `○` checkbox · `●` project color dot · `▌` project stripe · `▸/▾` collapsed/expanded · `⋯` more · `🎙` mic · `↑` send · `▔▔` active underline tab · `{ }` active segmented pill.

Shared shell:
- **Desktop:** a 232px sidebar (Home · Calendar · Projects · Chats, a PROJECTS list, then Notifications · Settings · avatar at the bottom) and a centered 760px content column (1180px on Calendar and Settings).
- **Phone:** a 56px glass top bar (logo/title left, bell right) and a 64px glass bottom bar (Home · Calendar · Projects · Chats · Settings, 12px labels).

---

## 1. Home / Capture (`/`), top of the page

Order: one composer, then the view tabs, then one dismissible line, then the list (section 2).

### 1440

```
┌────────────────────────┬──────────────────────────────────────────────────────────────────────────────┐
│ ◆ Tangent              │                                                                              │
│ [+ New]                │        Good morning, Sam                                   Sat, Nov 7       │
│                        │        4 things today · 1 past due                                           │
│ {⌂ Home          4 }   │                                                                              │
│  ▦ Calendar            │        ╭──────────────────────────────────────────────────────────────────╮  │
│  ▤ Projects            │        │ Type or say anything…                                            │  │
│  ▢ Chats               │        │                                                                  │  │
│                        │        │ [Auto ▾]                                              🎙   (↑)   │  │
│ PROJECTS               │        ╰──────────────────────────────────────────────────────────────────╯  │
│  ● Bio Lab        ◔    │                                                                              │
│  ● Robotics       ◑    │        ┌───────────────────────────────────────────────┐                     │
│  ● SAT prep       ◔    │        │ { All }   School    Projects    Personal      │                     │
│  All projects →        │        └───────────────────────────────────────────────┘                     │
│                        │                                                                              │
│                        │        ✦ 1 quick question about Robotics · Finish setting up (2 left)  [×]  │
│                        │        ─────────────────────────────────────────────────────────────────── │
│                        │        (the Today list, section 2)                                          │
│ 🔔 Notifications   •   │                                                                              │
│ ⚙ Settings             │                                                                              │
│ (S) Sam                │                                                                              │
└────────────────────────┴──────────────────────────────────────────────────────────────────────────────┘
```

- **Auto ▾** opens a menu: Auto · Today · Calendar · Bio Lab · Robotics · … (it replaces the old "Send to" slider page).
- Typing and pressing Enter runs the existing capture → Pipeline V2 preview. A question ("Plan Bio Lab?") opens the **Home chat** (section 4) in place.
- The dismissible line merges Grill questions and "Finish setting up". Clicking it expands one flat card in place (Grill card: question, filter chips, `[Skip]` `[Stop]`, a thin progress bar with no %). `×` hides it until tomorrow.

### 390

```
┌──────────────────────────────────────┐
│ ◆ Home                          🔔•  │  top bar (glass)
├──────────────────────────────────────┤
│ Good morning, Sam                    │
│ 4 things today · 1 past due          │
│ ╭──────────────────────────────────╮ │
│ │ Type or say anything…            │ │
│ │ [Auto ▾]              🎙   (↑)   │ │
│ ╰──────────────────────────────────╯ │
│ ┌──────────────────────────────────┐ │
│ │{All} School Projects Personal    │ │  scrolls sideways only inside the track if needed
│ └──────────────────────────────────┘ │
│ ✦ 1 question · Finish setup    [×]   │
│ ──────────────────────────────────── │
│ (Today list, section 2)              │
│                                      │
├──────────────────────────────────────┤
│  ⌂     ▦      ▤      ▢      ⚙        │  bottom bar (glass)
│ Home  Cal   Projects Chats Settings  │  12px labels
└──────────────────────────────────────┘
```

- While listening, the mic turns red with a calm pulse and the live words stream into the field in gray.
- The composer scrolls away with the page (it is not pinned on Home); it is pinned only inside a chat.

---

## 2. Today list (the "All" view on Home)

### 1440 (content column only)

```
        PAST DUE · 2                                              [Fresh start]   ▾
        ▌○  Lab report draft                                      ● Thu   ⋯           ← red: fixed deadline
         ○  Read chapter 6                             Planned for Mon (amber)   ⋯    ← flexible step that slipped

        ☀ Morning   before 12 PM                                                  1
          ● Bio Lab
          ●  Collect samples ✓  (faded, struck through)                9:00 AM
        ───────────── 10:42 AM ●───────────────────────────────────────────────────   ← Now line (red)
        ☀ Afternoon   12 – 5 PM                                                   2
          ● Robotics
          ▌○  Wire the arm motor                                        3:30 PM  ✓ ↷ ✂ ⋯  ← hover actions
          ● SAT prep
          ○  Practice test, math 1                                      4:30 PM
        🌇 Evening   5 – 9 PM                                                     1
          ● School
          ○  Unit 3 LEQ Essay                                           7:00 PM
        ∞ Anytime today                                                          0  ▸

        COMING UP · next 3 days                                                     ▸
```

- Only tasks dated today appear in the time groups. Within a group: a project header (`● name`) once, then rows with the short title and the time only.
- Must-do rows: weight 600 and a 3px stripe (`▌`), red for fixed deadlines, violet for must-dos. No tinted backgrounds.
- **Past due:** the last 3 days only; collapsible; **Fresh start** moves anything older (the existing `FreshStart` action).
- Desktop row actions on hover/focus: Done ✓ · Not today ↷ · Too big ✂ · More ⋯.
- Empty day: the EmptyState ("You're all caught up. Anything on your mind? Say it above.").

### 390

```
│ PAST DUE · 2          [Fresh start] ▾│
│ ▌○ Lab report draft         ● Thu   │
│  ○ Read chapter 6     Planned Mon   │
│                                      │
│ ☀ Morning                         1  │
│  ● Bio Lab                           │
│  ● Collect samples ✓         9:00 AM │
│ ──────── 10:42 ●──────────────────── │
│ ☀ Afternoon                       2  │
│  ● Robotics                          │
│  ▌○ Wire the arm motor       3:30 PM │
│  ● SAT prep                          │
│  ○ Practice test, math 1     4:30 PM │
│ 🌇 Evening                        1  │
│  ● School                            │
│  ○ Unit 3 LEQ Essay          7:00 PM │
│ ∞ Anytime today                 0 ▸  │
│ COMING UP · next 3 days           ▸  │
```

- Swipe right: Done (green). Swipe left: Not today / Too big. Tap: the task detail bottom sheet (title, original text, project, date, the three actions, Chat about this).
- The list ends above the bottom bar plus 16px; nothing sits under the nav.

---

## 3. Project page (`/projects/[id]`)

### 1440

```
┌────────────────────────┬──────────────────────────────────────────────────────────────────────────────┐
│ (sidebar)              │  ← Projects                                                     [Chat] [⋯]  │
│                        │                                                                              │
│                        │  ◔ Bio Lab                                                                   │
│                        │  [● Bio Lab] [Due Fri, Nov 20] [4 sessions / week] [45 min each] [School]    │
│                        │  ▸ How this was planned                                                      │
│                        │                                                                              │
│                        │  ┌──────────────── main 520px ──────────────┐  ┌──── side 300px ─────────┐   │
│                        │  │ THIS WEEK                              3 │  │ 3 of 9   steps done     │   │
│                        │  │ ○ Collect samples           Mon          │  │ ███████░░░░░░░░░░░░░    │   │
│                        │  │ ○ Record results            Wed          │  │                          │   │
│                        │  │ ○ Draft intro paragraph     Thu          │  │ This week  ● ● ○ ○       │   │
│                        │  │ NEXT WEEK                              4 │  │ On track: 2 of 4 sessions│   │
│                        │  │ ○ Make the graphs           Mon          │  │ done this week.          │   │
│                        │  │ …                                        │  ├──────────────────────────┤   │
│                        │  │ LATER                                ▸ 2 │  │ Color   ● ● ● ● ● …      │   │
│                        │  │ [+ Add a step]                           │  │ Delete project           │   │
│                        │  └──────────────────────────────────────────┘  └──────────────────────────┘   │
└────────────────────────┴──────────────────────────────────────────────────────────────────────────────┘
```

- The "Assumed —" sentence becomes chips; the full text sits in the collapsed **How this was planned** card (muted card, a steps timeline).
- Rows carry no project dot or "ECs" tags (we are already inside the project).
- Before the first step: the pace card says "Starts Tue, Nov 17" with no "On track".
- **Delete project** is `danger-quiet`; pressing it expands an inline ConfirmPanel ("Delete Bio Lab and its 9 steps? This can't be undone." `[Cancel]` `(Delete)`).
- The duplicated "Coming up" side card is removed.

### 390

```
│ ←  Bio Lab                  [Chat] ⋯ │
│ ◔ Bio Lab                            │
│ [Due Fri, Nov 20] [4×/week] [45 min] │  chips wrap to 2 lines max
│ ▸ How this was planned               │
│ ┌──────────────────────────────────┐ │
│ │ 3 of 9 steps done                │ │
│ │ ██████░░░░░░░░░░░░               │ │
│ │ This week ● ● ○ ○                │ │
│ │ On track: 2 of 4 sessions done.  │ │
│ └──────────────────────────────────┘ │
│ THIS WEEK                          3 │
│ ○ Collect samples              Mon   │
│ ○ Record results               Wed   │
│ NEXT WEEK                          4 │
│ …                                    │
│ LATER                            ▸ 2 │
│ [+ Add a step]                       │
│ Delete project                       │
```

---

## 4. Chats library (`/ai`) and the expanded Home chat

### 1440, library

```
│  Chats                                                    [🔍 Search chats              ]  │
│   All    Home    Tasks    Projects                                                         │
│   ▔▔▔                                                                                      │
│  ─────────────────────────────────────────────────────────────────────────────────────────│
│  ⌂  Plan my week                       Moved 3 steps to Thursday…                   2h    │
│  ● Bio Lab                             Here's how the lab splits into 9 steps…   Yesterday│
│  ○ Wire the arm motor                  Want me to split this into…                   Mon  │
│                                                             (hover: 🗑 at the far right)  │
```

Empty: EmptyState ("No chats yet. Ask Tangent anything from Home."). No search results: "No chats match 'xyz'." with `[Clear search]`.

### 1440, expanded Home chat (on `/`, replaces the list until Done)

```
│  ← Home chat                                                             [Done]           │
│  ──────────────────────────────────────────────────────────────────────────────────────── │
│                                                  ╭──────────────────────────────────────╮ │
│                                                  │ Plan my bio lab, due Friday          │ │  user bubble
│                                                  ╰──────────────────────────────────────╯ │
│  Here's a project for **Bio Lab**: 9 steps across 2 weeks, about 45 minutes each.         │  assistant, plain
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐ │
│  │ Review project: Bio Lab                                     9 steps · Nov 9 – Nov 20 │ │  preview card
│  │ [Month] [List]   (month grid with one dot per day)                                    │ │
│  │ Tip: ask me to change anything.                         [Cancel]   (Add 9 steps)      │ │
│  └──────────────────────────────────────────────────────────────────────────────────────┘ │
│  • • •                                                                                    │  typing
│                                                                    ( ↓ Jump to latest )   │
│  ╭──────────────────────────────────────────────────────────────────────────────────────╮ │
│  │ Reply…                                                                🎙   (↑)       │ │  pinned composer
│  ╰──────────────────────────────────────────────────────────────────────────────────────╯ │
```

### 390, library and chat

```
│ Chats                            🔍  │    │ ←  Home chat               [Done] │
│  All  Home  Tasks  Projects          │    │            ╭──────────────────╮   │
│  ▔▔▔                                 │    │            │ Plan my bio lab… │   │
│ ⌂ Plan my week                  2h   │    │            ╰──────────────────╯   │
│   Moved 3 steps to Thursday…         │    │ Here's a project for **Bio Lab**: │
│ ● Bio Lab                  Yesterday │    │ 9 steps across 2 weeks.           │
│   Here's how the lab splits…         │    │ ┌───────────────────────────────┐ │
│ ○ Wire the arm motor           Mon   │    │ │ Review project: Bio Lab       │ │
│   Want me to split this…             │    │ │ (month, then the day list)    │ │
│   (swipe left: Delete)               │    │ │ [Cancel]      (Add 9 steps)   │ │
│                                      │    │ └───────────────────────────────┘ │
├──────────────────────────────────────┤    │ ╭───────────────────────────────╮ │
│  ⌂    ▦     ▤     ▢     ⚙            │    │ │ Reply…            🎙   (↑)    │ │  above keyboard
└──────────────────────────────────────┘    └───────────────────────────────────┘
```

- In a chat on the phone the bottom bar hides; the composer is the bottom edge and rides above the keyboard.
- Enter sends, Shift+Enter makes a new line. Preview cards are never wider than the column; the plan preview on the phone is month first, then the selected day's list (Pipeline V2 confirm and undo unchanged).

---

## 5. Calendar (`/calendar`)

### 1440

```
│  November 2026        [Today] ‹ ›          { Month }  Week   Agenda        [Filter ▾]           │
│ ┌──────────────┬───────────────────────────────────────────────────────────────────────────┐   │
│ │ mini month   │  ALL DAY  ▌Bio Lab due · ▌SAT registration                       ▾ (collapse)│   │
│ │  S M T W T F │ ──────────────────────────────────────────────────────────────────────────│   │
│ │  1 2 3 4 5 6 │  7 AM │ Mon 9        │ Tue 10       │ Wed 11 …                            │   │
│ │  ·   ·   ·   │  8 AM │▌Physics      │▌Physics      │                                     │   │
│ │ TODAY        │       │ 8:00–8:50    │ 8:00–8:50    │                                     │   │
│ │ ● Lab draft  │  3 PM │              │▌Wire the arm │                                     │   │
│ │ TOMORROW     │ ●─────│──────────────│── now ───────│────────                             │   │
│ │ ● Read ch 6  │  4 PM │▌Practice test│              │                                     │   │
│ └──────────────┴───────────────────────────────────────────────────────────────────────────┘   │
```

- Blocks: series tint, 3px stripe, `--text` title. Fixed = solid stripe, flexible = dashed stripe. Drag to move (unchanged behavior).
- The week grid opens scrolled to **school start or 7 AM** (whichever is set), not mid-afternoon.

### 390

```
│ November              [Today] ‹ ›  ▾ │  ▾ = view switcher sheet: Agenda / 3 days / Month
│  S  M  T  W  T  F  S                 │
│  8  9 10 11 12 13 14                 │  week strip, dots under days with items
│  ·  •  •     •                       │
│ ALL DAY ▌Bio Lab due          +1  ▾  │
│ 7 AM ───────────────────────────────  │
│ 8 AM ▌Physics 8:00                    │  3-day view, blocks with readable text
│ …                                     │
│                                (🎙)   │  FAB above the bottom bar
├──────────────────────────────────────┤
│  ⌂    ▦     ▤     ▢     ⚙            │
```

---

## 6. Settings (`/settings/*`)

### 1440

```
│  Settings                                                                                          │
│ ┌───────────────────┬──────────────────────────────────────────────────────────────────────────┐  │
│ │ Account           │  Notifications                                                            │  │
│ │{Notifications}    │  ┌────────────────────────────────────────────────────────────────────┐  │  │
│ │ Schedule          │  │ Daily summary            Get a 7 AM recap of the day.        [◯━]  │  │  │
│ │ What Tangent knows│  │ ────────────────────────────────────────────────────────────────── │  │  │
│ │ AI activity       │  │ Quiet hours              10 PM – 7 AM                     [Edit]   │  │  │
│ │ Security          │  │ ────────────────────────────────────────────────────────────────── │  │  │
│ │ Your data         │  │ Desktop alerts           Allowed in this browser           [Test]  │  │  │
│ └───────────────────┘  └────────────────────────────────────────────────────────────────────┘  │  │
```

- One H1 per page (the section name); no repeated H2 with the same words.
- One secondary button style for every row action; one `danger-quiet` style that opens a ConfirmPanel.
- What Tangent knows: grouped short facts ("School", "Schedule", "Projects"), Forget behind `⋯` per row, the long summary behind "Show summary".
- AI activity: a feed with TODAY / YESTERDAY dividers ("You asked: plan my week → **3 steps moved**", time right), filters as one segmented control + search.

### 390

```
│ ←  Settings                          │
│  Account  Notifications  Schedule  … │  underline tabs, scroll sideways
│           ▔▔▔▔▔▔▔▔▔▔▔▔▔              │
│ ┌──────────────────────────────────┐ │
│ │ Daily summary              [◯━]  │ │
│ │ Get a 7 AM recap of the day.     │ │
│ ├──────────────────────────────────┤ │
│ │ Quiet hours                    › │ │
│ │ 10 PM – 7 AM                     │ │
│ └──────────────────────────────────┘ │
```

---

## 7. Sign-in (`/signin`) and invite-only (restyle only)

### 1440

```
│                                                                                                    │
│                       ◆ Tangent                                                                    │
│      Say it once.                                        ┌──────────────────────────────────┐      │
│      Tangent turns it into                               │ Sign in                          │      │
│      a project you can finish.                           │ Email                            │      │
│                                                          │ [                              ] │      │
│      • Capture by voice or text                          │ Password                         │      │
│      • Steps that fit your week                          │ [                           👁 ] │      │
│      • Ask only what matters                             │ (           Sign in            )  │      │
│                                                          │ Invite only · Need access?       │      │
│                                                          └──────────────────────────────────┘      │
```

### 390

```
│ ◆ Tangent                            │
│ ┌──────────────────────────────────┐ │  card first on the phone
│ │ Sign in                          │ │
│ │ Email                            │ │
│ │ [                              ] │ │
│ │ Password                         │ │
│ │ [                           👁 ] │ │
│ │ (          Sign in           )   │ │
│ │ Invite only · Need access?       │ │
│ └──────────────────────────────────┘ │
│ Say it once. Tangent turns it into   │
│ a project you can finish.            │
```

The fields, validation, error messages and flow are untouched: only the layout and styles change. Fields keep their existing `id`/`name`/`autocomplete`.
