# TANGENT Product Redesign Design

**Status:** Approved in conversation on 2026-09-10

## Purpose

Redesign TANGENT as a professional, calm productivity workspace for high-school students. The interface should combine Linear's precision and speed with Notion's readability and progressive disclosure while retaining a recognizable TANGENT identity.

The product should help a student answer three questions with minimal effort:

1. What should I do now?
2. What comes next today?
3. How much room is left in my schedule?

## Goals

- Replace the prototype-like icon rail and disconnected cards with a coherent product shell.
- Establish one reusable visual and interaction system across Today, Tasks, Calendar, Console, Settings, onboarding, dialogs, and overlays.
- Make the current task and chronological schedule the dominant product experience.
- Surface one honest, personalized schedule insight without creating a generic analytics dashboard.
- Consolidate duplicate actions and AI entry points while preserving useful contextual assistance.
- Keep existing application state, task operations, API behavior, voice behavior, and intent classification intact.
- Meet a professional accessibility and responsive quality floor.

## Non-goals

- No new backend services, benchmarking dataset, analytics collection, or social comparison system.
- No changes to API route logic, store semantics, voice pipeline behavior, or intent classification.
- No speculative productivity features that are not supported by existing task and calendar data.
- No imitation of Linear or Notion branding, proprietary layouts, or exact styling.

## Product principles

### One clear next action

Each page has one dominant purpose. Supporting information stays visually quiet and appears when it helps a decision.

### Structured, not card-heavy

Use alignment, typography, spacing, dividers, and rows to create hierarchy. Cards are reserved for a genuinely bounded object such as the current focus or a floating dialog.

### AI is a capability, not a destination everywhere

The command palette handles fast capture and global actions. Console handles extended conversation. Contextual task or day assistance is optional and progressively disclosed instead of occupying permanent screen space.

### Personalization must be truthful

Insights compare the user with their own schedule history or stated preferences. TANGENT must not claim that a student is busier than peers without a real, consented, anonymized comparison dataset.

### Immediate feedback

Every interaction visibly responds in the next frame. Longer operations show a specific pending state and preserve context on failure.

## Visual system

### Color

- Canvas: `#F7F7FA`
- Surface: `#FFFFFF`
- Primary text: `#18181B`
- Secondary text: `#6F707A`
- Border: `#E6E6EB`
- Accent: `#5B3DF0`
- Accent soft: `#EFEDFF`

Task-kind colors remain available as narrow rails, dots, and calendar ribbons. They are metadata, not decorative panel backgrounds. Success, warning, and destructive colors retain semantic use only.

Dark mode uses the same hierarchy with existing dark-theme semantics. The redesign may tune theme values for readable contrast but does not introduce a separate visual language.

### Typography

- Plus Jakarta Sans: greetings, page titles, current-focus titles, and important numbers.
- Inter: navigation, task rows, body copy, forms, and buttons.
- JetBrains Mono: keyboard shortcuts and compact machine-like metadata only.

Target scale:

- Page title: 30–34px, 700 weight.
- Section title: 16–18px, 600–700 weight.
- Body and task title: 14–15px.
- Metadata: 12–13px.

Sentence case is the default. Avoid tracked all-caps labels except where a compact status label has a functional reason.

### Shape and elevation

- Standard control radius: 8px.
- Bounded surface radius: 12px.
- Large focus surface radius: 14px.
- Pills are used only for filters, compact statuses, or segmented controls.
- Page sections are flat by default.
- Floating menus, peeks, and dialogs receive a restrained shadow.
- Neumorphic inset surfaces are removed.

### Motion

- Hover and focus transitions: 120–160ms.
- Panels and dialogs: 180–220ms.
- Completion feedback: short opacity/check transition, with immediate state confirmation.
- Respect `prefers-reduced-motion` and remove nonessential movement.

## Application shell

### Desktop

- A 216px labeled sidebar replaces the 64px icon-only rail.
- Sidebar contains TANGENT identity, Today, Tasks, Calendar, Console, and Settings.
- A single prominent capture action opens the existing command palette.
- The top bar contains page context, command/search access, New task, notifications, and account affordance.
- Main content uses a consistent max width and page gutter rather than page-specific offsets.

