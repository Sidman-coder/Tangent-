# TANGENT Project

Last reconciled: 2026-09-20

## Identity

**One-line pitch:** TANGENT is an AI-powered productivity system for high school students—a web app paired with a custom voice-recording pen—built for the moments when a phone cannot be there to capture a thought.

**Tagline:** Say it. Capture it. Build it.

**Mission:** Make capture frictionless, then use the student's real school context to turn captured thoughts into organized, actionable work.

**Primary audience:** High school students balancing classes, extracurriculars, sports, and personal projects. TANGENT is intentionally not positioned as productivity software for everyone.

## Product boundary

TANGENT has two connected products:

1. **Web App:** receives typed or spoken captures, understands tasks and constraints, and helps the student plan and reprioritize.
2. **Pen:** a dedicated voice-capture device for classrooms, transitions, activities, and other moments when pulling out a phone is impractical.

The product is not an AI counselor, therapy product, family surveillance system, or autonomous school decision-maker. TANGENT may help a student understand workload and priorities without adopting those categories.

## Team

- **Sid:** software lead; web app, AI pipeline, integrations, and product direction.
- **Juann:** hardware co-builder; prototype pen and production-intent hardware workstream.

## Current software state

The repository is a Next.js 14 and TypeScript application. Current code and user-provided context establish the following:

- A first-run onboarding flow collects the student's name, whether they are a high school student, and school days and hours. It generates recurring School Blocks.
- The application includes task, calendar, AI-console, settings, daily-brief, notification, planning, rescheduling, and voice-command surfaces.
- Gmail and Google Calendar modules are designed for read-only access. Their deployed connection and production readiness have not been verified in this context review.
- Current work adds a per-user Canvas `.ics` calendar-feed connection for assignment and deadline events. A legacy read-only Canvas token client also remains in the repository; do not describe that older path as the intended student onboarding flow.
- Application data is stored in process memory and survives development hot reloads, but resets when the server process restarts. There is no persistent production database yet.
- The application assumes one student per account. A parent or family shared-login model is outside the current scope.

### AI and voice providers

The codebase is transitional rather than single-provider:

- Anthropic Claude handles major reasoning and tool-use flows in the current application.
- OpenAI helper code exists for command and chat parsing paths.
- Groq supports an earlier Raspberry Pi voice-command path.
- Deepgram transcription exists as an unconfigured browser-voice integration stub and requires configuration before it works.

Do not claim that any one provider exclusively powers all TANGENT intelligence without rechecking the current code.

## Current hardware state

- **Prototype direction:** XIAO ESP32-S3 Sense, used to validate voice capture and end-to-end communication.
- **Production-intent direction:** a custom PCB centered on the ESP32-S3-MINI-1U-N8 module.
- **Sequence:** validate the software experience before investing deeply in custom hardware and manufacturing.

The repository contains a Raspberry Pi forwarding path, but the exact current physical prototype, enclosure, battery, microphone, button, storage, and radio configuration have not been verified here.

## Strategic shift

TANGENT narrowed from a general productivity concept to high school students. That focus moved school-specific foundations ahead of broad polish and custom hardware: onboarding-generated School Blocks, Canvas deadline ingestion, and recurring schedules became prerequisites rather than optional integrations.

This shift is a central product lesson: a narrow audience becomes defensible when the roadmap is rebuilt around that audience's non-negotiable constraints.

## Roadmap order

1. Finish and demonstrate the software.
2. Deploy the web app to Vercel.
3. Replace process-memory storage with persistent storage; Supabase is the current candidate, not a locked decision.
4. Complete an end-to-end ESP32 prototype.
5. Design and validate the production-intent custom PCB.
6. Expand the AI agent pipeline from capture through understanding to safe action.

## Confirmed operating decisions

- Focus on high school students rather than general productivity users.
- Keep one student per account for the first version.
- Build software first and custom hardware second.
- Use read-only school and communication integrations unless the user deliberately approves broader permissions.
- Avoid the AI-counselor category and its expectations.
- Use Council Reviews only for consequential decisions, not routine work.
- Keep Resource Preparation production-only and separate from research and strategy.

## Evidence status

The following remain assumptions or unknowns until supported by research, tests, or user confirmation:

- Number of active users, retention, or demonstrated willingness to pay.
- Which capture situations students experience most often and how frequently.
- Whether a dedicated Pen is meaningfully better than phone, watch, earbuds, or school-device capture.
- School policy, privacy, consent, and recording constraints across target schools.
- Final hardware form factor, battery life, microphone performance, unit cost, and manufacturing partner.
- Pricing, buyer, distribution channel, and business model.
- Exact deployment readiness of each integration.
- Competition, grant, funding, or fellowship eligibility and deadlines.

## Open questions

- What single use case creates the strongest repeated demand: assignment capture, reminders, project ideas, schedule changes, or something else?
- Is the student the buyer, or does adoption depend on parents, schools, programs, or another sponsor?
- What evidence is required before the Pen advances from prototype to custom PCB?
- Which actions may TANGENT take automatically, and which require confirmation?
- What is the minimum privacy and consent model for classroom voice capture?
- Which product metric best proves value before expanding scope?
