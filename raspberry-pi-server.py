# =============================================================================
# TANGENT Raspberry Pi server — runs ON THE RASPBERRY PI, not on your laptop.
# =============================================================================
# 1. Replace YOUR_LAPTOP_IP_ADDRESS_HERE below with your laptop's LAN IPv4
#    (Windows: open Command Prompt, run ipconfig, use "IPv4 Address" under Wi‑Fi).
# 2. This file replaces server.py on the Pi: SSH into the Pi, copy this file over
#    server.py (or save as server.py), then restart your Flask / pen capture service.
# 3. On the laptop, run the Next.js site: npm run dev (default port 3000).
# =============================================================================

from flask import Flask, request, jsonify, render_template_string
import requests as http_requests

app = Flask(__name__)
captures = []
next_id = [0]

# REPLACE THIS WITH YOUR LAPTOP IP ADDRESS
# To find your laptop IP open Command Prompt and type ipconfig
# Look for IPv4 Address under your WiFi adapter
TANGENT_URL = "http://YOUR_LAPTOP_IP_ADDRESS_HERE:3000/api/voice"

HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Tangent Pen</title>
    <meta http-equiv="refresh" content="3">
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 60px auto; background: #0a0a0a; color: #e5e5e5; padding: 0 20px; }
        h1 { color: #7c3aed; font-size: 24px; }
        .capture { background: #111111; padding: 18px 20px; margin: 10px 0; border-radius: 8px; border: 1px solid #2a2a2a; font-size: 18px; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
        .capture span { flex: 1; }
        .delete-btn { background: #7c3aed; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; }
        .empty { color: #a3a3a3; font-style: italic; }
        .status { font-size: 13px; color: #a3a3a3; margin-top: 24px; }
    </style>
</head>
<body>
    <h1>TANGENT Pen Captures</h1>
    {% if captures %}
        {% for c in captures %}
        <div class="capture" id="cap-{{ c.id }}">
            <span>{{ c.text }}</span>
            <button class="delete-btn" onclick="del({{ c.id }})">Delete</button>
        </div>
        {% endfor %}
    {% else %}
        <p class="empty">No captures yet. Hold the button and speak.</p>
    {% endif %}
    <p class="status">Page refreshes every 3 seconds automatically.</p>
    <script>
        function del(id) {
            fetch('/delete/' + id, { method: 'POST' })
            .then(r => r.json())
            .then(() => { var el = document.getElementById('cap-' + id); if (el) el.remove(); });
        }
    </script>
</body>
</html>
"""


@app.route("/")
def index():
    return render_template_string(HTML, captures=list(reversed(captures)))


@app.route("/capture", methods=["POST"])
def capture():
    data = request.get_json()
    text = data.get("text", "").strip()
    if text:
        captures.append({"id": next_id[0], "text": text})
        next_id[0] += 1
        print(f"Capture received: {text}")

        # Forward transcribed text to TANGENT website
        try:
            response = http_requests.post(
                TANGENT_URL,
                json={"text": text},
                timeout=10
            )
            print(f"Sent to TANGENT website: {response.status_code}")
        except Exception as e:
            print(f"Could not reach TANGENT website: {e}")
            print(f"Make sure your laptop is running npm run dev")
            print(f"And that TANGENT_URL is set to your laptop IP address")

    return jsonify({"status": "ok"})


@app.route("/delete/<int:capture_id>", methods=["POST"])
def delete(capture_id):
    global captures
    captures = [c for c in captures if c["id"] != capture_id]
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