### Tablet

- At narrower desktop widths, the sidebar collapses to an icon rail with tooltips.
- The top bar retains command/search, New task, and notifications.
- Two-column page layouts collapse before content becomes cramped.

### Mobile

- Primary destinations move to a compact bottom navigation.
- Page actions remain in a minimal top bar.
- Dialogs become full-width sheets where appropriate.
- The calendar remains usable without two-dimensional page scrolling.

## Today page

Today is the product's decision surface.

### Header

- Warm personalized greeting on the left.
- Current date and a New task action remain nearby but visually secondary.
- Do not duplicate the live time already available at the system level.

### Current focus

- One dominant surface shows the most urgent incomplete task.
- Content: task title, time, kind, urgency, optional start action, Mark complete, and Open details.
- A narrow task-kind rail provides identity without filling the card with color.
- Empty state: “You're clear for today,” followed by the next scheduled item or a New task action.

### Dayline

- Today's tasks appear as a chronological vertical sequence beneath the focus.
- Completed tasks are quiet but legible.
- The current task is clearly indicated once and is not repeated in another focus widget.
- The dayline uses existing task data and does not require store or API changes.

### Monthly rhythm and Schedule pulse

- A compact monthly workload view sits beside the current focus on wide screens and below it on narrow screens.
- Calendar cells show relative schedule density using restrained intensity, not decorative gradients.
- One Schedule pulse statement is selected from deterministic schedule facts.

Supported insights from existing data include:

- Busiest weekday by number of scheduled tasks.
- Number of open evenings in the current week.
- Next uninterrupted open block inferred from scheduled times.
- Completion percentage for the current month.
- Current week load compared with the user's recent four-week average.
- Concentration of academic work by time of day.

When future onboarding answers exist, insights may also compare scheduled load with the user's stated school hours, commute, bedtime, protected downtime, preferred study-block length, regular commitments, and weekly goals.

Do not display population comparisons such as “busier than most students” until a real comparison dataset and consent model exist.

### Week context

- A compact seven-day preview shows task density and kind distribution.
- It complements the monthly rhythm rather than duplicating the full Calendar.

### Recent activity

- Remains collapsed and only renders when activity exists.
- It is not part of the default visual hierarchy.

## Tasks page

- One page header contains the date, completion summary, and New task action.
- Keep one sticky current-focus row under the application header.
- Remove the duplicate `WhatToDoNow` surface and bottom “Add another task” button.
- Present tasks as flat, consistent rows grouped into incomplete and completed sections.
- Each row contains completion, title, time, kind, recurrence, and a quiet overflow action.
- Secondary details expand inline or open in a focused peek; they are not always visible.
- Shuffle and reset remain secondary utilities and must not compete with New task.
- Recurring deletion keeps its existing confirmation behavior.

## Calendar page

- Integrate calendar filters, month label, navigation, and New task into one toolbar.
- Reduce cell borders and use stronger spacing, date hierarchy, and task-kind ribbons.
- Today and the selected day must be distinct without large tinted backgrounds.
- Selecting a day opens a right-side peek on desktop and a bottom/full-height sheet on mobile.
- The day peek contains its date, ordered tasks, completion controls, recurrence controls, and contextual task creation.
- Remove the permanent Agent edge tab.
- “Ask about this day” becomes an optional collapsed action inside the day peek, preserving the existing capability without occupying default space.
- Opening Add task from a day preserves the selected date and calendar context without overlapping panels.

## Console page

- Replace the centered empty hero with a focused conversation workspace.
- Completed turns form a readable, single-column conversation stream.
- The composer remains anchored near the bottom of the content area.
- Voice is integrated into the composer rather than presented as a competing primary button.
- Starter prompts appear only before the first conversation turn.
- Remove the cosmetic Ask/Do selector because it does not currently alter behavior.
- Tool use, confirmations, loading steps, errors, and action receipts stay visible and specific.
- The command palette remains the fast global capture path; Console remains the extended conversation path.

