// api/index.js — DeepShield Backend (Vercel serverless-compatible)
// ================================================
// KEY CHANGES FROM ORIGINAL server.js:
//   1. No app.listen() — Vercel invokes the exported app per-request
//   2. Multer uses memoryStorage (Vercel fs is read-only outside /tmp)
//   3. File hash computed from buffer, not from disk
//   4. Sightengine upload sent as a buffer, not a file stream
//   5. casesDB is now backed by an external store — see note at bottom
// ================================================

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const multer   = require('multer');
const axios    = require('axios');
const FormData = require('form-data');
const crypto   = require('crypto');
const { kv } = require('@vercel/kv');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/kv-test', async (req, res) => {
  try {
    await kv.set('test-key', 'hello-' + Date.now());
    const value = await kv.get('test-key');
    res.json({ success: true, connected: true, value });
  } catch (err) {
    res.json({ success: false, connected: false, error: err.message });
  }
});

// ── Sightengine API Keys ─────────────────────────
const SE_USER   = process.env.SE_USER   || 'YOUR_API_USER';
const SE_SECRET = process.env.SE_SECRET || 'YOUR_API_SECRET';

// ── File Upload (memory, not disk) ───────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime'];
    ok.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'));
  }
});

// ── Data store ────────────────────────────────────
// IMPORTANT: in-memory arrays do NOT persist on Vercel. Each serverless
// invocation can run on a fresh instance, and instances are recycled
// constantly. This module-level array will appear to "work" inside a
// single warm invocation chain during testing, then silently reset.
// Swap getCases/saveCase below for a real external store before relying
// on this for real cases. See note at bottom of file for options.
const CASES_KEY = 'deepshield:cases';

async function getCases() {
  const cases = await kv.get(CASES_KEY);
  return cases || [];
}

async function saveCase(record) {
  const cases = await getCases();
  cases.push(record);
  await kv.set(CASES_KEY, cases);
}

async function updateCase(caseId, mutateFn) {
  const cases = await getCases();
  const record = cases.find(c => c.caseId === caseId);
  if (record) {
    mutateFn(record);
    await kv.set(CASES_KEY, cases);
  }
  return record;
}

// ── Hash generator (from buffer, not disk) ───────
function fileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ── Evidence Chain ───────────────────────────────
function initChain(caseId, hash, confidence) {
  const block = {
    index: 0, action: 'CASE_CREATED',
    caseId, mediaHash: hash, confidence,
    timestamp: new Date().toISOString(),
    prevHash: '0'.repeat(64)
  };
  block.hash = crypto.createHash('sha256').update(JSON.stringify({...block, hash: undefined})).digest('hex');
  return [block];
}

function appendChain(chain, caseId, hash, confidence, action) {
  const prev  = chain[chain.length - 1];
  const block = {
    index: chain.length, action,
    caseId, mediaHash: hash, confidence,
    timestamp: new Date().toISOString(),
    prevHash: prev.hash
  };
  block.hash = crypto.createHash('sha256').update(JSON.stringify({...block, hash: undefined})).digest('hex');
  chain.push(block);
  return chain;
}

// ─────────────────────────────────────────────────
// REAL AI DETECTION via Sightengine (buffer-based)
// ─────────────────────────────────────────────────
async function detectWithAI(buffer, mimetype, originalname) {
  const form = new FormData();
  form.append('media', buffer, { filename: originalname || 'upload' });
  form.append('models', 'deepfake,genai');
  form.append('api_user',   SE_USER);
  form.append('api_secret', SE_SECRET);

  const url = mimetype.startsWith('video')
    ? 'https://api.sightengine.com/1.0/video/check-sync.json'
    : 'https://api.sightengine.com/1.0/check.json';

  const resp = await axios.post(url, form, {
    headers: form.getHeaders(),
    timeout: 30000
  });

  const data = resp.data;
  console.log('Sightengine raw response:', JSON.stringify(data));

  if (data.status === 'failure') {
    throw new Error('Sightengine error: ' + (data.error?.message || 'unknown'));
  }

  const deepfakeScore = data.type?.deepfake ?? 0;
  const aiGenScore    = data.type?.ai_generated ?? 0;

  const topScore = Math.max(deepfakeScore, aiGenScore);
  const isDeepfake = topScore >= 0.5;
  const detectionType = topScore < 0.5
    ? 'authentic'
    : (deepfakeScore >= aiGenScore ? 'deepfake' : 'ai_generated');

  const confidence = isDeepfake
    ? Math.round(topScore * 100)
    : Math.round((1 - topScore) * 100);

  let severity = 'low';
  if (topScore >= 0.85) severity = 'critical';
  else if (topScore >= 0.70) severity = 'high';
  else if (topScore >= 0.50) severity = 'medium';

  return { isDeepfake, detectionType, confidence, deepfakeScore, aiGenScore, severity, raw: data };
}
// ─────────────────────────────────────────────────
// POST /api/detect
// ─────────────────────────────────────────────────
app.post('/api/detect', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const hash   = fileHash(req.file.buffer);
  const caseId = `DF-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  try {
    const ai = await detectWithAI(req.file.buffer, req.file.mimetype, req.file.originalname);
    const chain = initChain(caseId, hash, ai.confidence);

    const record = {
      caseId,
      fileName:   req.file.originalname,
      fileType:   req.file.mimetype,
      fileSize:   req.file.size,
      mediaHash:  hash,
      isDeepfake:    ai.isDeepfake,
      detectionType: ai.detectionType,
      confidence:    ai.confidence,
      deepfakeScore: parseFloat(ai.deepfakeScore.toFixed(4)),
      aiGenScore:    parseFloat(ai.aiGenScore.toFixed(4)),
      severity:      ai.severity,
      status:     'pending',
      govtRef:    null,
      location:   req.body.location || null,
      description:req.body.description || null,
      maskedUid:  `CIT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      evidenceChain: chain,
      timestamp:  new Date().toISOString(),
      ip:         req.ip
    };

    await saveCase(record);

    const verdictMap = {
  deepfake:     'DEEPFAKE DETECTED',
  ai_generated: 'AI GENERATED IMAGE DETECTED',
  authentic:    'AUTHENTIC MEDIA'
};

