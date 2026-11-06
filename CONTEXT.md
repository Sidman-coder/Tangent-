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
The home screen at `/`, with one capture input and three sections: Must do, Today's plan, and Coming up. Its flexible plan steps support Done, Not today, and Too big.
_Avoid_: Dashboard, daily brief

**Must do**:
The first section of Today: fixed-time items for today and anything hard overdue.
_Avoid_: Urgent, priorities

**Today's plan**:
The second section of Today: today's flexible plan steps, each with Done, Not today, and Too big.
_Avoid_: To-do list, schedule

**Coming up**:
The third section of Today: what is due or planned in the next few days.
_Avoid_: Upcoming tasks, later

**Task commitment**:
Whether a task is fixed (a set time), a reminder (a nudge, no time block), or a flexible plan step (Tangent may move it). Product copy and the Round 2 brief call this the task's kind; in code it is `task.commitment`, because the existing task `kind` describes the area of work.
_Avoid_: Task type, category

**Hard overdue**:
A missed deadline or fixed commitment. It stays in Must do until it is done or dismissed.
_Avoid_: Late, failed

**Soft overdue**:
A missed flexible step. It sits calmly at the bottom of Today's plan until it is done or re-planned, never flagged in red.
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
The one place a new chat starts: the capture input on Today.
_Avoid_: Ask Tangent, AI console, assistant

**Task chat**:
A chat attached to one task, with that task's context. Opened from the task.
_Avoid_: Comments, notes

**Project chat**:
A chat attached to one project, with that project's context and steps. Opened from the project.
_Avoid_: Plan chat when referring to the project's ongoing chat

**Chats library**:
The list of every chat (Home, task and project) with running summaries, at `/ai`.
_Avoid_: History, inbox, AI page

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