## Settings page

- Use a two-column settings layout on desktop: section navigation and selected settings content.
- Stack sections on mobile without nested card clutter.
- Group profile, appearance, typography, onboarding, and account controls by purpose.
- Use consistent field labels, helper text, save states, and destructive-action treatment.
- Remove the disconnected browser-only OpenAI key/model section because the active assistant uses a server-side Anthropic configuration and the current fields misrepresent product behavior.

## Onboarding

- Preserve the existing four-step high-school flow and three-step non-high-school path.
- Present onboarding as a polished full-height setup experience rather than a floating dashboard card.
- Include clear progress, one question per step, strong labels, and direct Continue/Back actions where supported by existing behavior.
- Current onboarding questions remain unchanged during the visual redesign.
- Future personalization questions may gather school hours, commute, recurring commitments, bedtime, protected downtime, preferred study duration, and weekly goals.
- New answers must be optional, explain their benefit, and be used only for user-relative Schedule pulse insights.

## Shared components and boundaries

The redesign should consolidate visual behavior without rewriting business logic.

- `AppShell`: responsive navigation, top bar, global actions, and page frame.
- `PageHeader`: page title, description/context, and page-level actions.
- `Button`: primary, secondary, quiet, and destructive variants.
- `TaskRow`: shared presentation for Today, Tasks, and Calendar contexts.
- `FocusPanel`: current task presentation used only where it is the dominant page object.
- `SchedulePulse`: deterministic, user-relative schedule insight.
- `MonthRhythm`: compact monthly density visualization.
- `Dialog` and `SidePeek`: shared overlay semantics, focus management, dismissal, and responsive behavior.
- `EmptyState`, `LoadingState`, and inline error treatment.

Existing components may be adapted rather than replaced when doing so preserves behavior and reduces risk.

## Data flow

- `AppStateProvider` remains the source of tasks, calendars, plans, and user data.
- Today, Tasks, and Calendar derive their views from the same task records.
- Schedule pulse calculations are pure presentation-layer derivations from current state and future optional preference inputs.
- Existing API calls and refresh behavior remain intact.
- The command palette, Console, task chat, and day chat continue using their existing endpoints; only their visibility and presentation change.

## Loading, empty, and error states

- Initial page data uses quiet skeleton rows matching final geometry.
- Buttons show a pending label or spinner and prevent duplicate submission.
- Empty states explain the current condition and offer one relevant action.
- Errors appear close to the failed action, retain user-entered input, and state how to recover.
- Optimistic completion feedback must reconcile with the existing refresh result.

## Accessibility

- Maintain semantic headings and landmarks.
- Every interactive control has an accessible name.
- Focus indicators are at least a visible 2px perimeter with sufficient contrast.
- Modal dialogs trap focus, close on Escape, and restore focus to their trigger.
- Side peeks use appropriate dialog semantics when they block outside interaction.
- Keyboard order follows visual order.
- Sticky elements do not obscure focused controls.
- Primary touch targets are at least 44px where space allows; compact desktop-only controls maintain at least WCAG 2.2 minimum spacing.
- Text and interface controls meet WCAG AA contrast.

## Responsive acceptance criteria

Verify every required route at 1440px, 1024px, 768px, and 390px.

- No unintended horizontal page scrolling.
- Navigation remains usable at every width.
- Calendar does not require two-dimensional page scrolling.
- Side peeks and dialogs remain dismissible and keep their actions visible.
- Long task titles, calendar labels, and notifications truncate or wrap intentionally.
- The current focus remains visually dominant without consuming the entire phone viewport.

## Verification

- Capture before and after screenshots of every route.
- Exercise hover, active, disabled, loading, empty, and error states where safely reproducible.
- Tab through each page and verify visible focus.
- Verify command palette opening and dismissal.
- Verify Add task, complete task, delete confirmation, calendar day peek, and notification panel interactions without altering API or store behavior.
- Run `npx tsc --noEmit`.
- Run `npm run build` and fix blocking build failures.
- Perform a final browser pass at all target widths before completion.