res.json({
  success:       true,
  caseId:        record.caseId,
  isDeepfake:    record.isDeepfake,
  detectionType: record.detectionType,
  confidence:    record.confidence,
  deepfakeScore: record.deepfakeScore,
  aiGenScore:    record.aiGenScore,
  severity:      record.severity,
  verdict:       verdictMap[record.detectionType],
  mediaHash:     record.mediaHash,
  status:        record.status,
  model:         'Sightengine Deepfake + GenAI'
});

  } catch (err) {
    console.error('Detection error:', err.message);
    res.status(500).json({ error: 'Detection failed: ' + err.message });
  }
});

// ─────────────────────────────────────────────────
// POST /api/report
// ─────────────────────────────────────────────────
app.post('/api/report', async (req, res) => {
  const { caseId, description, location } = req.body;
  const record = await updateCase(caseId, (r) => {
    r.description = description;
    r.location    = location || r.location;
    r.status      = 'under_review';
    r.evidenceChain = appendChain(r.evidenceChain, caseId, r.mediaHash, r.confidence, 'REPORT_FILED');
  });
  if (!record) return res.status(404).json({ error: 'Case not found' });

  res.json({ success: true, caseId, status: 'under_review', message: 'Report filed. Under admin review.' });
});

// ─────────────────────────────────────────────────
// POST /api/escalate
// ─────────────────────────────────────────────────
app.post('/api/escalate', async (req, res) => {
  const { caseId } = req.body;
  const govtRef = `MHA/${new Date().getFullYear()}/CYB/${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const record = await updateCase(caseId, (r) => {
    r.status  = 'escalated';
    r.govtRef = govtRef;
    r.evidenceChain = appendChain(r.evidenceChain, caseId, r.mediaHash, r.confidence, `ESCALATED:${govtRef}`);
  });
  if (!record) return res.status(404).json({ error: 'Case not found' });

  res.json({
    success:   true,
    caseId,
    govtRef,
    authority: 'Cyber Crime Wing, Ministry of Home Affairs',
    portal:    'https://cybercrime.gov.in',
    status:    'escalated',
    message:   `Case escalated to Govt. Reference: ${govtRef}`
  });
});

// ─────────────────────────────────────────────────
// GET /api/cases
// ─────────────────────────────────────────────────
app.get('/api/cases', async (req, res) => {
  const cases = await getCases();
  const sanitized = cases.map(c => ({
  caseId:        c.caseId,
  isDeepfake:    c.isDeepfake,
  detectionType: c.detectionType,
  confidence:    c.confidence,
  deepfakeScore: c.deepfakeScore,
  aiGenScore:    c.aiGenScore,
  severity:      c.severity,
  status:        c.status,
  location:      c.location,
  govtRef:       c.govtRef,
  maskedUid:     c.maskedUid,
  timestamp:     c.timestamp,
  fileName:      c.fileName
}));
  res.json({ success: true, total: cases.length, cases: sanitized });
});

// ─────────────────────────────────────────────────
// GET /api/stats
// ─────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  const cases = await getCases();
  const total     = cases.length;
  const fakes     = cases.filter(c => c.isDeepfake).length;
  const escalated = cases.filter(c => c.status === 'escalated').length;
  const resolved  = cases.filter(c => c.status === 'resolved').length;

  const now  = Date.now();
  const week = Array.from({length:7}, (_,i) => {
    const d = new Date(now - (6-i) * 86400000);
    const day = d.toISOString().slice(0,10);
    return {
      day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()],
      count: cases.filter(c => c.timestamp.startsWith(day)).length
    };
  });

  res.json({ success: true, total, fakes, escalated, resolved, week });
});

// ─────────────────────────────────────────────────
// GET /api/cases/:id/chain
// ─────────────────────────────────────────────────
app.get('/api/cases/:id/chain', async (req, res) => {
  const cases = await getCases();
  const record = cases.find(c => c.caseId === req.params.id);
  if (!record) return res.status(404).json({ error: 'Case not found' });

  let valid = true;
  for (let i = 0; i < record.evidenceChain.length; i++) {
    const b    = record.evidenceChain[i];
    const copy = {...b, hash: undefined};
    const computed = crypto.createHash('sha256').update(JSON.stringify(copy)).digest('hex');
    if (computed !== b.hash) { valid = false; break; }
    if (i > 0 && b.prevHash !== record.evidenceChain[i-1].hash) { valid = false; break; }
  }

  res.json({ success: true, caseId: req.params.id, valid, chain: record.evidenceChain });
});

// NOTE on persistence:
// casesDB above is a plain in-memory array. On Vercel, each serverless
// function instance can be frozen, recycled, or replaced with a fresh
// cold start at any time — there is no guarantee this array survives
// between requests, even seconds apart. For real persistence, swap
// getCases/saveCase/updateCase to use one of:
//   - Vercel KV / Vercel Postgres (native Vercel integrations)
//   - Supabase / MongoDB Atlas (free tiers, easy REST or SDK access)
//   - Upstash Redis (simple key-value, generous free tier)
// The rest of this file's logic (hashing, chain, detection) does not
// need to change — only these three functions do.

module.exports = app;