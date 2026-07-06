# DeepShield — Deepfake & AI-Generated Media Detection

DeepShield is a web platform for detecting deepfake and AI-generated images/videos, built as a deepfake-reporting workflow demo modeled loosely on a government cyber-crime reporting pipeline. It combines real AI detection (via Sightengine) with a tamper-evident evidence chain, case management, and an escalation flow.

**Live demo:** [deep-shieldx.vercel.app](https://deep-shieldx.vercel.app)

---

## Features

- **AI-powered detection** — uploaded images are analyzed using the [Sightengine](https://sightengine.com) Deepfake Detection API, returning a real confidence score.
- **Case management** — every detection creates a case with a unique ID, severity rating, and status (`pending` → `under_review` → `escalated` / `resolved`).
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
| Detection | [Sightengine](https://sightengine.com) Deepfake API |
| Data storage | In-memory store on the backend (resets on cold start/redeploy) |
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

### 3. Set environment variables

This project expects:

| Variable | Description |
|---|---|
| `SE_USER` | Sightengine API user |
| `SE_SECRET` | Sightengine API secret |

**Locally:** create a `.env` file (already gitignored) with these values.

**On Vercel:** add them under **Project → Settings → Environment Variables**. Do not commit a `.env` file — Vercel does not read it from your repo for security reasons.

### 4. Deploy

Push to your connected GitHub repo — Vercel will auto-deploy on every push to `main`.

```bash
git add .
git commit -m "Deploy DeepShield"
git push
```

---

## Known Limitations

- **Cases are stored in memory, not a database.** This means case data can be lost when the serverless backend cold-starts (e.g., after a period of inactivity or a new deployment). This is fine for demo purposes but not suitable for production use without adding a persistent store.
- **This is a demo/prototype**, not a production cyber-crime reporting tool. The "government escalation" feature generates a realistic-looking but entirely mock reference number — it does not contact any real authority or government system.
- **Serverless constraints:** this backend is built for Vercel's serverless model — no persistent local filesystem, no long-running process. File uploads are handled in memory rather than written to disk, since a serverless filesystem can't be relied on between requests.
- **Detection accuracy** depends entirely on Sightengine's underlying model — this project does not implement its own detection model.

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
