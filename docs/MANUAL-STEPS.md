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
