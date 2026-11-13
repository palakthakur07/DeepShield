# DeepShield: Deepfake and AI-Generated Media Detection

DeepShield is a web platform for detecting deepfake and AI-generated images and videos. It is a demo of a deepfake-reporting workflow, modeled loosely on a government cyber-crime reporting pipeline. It combines real AI detection (via the Sightengine API) with a tamper-evident evidence chain, case management and an escalation flow.

**Live demo:** [deep-shieldx.vercel.app](https://deep-shieldx.vercel.app)

> Built for the EliteHer Hackathon, where it won the **Most Innovative Project** title.

## Features

- **AI-powered detection:** uploaded images and videos are analyzed with the Sightengine API, running both the Deepfake model (face swap and manipulation) and the GenAI model (DALL-E, Midjourney, Stable Diffusion). Each model returns a real confidence score.
- **Case management:** every detection creates a case with a unique ID, a severity rating and a status (`pending`, `under_review`, `escalated`, `resolved`).
- **Persistent storage:** cases are stored in Vercel KV (Upstash Redis), so data survives serverless cold starts and redeploys.
- **Evidence chain:** each case has a SHA-256 hash chain, similar in spirit to a blockchain, that records every action taken on it (creation, report filed, escalation). Any tampering with a record breaks the chain and is detectable.
- **Report and escalate flow:** flagged media can be reported with a description and location, then escalated with a mock government reference number to simulate a hand-off to a cyber-crime authority.
- **Dashboard:** live stats (total scans, fakes found, escalated, resolved) and a 7-day activity chart.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Single-page HTML, CSS and JavaScript (no framework) |
| Backend | Node.js and Express, deployed as a Vercel serverless function |
| File handling | Multer (in-memory storage, required for serverless) |
| Detection | Sightengine Deepfake and GenAI models |
| Data storage | Vercel KV (Upstash Redis) |
| Hosting | Vercel |

## Project Structure

```
.
├── api/
│   └── index.js        # Express app with all backend logic, exported (no app.listen())
├── index.html          # Frontend: single page, vanilla JS
├── package.json
├── package-lock.json
└── vercel.json         # Routes /api/* to the serverless function
```

## How It Works

1. The user uploads an image or video on the frontend.
2. The file is sent to the Express backend, where Multer keeps it in memory (nothing is written to disk).
3. The backend sends the file to Sightengine and receives confidence scores from the Deepfake and GenAI models.
4. A case is created with a unique ID, a severity rating based on the scores and an initial `pending` status. The first entry is added to the case's SHA-256 evidence chain and the case is saved in Vercel KV.
5. The user can report the case and escalate it. Each action adds a new hash-linked entry to the chain.
6. The dashboard reads the stored cases to show the live stats and the 7-day activity chart.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later and npm
- A free [Sightengine](https://sightengine.com) account (the free tier includes 1,000 checks per month)
- A [Vercel](https://vercel.com) account with an Upstash Redis database (Vercel KV)
- The [Vercel CLI](https://vercel.com/docs/cli) for running the project locally: `npm install -g vercel`

## Setup

### 1. Clone and install

```bash
git clone https://github.com/palakthakur07/DeepShield.git
cd DeepShield
npm install
```

### 2. Get Sightengine credentials

Create a free account at [sightengine.com](https://sightengine.com) and copy your **API User** and **API Secret** from the dashboard.

### 3. Set up Vercel KV (persistent storage)

1. In your Vercel project, go to **Storage** and create an **Upstash Redis** database (this is what backs Vercel KV now).
2. Connect it to your project. Vercel automatically adds the required variables (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) to the Production and Preview environments.

### 4. Set environment variables

| Variable | Description | Source |
|---|---|---|
| `SE_USER` | Sightengine API user | Sightengine dashboard |
| `SE_SECRET` | Sightengine API secret | Sightengine dashboard |
| `KV_REST_API_URL` | Vercel KV / Upstash REST URL | Added automatically by the KV integration |
| `KV_REST_API_TOKEN` | Vercel KV / Upstash REST token | Added automatically by the KV integration |

**Locally:** create a `.env` file in the project root (it is already gitignored). Copy the `KV_*` values from your Vercel dashboard (Storage, then your database) if you want persistence to work locally too.

```env
SE_USER=your_sightengine_user
SE_SECRET=your_sightengine_secret
KV_REST_API_URL=your_kv_rest_url
KV_REST_API_TOKEN=your_kv_rest_token
```

**On Vercel:** add `SE_USER` and `SE_SECRET` under **Project, Settings, Environment Variables**. The `KV_*` variables are added when you connect the database. Never commit a `.env` file; Vercel does not read it from your repository.

### 5. Run locally

The backend is a serverless function, so run it with the Vercel CLI instead of `node`:

```bash
vercel dev
```

Open the local URL printed in the terminal (usually `http://localhost:3000`). The first time, the CLI asks you to log in and link the project.

### 6. Deploy

Push to your connected GitHub repository. Vercel deploys automatically on every push to `main`.

```bash
git add .
git commit -m "Deploy DeepShield"
git push
```

## Manual Test Checklist

Use this checklist to verify the main flows after a deploy or a code change.

| Area | What to check | Expected result |
|---|---|---|
| Upload | Upload a normal image | A case is created and both model scores are shown |
| Upload | Upload an AI-generated image | The GenAI score is high and the case is flagged |
| Upload | Upload an unsupported file type | A clear error message, no case created |
| Upload | Submit with no file | A clear error message, no case created |
| Case status | Report a flagged case | Status changes to `under_review` and a chain entry is added |
| Case status | Escalate a reported case | Status changes to `escalated` and a mock reference number is shown |
| Evidence chain | Open a case after several actions | Each entry links to the hash of the previous one |
| Persistence | Reload the page or wait for a cold start | Cases are still listed |
| Dashboard | Create and escalate cases | Stats and the 7-day chart update |

## Troubleshooting

- **Detection fails or returns an error:** check that `SE_USER` and `SE_SECRET` are set and that you have not used up the free monthly quota.
- **Cases disappear after a reload:** the `KV_*` variables are missing or wrong, so check them in your environment.
- **Slow first request:** this is a serverless cold start (see Known Limitations below).

## Known Limitations

- **This is a demo or prototype, not a production cyber-crime reporting tool.** The government escalation feature generates a realistic-looking but entirely mock reference number. It does not contact any real authority or government system.
- **Serverless constraints:** the backend is built for Vercel's serverless model, with no persistent local filesystem and no long-running process. File uploads are handled in memory because a serverless filesystem cannot be relied on between requests.
- **Cold starts:** the first request after a period of inactivity can take a few seconds while the function spins up and reconnects to KV. Later requests are fast until the function goes idle again.
- **Detection accuracy** depends entirely on Sightengine's models. This project does not implement its own detection model.
- **No automated tests yet.** The manual checklist above covers the main flows.

## License

This project is licensed under the MIT License.

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
