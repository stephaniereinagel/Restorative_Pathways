# Restorative Pathways (PWA)

Mobile-friendly, offline-first Restorative Pathways app (people → sessions → pathways → restoration runner), with an optional in-app AI assistant.

## Run locally

```bash
cd restorative-pathways
npm install
npm run dev
```

Then open the printed URL:
- On your laptop: `http://localhost:5173`
- On your iPhone (same Wi‑Fi): use your laptop’s LAN IP, e.g. `http://192.168.1.50:5173`

## “Install” on iPhone (Add to Home Screen)

1. Open the app in Safari on your iPhone.
2. Tap Share → **Add to Home Screen**.

Tip: for the most “app-like” install/offline behavior, run a production build:

```bash
npm run build
npm run preview -- --host
```

## Optional: Local AI proxy (recommended for multi-device use)

Instead of storing an API key on each device, you can run a tiny local proxy on your computer.
Your phone uses AI through your computer over Wi‑Fi; the API key stays only on your computer.

Run this in one terminal:

```bash
cd restorative-pathways
export OPENAI_API_KEY="YOUR_KEY_HERE"
npm run ai-proxy
```

Run the app in a second terminal:

```bash
npm run dev
```

Then open the app on your phone via your LAN IP (same Wi‑Fi), e.g. `http://192.168.68.116:5173/`.

### Optional: Framework guide file (improves AI alignment + in-app Guide)

If you copy your canonical framework guide into:

`public/rp/framework_guide.txt`

Then the app will show it under the **Guide** tab, and the local AI proxy will automatically pull relevant excerpts
from it to keep AI answers aligned with your framework posture.

## Where your data is stored

Data is stored **locally in the browser on the device you’re using** (IndexedDB).
- Using it on your iPhone stores data on your iPhone.
- Using it on your laptop stores data on your laptop.

Use **Settings → Export JSON** and **Import JSON** to back up or move data between devices.

## Selah — AI Practitioner Agent

**Selah** (Hebrew: "pause and reflect") is an AI Practitioner for Restorative Pathways. When you run a session in Cursor Agent mode, the agent adopts this role and follows the full protocol: orientation, domain sweep, pathway identification, restoration, and session closure.

### How to run a session

1. Open this project in Cursor.
2. Open a chat and address the agent as Selah, or say "Run a session" / "Perform a session."
3. Provide the subject (person name) and topic/reason.
4. The agent reads the person file from `selah/people/`, traverses the pathway catalog, and writes the session to `selah/sessions/YYYY-MM-DD-name-topic.md`.

### Directory structure

- **`selah/people/`** — Person profiles (markdown). Each file includes basic info, faith preference, notes, and session history.
- **`selah/sessions/`** — Session notes (markdown). Each file includes domain sweep, primary collection, restoration, and follow-up.
- **`.cursor/rules/rp-practitioner-agent.mdc`** — The Selah agent definition and protocol used by Cursor Agent mode.
