# DeepShield — Deepfake & AI-Generated Media Detection

DeepShield is a web platform for detecting deepfake and AI-generated images/videos, built as a deepfake-reporting workflow demo modeled loosely on a government cyber-crime reporting pipeline. It combines real AI detection (via Sightengine) with a tamper-evident evidence chain, case management, and an escalation flow.

**Live demo:** [deep-shieldx.vercel.app](https://deep-shieldx.vercel.app)

---

## Features

- **AI-powered detection** — uploaded images/videos are analyzed using the [Sightengine](https://sightengine.com) API, running both the **Deepfake** (face swap / manipulation) model and the **GenAI** (DALL-E / Midjourney / Stable Diffusion) model, returning real confidence scores for each.
- **Case management** — every detection creates a case with a unique ID, severity rating, and status (`pending` → `under_review` → `escalated` / `resolved`).
- **Persistent storage** — cases are stored in [Vercel KV](https://vercel.com/docs/storage/vercel-kv) (Upstash Redis under the hood), so data survives across serverless cold starts and redeploys.
- **Evidence chain** — each case has a SHA-256 hash chain (similar in spirit to a blockchain) recording every action taken on it (creation, report filed, escalation). Any tampering with the record breaks the chain and is detectable.
- **Report & escalate flow** — flagged media can be reported with a description/location, then escalated with a mock government reference number, simulating a hand-off to a cyber-crime authority.
- **Dashboard** — live stats (total scans, fakes found, escalated, resolved) and a 7-day activity chart.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Single-page HTML/CSS/JS (no framework) |
| Backend | Node.js + Express, deployed as a Vercel serverless function |
| File handling | Multer (in-memory storage — required for serverless) |
| Detection | [Sightengine](https://sightengine.com) Deepfake + GenAI models |
| Data storage | [Vercel KV](https://vercel.com/docs/storage/vercel-kv) (Upstash Redis) — persistent across cold starts/redeploys |
| Hosting | Vercel |

---

## Project Structure

```
.
├── api/
│   └── index.js        # Express app — all backend logic, exported (no app.listen())
├── index.html           # Frontend — single page, vanilla JS
├── package.json
├── package-lock.json
└── vercel.json          # Routes /api/* to the serverless function
```

---

## Setup & Deployment

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
npm install
```

### 2. Get Sightengine API credentials

Create a free account at [sightengine.com](https://sightengine.com) (free tier includes 1,000 checks/month) and grab your **API User** and **API Secret** from the dashboard.

### 3. Set up Vercel KV (persistent storage)

1. In your Vercel project, go to **Storage** → create an **Upstash** Redis database (this is what backs Vercel KV now).
2. Connect it to your project — Vercel will auto-inject the required env vars (`KV_REST_API_URL`, `KV_REST_API_TOKEN`, etc.) into **Production** and **Preview** environments.
3. No manual `.env` setup needed for these — they're managed by the integration.

### 4. Set environment variables

This project expects:

| Variable | Description | Source |
|---|---|---|
| `SE_USER` | Sightengine API user | Sightengine dashboard |
| `SE_SECRET` | Sightengine API secret | Sightengine dashboard |
| `KV_REST_API_URL` | Vercel KV / Upstash REST URL | Auto-added by KV integration |
| `KV_REST_API_TOKEN` | Vercel KV / Upstash REST token | Auto-added by KV integration |

**Locally:** create a `.env` file (already gitignored) with the Sightengine values. If you want KV to work locally too, copy the `KV_*` values from Vercel's dashboard into your local `.env` as well.

**On Vercel:** `SE_USER`/`SE_SECRET` must be added manually under **Project → Settings → Environment Variables**. `KV_*` vars are added automatically when you connect the Upstash database. Do not commit a `.env` file — Vercel does not read it from your repo for security reasons.

### 5. Deploy

Push to your connected GitHub repo — Vercel will auto-deploy on every push to `main`.

```bash
git add .
git commit -m "Deploy DeepShield"
git push
```

---

## Known Limitations

- **This is a demo/prototype**, not a production cyber-crime reporting tool. The "government escalation" feature generates a realistic-looking but entirely mock reference number — it does not contact any real authority or government system.
- **Serverless constraints:** this backend is built for Vercel's serverless model — no persistent local filesystem, no long-running process. File uploads are handled in memory rather than written to disk, since a serverless filesystem can't be relied on between requests.
- **Cold starts:** the first request after a period of inactivity can take a few seconds while the serverless function spins up and reconnects to KV. Subsequent requests are fast until the function goes idle again.
- **Detection accuracy** depends entirely on Sightengine's underlying models — this project does not implement its own detection model.

---

## License

This project is licensed under the MIT License — see below.

```
MIT License

Copyright (c) 2026 Palak Thakur

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
