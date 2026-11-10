# TANGENT

TANGENT is a student productivity domain centered on low-friction capture and context-aware planning and follow-through. This glossary keeps product, strategy, hardware, and presentation work aligned on the same language.

## Product

**TANGENT**:
The phone-first student app that turns anything a Student says into small steps on their calendar, then checks in daily until it's done.
_Avoid_: Generic productivity app, AI counselor, calendar app, chatbot

**Web App**:
The software surface that receives captures, combines them with school context, and helps a student organize tasks and plans.
_Avoid_: Dashboard, website, AI assistant when referring to the whole product

**Pen**:
TANGENT's dedicated voice-capture device for moments when using a phone is impractical or unavailable. Paused: not part of the current product or roadmap.
_Avoid_: Smartpen, stylus, AI pen

**Student**:
The high school or college student who owns and uses one TANGENT account.
_Avoid_: Customer, child, family account, general user

**Student plan**:
The paid tier at $4.99 per month or $39 per year. Planned, not built.
_Avoid_: Basic, Plus

**Pro plan**:
The paid tier at $9.99 per month or $79 per year. Planned, not built.
_Avoid_: Premium, Unlimited

**School-Year Pass**:
A $69 pass that parents buy, with a weekly recap the teen approves. Planned, not built.
_Avoid_: Family plan, parent account, annual plan

## Workflow

**Capture**:
A thought, task, deadline, reminder, or note collected with minimal interruption before it is organized.
_Avoid_: Recording when referring to the full captured input

**Action**:
A concrete operation TANGENT proposes or performs after understanding a Capture, such as adding or updating a task or plan.
_Avoid_: Suggestion, automation when no operation occurs

**Today**:
The home screen at `/`, with one capture input and three sections: Must do, Today's plan, and Coming up. Its Goal steps support Done, Not today, and Too big.
_Avoid_: Dashboard, daily brief

**Must do**:
The first section of Today: fixed-time items for today and anything hard overdue.
_Avoid_: Urgent, priorities

**Today's plan**:
The second section of Today: today's Goal steps, each with Done, Not today, and Too big.
_Avoid_: To-do list, schedule

**Coming up**:
The third section of Today: what is due or planned in the next few days.
_Avoid_: Upcoming tasks, later

**Task commitment**:
Whether a task is fixed (a set time), a reminder (a nudge, no time block), or a Goal step (flexible: Tangent may move it). Product copy and the Round 2 brief call this the task's kind; in code it is `task.commitment`, because the existing task `kind` describes the area of work.
_Avoid_: Task type, category

**Goal step**:
A flexible step toward one of the student's goals, usually part of a project; Tangent may move it. Shown as "Goal step" in the task's Type and on previews. In code it is `commitment: "flexible"`. Replaces "Plan step" and "Flexible step" (Round 4). A fixed item due today is a **Must-do**.
_Avoid_: Plan step, flexible step, to-do

**Round**:
About one week of Goal steps (3 to 7) toward a project's goal. Round 1 starts when the project is planned; at about 70% done, or when its week ends, a round review summarises how it went and proposes the next round, which the student confirms. Stored as a `Round — N · started YYYY-MM-DD` line in the project's description. Each step says what it produces as "You'll have: …".
_Avoid_: Sprint, phase, milestone

**Check-in**:
The optional, skippable question after Done: how it went (Nailed it, Okay, Struggled) and how long it took (less, about right, more). Only the codes are logged; the student's own words stay on their step.
_Avoid_: Survey, rating

**Hard overdue**:
A missed deadline or fixed commitment. It stays in Must do until it is done or dismissed.
_Avoid_: Late, failed

**Soft overdue**:
A missed Goal step. It sits calmly at the bottom of Today's plan until it is done or re-planned, never flagged in red.
_Avoid_: Late, failed, missed task

**Push**:
One suggested next step.
_Avoid_: Notification, nudge when referring to the step itself

**Fresh start**:
The button that clears a backlog and rebuilds the plan from now, without penalty.
_Avoid_: Reset, delete all, catch up

**AddFlow**:
The single composer for adding a task or planning a project.
_Avoid_: Quick add, plan chat, project chat

**Home chat**:
The one place a new chat starts: the capture input on Today. Tangent decides first what the words are (an answer, more steps for a project, a new goal to plan, or something for the calendar) and answers in place, under the box. Round 4 removed every side chat panel.
_Avoid_: Ask Tangent, AI console, assistant, chat panel

**Task chat**:
The ask box inside a task's sheet, answering with that task's context. Nothing is saved; closing the sheet ends it.
_Avoid_: Comments, notes

**Project chat**:
The ask box on a project's page, answering with that project's context and steps, and previewing more steps in place. Nothing is saved.
_Avoid_: Plan chat when referring to the project's ongoing chat

**Chats library**:
Retired in Round 4: there is no chat history. `/ai` redirects to Home. Kept here so older documents read correctly.
_Avoid_: History, inbox, AI page

**Tangent (long-range goal)**:
A long-range goal shown as a branching map of possible directions, at `/tangents`. Starting a branch makes it a project. Called "Path" before Round 4; code identifiers still say `path`.
_Avoid_: Path, roadmap, journey

**Ask Tangent**:
Replaced in Round 2 by Home chat and the Chats library. Kept here so older documents read correctly.
_Avoid_: Using it for new work

**Grill me**:
One question at a time that fills gaps in Tangent's context until it has enough to plan. Every question can be skipped, and the Student can stop at any time.
_Avoid_: Survey, onboarding quiz, interview

**Context slot**:
One thing Tangent needs to know to plan a request well, such as the deadline, how much is done, or how long the student can work. Filled from what the student says, what Tangent knows, or a Grill me answer.
_Avoid_: Field, form question

**Sufficiency**:
The test that Tangent knows enough to make a first plan, scored from the filled context slots. Grill me stops asking once it passes.
_Avoid_: Confidence, completeness

**Grill queue**:
A Student's waiting Grill me questions, ordered by how much each answer could change a plan.
_Avoid_: Inbox, question backlog

**Project stats**:
The panel showing a project's progress, pace, next steps, focus, and workload by week.
_Avoid_: Analytics, report, dashboard

**School block card**:
The wide card atop Projects that groups Canvas assignments by course. It is separate from a School Block on the calendar.
_Avoid_: School project, Canvas project, School Block

**School Context**:
The student's fixed schedule, assignments, deadlines, and academic constraints used to judge available time and priority.
_Avoid_: Student profile, school data

**School Block**:
A recurring calendar commitment generated from the student's school days and start and end times.
_Avoid_: Class, event when referring to the full protected school period

**Canvas Feed**:
The student's personal Canvas calendar-feed URL used to import assignment and deadline events without requiring Canvas write access.
_Avoid_: Canvas OAuth, Canvas AI integration

## Decision system

**Council Review**:
An evidence-backed review of one consequential TANGENT decision by independent perspectives before the head task synthesizes a verdict.
_Avoid_: Brainstorm, general advice, routine review

**Resource Preparation**:
The production-only function that turns approved TANGENT context and linked sources into polished deliverables without changing strategy.
_Avoid_: Research, strategy, Council, content discovery
