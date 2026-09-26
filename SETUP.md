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

## Data storage — read this before you rely on it

All app data (tasks, calendars, plans, chats, and everything on **Path**) lives
in memory on the server, in `lib/store.ts`. `lib/persist.ts` snapshots it to
JSON so a restart doesn't wipe your workspace.

Where the snapshot lands, in order:

1. `TANGENT_DATA_DIR`, if you set it
2. `./.tangent-data/store.json` when the working directory is writable — this is
   the local dev case, and it's gitignored
3. the OS temp directory, otherwise

**This is not a database, and it is not durable in production.** On Vercel the
only writable path is `/tmp`, which is per-instance and cleared regularly, so
two requests can land on different instances and see different data. It gives
you durability across local restarts and nothing more.

Before real users touch this, the store needs a proper backend — Vercel
Postgres or Vercel KV are the shortest paths, and `lib/persist.ts` is the only
file that has to change: replace `loadSnapshot` and the writer in
`startAutosave` with reads and writes against that store.

## Path and the Anthropic key

`/path` drafts branches with `ANTHROPIC_API_KEY`. Without it, `/api/tangents`
returns 503 with a readable message and the rest of the page still works — you
can add anchors and write your own branches by hand.
