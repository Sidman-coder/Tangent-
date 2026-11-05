# Manual steps for v3

Everything here has to be done by hand, because the build doesn't touch the Supabase dashboard, Vercel or `.env.local`. Nothing in the app crashes while a step is undone; the note under each step says what stays broken until then.

## 1. Supabase email templates

**Until this is done:** students get a sign-in link with no code in it, so the code boxes are useless. New students get the "Confirm signup" email, not "Magic Link", which is why the code seemed to work only as a sign-up link. Forgot password shows no code at all.

Go to **Supabase dashboard → Authentication → Emails → Templates**. For each of the three templates, paste the subject and body, then click **Save changes**.

### Magic Link

Subject: `Your Tangent code: {{ .Token }}`

```html
<h2>Your Tangent code</h2>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">{{ .Token }}</p>
<p>Type this code on the sign-in page. It works once and expires soon.</p>
<p>Or <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">tap here to sign in</a> on this device.</p>
<p style="color:#666">If you didn't ask for this, you can ignore this email.</p>
```

### Confirm signup

Subject: `Your Tangent code: {{ .Token }}`

```html
<h2>Welcome to Tangent</h2>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">{{ .Token }}</p>
<p>Type this code on the sign-in page to finish setting up your account. It works once and expires soon.</p>
<p>Or <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">tap here to sign in</a> on this device.</p>
<p style="color:#666">If you didn't ask for this, you can ignore this email.</p>
```

### Reset Password

Subject: `Your Tangent password code: {{ .Token }}`

```html
<h2>Reset your Tangent password</h2>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">{{ .Token }}</p>
<p>Type this code in Tangent to choose a new password. It works once and expires soon.</p>
<p>Or <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">tap here to reset it</a> on this device.</p>
<p style="color:#666">If you didn't ask for this, your password hasn't changed and you can ignore this email.</p>
```

**About the link.** These templates use the `token_hash` link rather than `{{ .ConfirmationURL }}`. It's the link format `lib/auth/redirect.ts` and `/auth/callback` already expect. `{{ .ConfirmationURL }}` comes back with a one-time exchange code, and that needs a browser secret which the server-side send doesn't save (read from the code, not tested against live Supabase). If a tapped link fails after this change, swap the `href` for `{{ .ConfirmationURL }}` and tell me which one worked.

**Check it:** on `/signin`, Email code tab, send a code to an existing invited address and to a new invited address. Both emails show 6 digits. Both codes sign in. Both links sign in.

## 2. Custom SMTP before the pilot

**Until this is done:** Supabase's built-in sender allows only a few emails per hour across the whole project and isn't meant for real use. A class of students signing in together will hit "Too many emails", and that message comes from this limit.

Go to **Authentication → Emails → SMTP Settings**, turn on **Enable Custom SMTP**, and enter the host, port, username and password from a provider such as Resend or Postmark, with a sender address on your own domain. Click **Save changes**. Then raise the limit at **Authentication → Rate Limits → Rate limit for sending emails**.

**Check it:** send a code from `/signin` and look at the email's sender. It should show your own address.

## 3. Run the Grill me migration

**Until this is done:** the Grill me queue reads empty. Tangent queues no questions, so nothing appears on Today, under a confirmed preview, or in Settings. The server logs a warning. Everything else works.

1. In your editor, open `supabase/migrations/20261103000000_grill_questions.sql` and copy the whole file.
2. Go to **Supabase dashboard → SQL Editor → New query**.
3. Paste it and click **Run**. You should see "Success. No rows returned". It's safe to run twice.

Dev, Preview and Production share one Supabase project, so you only run this once.

This migration needs the `plans` table. If it fails because `plans` doesn't exist, older files in `supabase/migrations/` haven't been run yet. Run those first, oldest first. I can't see from here which ones have been applied.

**Check it:** go to **Table Editor** and look for `grill_questions`. Then add a project in the app. **Settings → Onboarding → Grill me** should list questions about it.

