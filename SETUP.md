# TANGENT setup

This guide covers Groq, environment variables, the Next.js site, and the Raspberry Pi forwarder.

## 1. Groq API key

1. Open [https://console.groq.com](https://console.groq.com) and sign in (or create an account).
2. Go to **API Keys** and create a new key.
3. Copy the key — you will paste it into `.env.local` on your laptop (never commit real keys to git).

## 2. `.env.local` on your laptop

In the **project root** (same folder as `package.json`), create or edit `.env.local`:

```env
GROQ_API_KEY=YOUR_GROQ_API_KEY_HERE
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

- Replace `YOUR_GROQ_API_KEY_HERE` with your real Groq key from console.groq.com.
- For **local development**, keep `NEXT_PUBLIC_BASE_URL` as `http://localhost:3000`. Server routes use this URL when the chat handler calls `/api/voice` and when `/api/voice` calls `/api/tasks`, so it must match how you open the app in the browser.
- If you deploy to a public host later, set `NEXT_PUBLIC_BASE_URL` to your site’s public origin (no trailing slash), e.g. `https://YOUR_PRODUCTION_DOMAIN_HERE`.

Restart `npm run dev` after changing `.env.local`.

## 3. Laptop IP for the Raspberry Pi

The Pi must POST to your laptop on the LAN (not `localhost` from the Pi’s point of view).

**Windows:** open **Command Prompt**, run:

```text
ipconfig
```

Under your active **Wi‑Fi** adapter, find **IPv4 Address** (e.g. `192.168.1.42`). That value is what you put in `raspberry-pi-server.py` as `YOUR_LAPTOP_IP_ADDRESS_HERE` in `TANGENT_URL`.

Firewall: allow inbound TCP **3000** (or whatever port Next uses) from your home network if connections fail.

## 4. Raspberry Pi server

1. Open `raspberry-pi-server.py` in the project root on your **laptop** (for editing), or copy the file to the Pi.
2. Set `TANGENT_URL` to `http://YOUR_LAPTOP_IP_ADDRESS_HERE:3000/api/voice` using the IPv4 from ipconfig.
3. On the Pi, replace the existing `server.py` with this file’s contents (or save as `server.py` if that is what your service runs).
4. Install Flask and requests on the Pi if needed, e.g. `pip install flask requests`.

## 5. Run the website (laptop)

From the project root:

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:3000`).

## 6. SSH into the Raspberry Pi and restart services

1. From your laptop: `ssh YOUR_PI_USERNAME_HERE@YOUR_PI_IP_ADDRESS_HERE` (use your Pi user and IP).
2. After updating `server.py` (or `raspberry-pi-server.py` renamed to `server.py`), restart whatever runs Flask — for example:
   - If you run it manually: stop the old process (Ctrl+C), then `python3 server.py` again.
   - If you use **systemd**, reload and restart the unit your project uses, e.g. `sudo systemctl restart YOUR_SERVICE_NAME_HERE`.

Ensure the Pi can reach `http://YOUR_LAPTOP_IP:3000` while `npm run dev` is running on the laptop.

## Quick checklist

- [ ] `GROQ_API_KEY` set in `.env.local`
- [ ] `NEXT_PUBLIC_BASE_URL` matches how you run the app (`http://localhost:3000` for dev)
- [ ] `npm run dev` running on the laptop
- [ ] Pi `TANGENT_URL` uses the laptop **LAN** IP, not `localhost`
- [ ] Pi Flask server restarted after edits

## Data storage — set this up before anyone uses the app

All app data (tasks, calendars, plans, chats, and everything on **Path**) is
stored per workspace in a shared key-value store, through `lib/kv.ts` and
`lib/workspace.ts`.

### Why this exists

It used to live in memory on the server, hanging off Node's `global`. On Vercel
that was two bugs at once:

- **Every instance had its own copy.** Twelve identical requests in one second
  could return your tasks or an empty workspace depending on which instance
  answered. Data appeared and disappeared as you clicked.
- **There was only one of it, shared by everyone.** No cookie, no session, no
  user id existed anywhere, so two people using the app edited the same tasks.

### Setting up the store (required for production)

1. In the Vercel dashboard for this project, open **Storage → Marketplace** and
   add **Upstash Redis** (the free tier is plenty — this stores a few KB per
   person).
2. Connect it to the project. Vercel injects the credentials automatically.
   `lib/kv.ts` accepts either naming:
   - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
   - `KV_REST_API_URL` + `KV_REST_API_TOKEN`
3. Redeploy.
4. Confirm it with `GET /api/health` — it must report `"storage":"redis"` and
   `"shared":true`. Hit it a few times: every response should show the same
   counts.

**Until those variables are set, production falls back to a per-instance file in
`/tmp` and the vanishing-data bug is back.** The server logs an error on boot
when that happens, and `/api/health` reports `"storage":"file"`.

Locally you need none of this: with no credentials set, the store is a JSON file
at `./.tangent-data/kv.json` (gitignored), or `TANGENT_DATA_DIR` if you set it.
That is single-process only — fine for `npm run dev`, never for production.

### Workspaces

`middleware.ts` gives each browser a random `tangent_ws` cookie, and that id is
the key the workspace is stored under. A client with no cookie jar (the pen, a
script) can name its workspace with an `x-tangent-workspace` header instead.

This is a workspace, not an account: whoever holds the cookie is that workspace,
and clearing cookies starts an empty one. It is the foundation for real accounts
rather than a substitute — when you add login, map the user to a workspace id and
everything downstream keeps working. Note that `/api/state` is still
unauthenticated; it is now scoped to the caller's own workspace, so it can only
read or replace their data, but a login is what makes that a real guarantee.

Reads never write, so the app's polling can't race an edit. Two *mutations* to
the same workspace at the same instant are last-write-wins on the whole
workspace; with one person per workspace that has not been an issue, but it is
the thing to fix first if workspaces ever become shared.

## Path and the Anthropic key

`/path` drafts branches with `ANTHROPIC_API_KEY`. Without it, `/api/tangents`
returns 503 with a readable message and the rest of the page still works — you
can add anchors and write your own branches by hand.
