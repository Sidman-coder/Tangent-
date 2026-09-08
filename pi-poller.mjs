// pi-poller.mjs
// Run this with: node pi-poller.mjs
// It polls the Pi Flask server every 2 seconds and forwards NEW captures to TANGENT
// On startup it fetches existing captures and skips them to avoid replaying old commands

const FLASK_URL = "http://172.20.10.3:5000/captures-json"
const TANGENT_URL = "http://localhost:3000/api/voice"
const POLL_INTERVAL = 2000

let lastSeenId = -1
let initialized = false

async function initialize() {
  try {
    console.log("Pi poller initializing - fetching existing captures to skip them...")
    const res = await fetch(FLASK_URL)
    if (res.ok) {
      const data = await res.json()
      if (data.captures && data.captures.length > 0) {
        // Set lastSeenId to highest existing ID so we skip all old captures
        lastSeenId = Math.max(...data.captures.map(c => c.id))
        console.log("Found", data.captures.length, "existing captures. Skipping all. Last ID:", lastSeenId)
      } else {
        console.log("No existing captures found. Starting fresh.")
        lastSeenId = -1
      }
    }
  } catch (err) {
    console.error("Could not reach Pi during init:", err.message)
    lastSeenId = -1
  }
  initialized = true
  console.log("Pi poller ready. Waiting for NEW voice commands only...")
}

async function poll() {
  if (!initialized) return

  try {
    const res = await fetch(FLASK_URL)
    if (!res.ok) return
    const data = await res.json()

    const newCaptures = data.captures.filter(c => c.id > lastSeenId)

    for (const capture of newCaptures) {
      console.log("NEW voice command from Pi:", capture.text)

      try {
        const voiceRes = await fetch(TANGENT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: capture.text })
        })
        const voiceData = await voiceRes.json()
        console.log("TANGENT response:", JSON.stringify(voiceData))
      } catch (err) {
        console.error("Could not reach TANGENT:", err.message)
      }

      lastSeenId = Math.max(lastSeenId, capture.id)
    }
  } catch (err) {
    console.error("Could not reach Pi:", err.message)
  }
}

console.log("Starting TANGENT Pi Poller...")
console.log("Flask URL:", FLASK_URL)
console.log("TANGENT URL:", TANGENT_URL)

// Initialize first then start polling
initialize().then(() => {
  setInterval(poll, POLL_INTERVAL)
})
