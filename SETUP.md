# TANGENT setup

This guide covers environment variables, the Next.js site, and the Raspberry Pi forwarder.

## 1. `.env.local` on your laptop

In the **project root** (same folder as `package.json`), create or edit `.env.local`. The full list of variables — which are secret, which are required, and which Vercel environments need them — lives in [docs/tangent/PROJECT.md → Environment variables](docs/tangent/PROJECT.md#environment-variables). At minimum you need the two `NEXT_PUBLIC_SUPABASE_*` values, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` and `ALLOWED_EMAILS`. Never commit real keys to git.

`GROQ_API_KEY` and `NEXT_PUBLIC_BASE_URL` are no longer used; delete them if present.

Restart `npm run dev` after changing `.env.local`.

## 2. Laptop IP for the Raspberry Pi

The Pi must POST to your laptop on the LAN (not `localhost` from the Pi’s point of view).

**Windows:** open **Command Prompt**, run:

```text
ipconfig
```

Under your active **Wi‑Fi** adapter, find **IPv4 Address** (e.g. `192.168.1.42`). That value is what you put in `raspberry-pi-server.py` as `YOUR_LAPTOP_IP_ADDRESS_HERE` in `TANGENT_URL`.

Firewall: allow inbound TCP **3000** (or whatever port Next uses) from your home network if connections fail.

## 3. Raspberry Pi server

1. Open `raspberry-pi-server.py` in the project root on your **laptop** (for editing), or copy the file to the Pi.
2. Set `TANGENT_URL` to `http://YOUR_LAPTOP_IP_ADDRESS_HERE:3000/api/voice` using the IPv4 from ipconfig.
3. On the Pi, replace the existing `server.py` with this file’s contents (or save as `server.py` if that is what your service runs).
4. Install Flask and requests on the Pi if needed, e.g. `pip install flask requests`.

## 4. Run the website (laptop)

From the project root:

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:3000`).

## 5. SSH into the Raspberry Pi and restart services

1. From your laptop: `ssh YOUR_PI_USERNAME_HERE@YOUR_PI_IP_ADDRESS_HERE` (use your Pi user and IP).
2. After updating `server.py` (or `raspberry-pi-server.py` renamed to `server.py`), restart whatever runs Flask — for example:
   - If you run it manually: stop the old process (Ctrl+C), then `python3 server.py` again.
   - If you use **systemd**, reload and restart the unit your project uses, e.g. `sudo systemctl restart YOUR_SERVICE_NAME_HERE`.

Ensure the Pi can reach `http://YOUR_LAPTOP_IP:3000` while `npm run dev` is running on the laptop.

## Quick checklist

- [ ] Required variables from the PROJECT.md env table set in `.env.local`
- [ ] `npm run dev` running on the laptop
- [ ] Pi `TANGENT_URL` uses the laptop **LAN** IP, not `localhost`
- [ ] Pi Flask server restarted after edits

## Path and the Anthropic key

`/path` drafts branches with `ANTHROPIC_API_KEY`. Without it, `/api/path`
returns 503 with a readable message and the rest of the page still works — you
can add anchors and write your own branches by hand.
