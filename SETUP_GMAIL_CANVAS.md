# Gmail + Canvas + browser voice setup

This guide covers the new read-only Gmail integration, the read-only Canvas
integration, and the placeholder speech-to-text provider used by the new
browser hold-to-record button. It complements `SETUP.md` (Groq / Pi setup) —
it does not replace it.

## 1. Gmail (read-only)

`lib/gmail.ts` only ever requests the `gmail.readonly` scope and only ever
calls read endpoints. It cannot send or modify email.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project (or pick an existing one).
2. **APIs & Services → Library** → enable **Gmail API**.
3. **APIs & Services → OAuth consent screen** → configure it (External is fine for personal use; add your own Google account as a test user if the app is in "Testing" mode).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Desktop app**.
   - Copy the generated **Client ID** and **Client Secret**.
5. Generate a refresh token scoped to `gmail.readonly`. The easiest way is [Google's OAuth 2.0 Playground](https://developers.google.com/oauthplayground):
   - Click the gear icon → check **Use your own OAuth credentials** → paste your Client ID/Secret.
   - In Step 1, find and select the **Gmail API v1** → `https://www.googleapis.com/auth/gmail.readonly` scope only.
   - Authorize, then in Step 2 click **Exchange authorization code for tokens**.
   - Copy the **Refresh token** shown.
6. In `.env.local`, set:
   ```env
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REFRESH_TOKEN=...
   ```

## 2. Canvas LMS (calendar feed)

Canvas needs no server credentials. Each student connects their own Canvas
Calendar Feed (`.ics`) link in **Settings → Integrations → Connect Canvas**;
TANGENT reads it and imports assignments as tasks. The feed link is stored per
student and never sent back to the browser unmasked.

The old token-based client (`lib/canvas.ts`) has been removed, so
`CANVAS_API_TOKEN` and `CANVAS_BASE_URL` are no longer used and can be deleted
from `.env.local`.

## 3. Browser voice button transcription (Deepgram placeholder)

The new hold-to-record button (`components/VoiceRecordButton.tsx`) posts
recorded audio to `app/api/voice-browser/route.ts`, which transcribes it via
`lib/deepgram.ts` (Deepgram's `nova-2` model) before handing the text to the
same shared handler (`lib/voice-handler.ts`) used by the Raspberry Pi pen.

**This was added as a placeholder per your request — no working Deepgram key
is configured yet.** To make it work:

1. Get an API key from [console.deepgram.com](https://console.deepgram.com).
2. In `.env.local`, set:
   ```env
   DEEPGRAM_API_KEY=...
   ```

### To swap Deepgram for a different provider later

All the provider-specific code lives in one place:
`lib/deepgram.ts`'s `transcribeAudio(audioBuffer, mimeType)` function. Nothing
else references Deepgram directly — `app/api/voice-browser/route.ts` just
calls `transcribeAudio(...)` and gets back a plain string.

To switch providers (e.g. to Groq Whisper or OpenAI Whisper), replace the body
of `transcribeAudio` in `lib/deepgram.ts` with a call to the new provider's
API, keeping the same signature (`(audioBuffer: Buffer, mimeType: string) => Promise<string>`).
You may also want to rename the file, but that's optional — only the import
in `app/api/voice-browser/route.ts` would need to change.

## Quick checklist

- [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` set in `.env.local` (Gmail, read-only)
- [ ] `DEEPGRAM_API_KEY` set in `.env.local` (or swap the provider in `lib/deepgram.ts` — see above)
- [ ] `npm run dev` restarted after editing `.env.local`