## 4. Environment variables

**v3 adds no new variables.** There's nothing to add to `.env.local` or Vercel.

The one to know for testing is `TANGENT_PIPELINE_V2`. It's off unless set to `true` or `1`, and the server reads it once at startup.

To test with it off on your computer:

1. In `.env.local`, set `TANGENT_PIPELINE_V2=false`.
2. Stop and restart `npm run dev`.
3. When you're done, set it back to `true` and restart again.

On Vercel, the value is at **Project → Settings → Environment Variables**. A change only applies after you redeploy.

**Check it:** with it off, a typed "add math homework tomorrow" still saves the task, and the AI activity section disappears from Settings.

## 5. Tests that need a real phone

**Why by hand:** these need a real microphone, a real finger and a real signed-in account, and the build could only test in a browser without them.

The microphone only works on an `https` address, so your computer's `http://` address won't work on a phone. This branch hasn't been pushed, so it has no Vercel Preview link yet. Push it first, then open the Preview link on your phone and sign in with an invited account.

1. **Mic permission.** On iPhone Safari, open the home screen and tap the mic. Allow the microphone when asked. Listening should start, or start on the next tap. If you tap Don't Allow, you should get a message rather than a dead button.
2. **Live words.** Tap the mic and talk for 15 seconds. Your words should appear as you speak and the task should be saved when you stop.
3. **Long-press.** On Today, hold the floating mic. Capture should open already listening, and a tap should stop it. Text selection or the iOS callout menu shouldn't appear. Repeat on an Android phone if you have one.
4. **Question cards.** Say something vague, like "get better at chess". Cards should show "1 of N", with Skip and Answer later, and stop after 3 in a row.
5. **Mini week.** Confirm a plan with several steps. The preview's week view should fit the screen with no sideways scrolling, and Edit should switch to the list.
6. **Phone width.** Go through Today, Calendar, Projects, School (only if Canvas is connected), one project, the AI page and Settings. Nothing should scroll sideways, and every button should be easy to tap.

## Today daily loop: test signed in, on a phone

No new migration or variable. The dev preview has no session, so these have not run against a real account yet.

1. Today shows 1-3 steps. Done completes one, and Undo brings it back.
2. Not today on your own step moves it to a later day. Undo puts it back.
3. Not today on a Canvas or repeating step removes it from Today until tomorrow, and its date does not change. Confirm the card disappears right away.
4. Too big shows 2-3 smaller steps. Keep as is changes nothing. Use these replaces the step, and Undo restores it.
5. Leave 1-5 steps unfinished on an earlier day, then open Today: they move once, with Undo. Undo, reload, and they should not move again that day.
6. Leave more than 5 unfinished: nothing moves, and Today offers Fresh start.
7. Fresh start says how many steps it will move, moves them only after you confirm, and Undo restores them. Canvas dates stay put.

## Round 2: migrations and signed-in checks

Dev, Preview and Production share one Supabase project. Back up the database before applying these migrations. Apply them in this order through the Supabase SQL Editor; do not run them from the app:

1. `supabase/migrations/20261105000000_task_commitment_type.sql` adds the task commitment and overdue dismissal fields, then classifies unfinished tasks. Until applied, Today uses the same classification rules in code; dismissal lasts only for the current visit and a Type change cannot be saved.
2. `supabase/migrations/20261105010000_project_color.sql` maps existing project colors to the new palette keys. The app can read old hex colors before this runs.
3. `supabase/migrations/20261105020000_profile_week_start.sql` adds the calendar week start preference. The plan preview uses Sunday until the migration is applied or when there is no preference.

On a test account, check the new `/` Today sections and `/capture` mic, including Undo for Done, Not today, Too big, overdue Dismiss, task Type, and project color. Check `/today` redirects to `/`. Repeat in light and dark themes on a phone, including the on-screen keyboard and bottom safe area. These checks need a real signed-in account and have not been verified against the shared Supabase project.
