import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROVIDER = (process.env.PROVIDER || 'xai').toLowerCase();
const PORT = Number(process.env.PORT || 4321);
const GROK_ASPECT_RATIO = process.env.GROK_ASPECT_RATIO || '3:4';
const GROK_RESOLUTION = process.env.GROK_RESOLUTION || '2k';

const XAI_KEY = process.env.XAI_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (PROVIDER === 'xai' && !XAI_KEY) {
  console.error('[carousel-forge] PROVIDER=xai but XAI_API_KEY is missing. Set it in .env and restart.');
  process.exit(1);
}
if (PROVIDER === 'openai' && !OPENAI_KEY) {
  console.error('[carousel-forge] PROVIDER=openai but OPENAI_API_KEY is missing. Set it in .env and restart.');
  process.exit(1);
}

const RENDERS_DIR = path.join(__dirname, 'renders');
await fs.mkdir(RENDERS_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/renders', express.static(RENDERS_DIR));

function slugify(s) {
  return (s || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'untitled';
}

function pad2(n) { return String(n).padStart(2, '0'); }

async function ensureCarouselDirs(slug) {
  const base = path.join(RENDERS_DIR, slug);
  const refs = path.join(base, 'refs');
  const slides = path.join(base, 'slides');
  await fs.mkdir(refs, { recursive: true });
  await fs.mkdir(slides, { recursive: true });
  return { base, refs, slides };
}

function dataUriToBuffer(dataUri) {
  const m = /^data:(image\/[a-zA-Z+.-]+);base64,(.*)$/.exec(dataUri);
  if (!m) throw new Error('Invalid data URI');
  return { mime: m[1], buffer: Buffer.from(m[2], 'base64') };
}

function bufferToDataUri(mime, buffer) {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

// Center-crop a buffer to a target aspect ratio and write PNG.
async function cropToAspect(inputBuffer, aspectW, aspectH) {
  const img = sharp(inputBuffer);
  const meta = await img.metadata();
  const srcW = meta.width;
  const srcH = meta.height;
  const targetRatio = aspectW / aspectH;
  const srcRatio = srcW / srcH;

  let cropW, cropH, left, top;
  if (srcRatio > targetRatio) {
    // Source too wide — crop sides
    cropH = srcH;
    cropW = Math.round(srcH * targetRatio);
    left = Math.round((srcW - cropW) / 2);
    top = 0;
  } else {
    // Source too tall — crop top/bottom
    cropW = srcW;
    cropH = Math.round(srcW / targetRatio);
    left = 0;
    top = Math.round((srcH - cropH) / 2);
  }
  return sharp(inputBuffer)
    .extract({ left, top, width: cropW, height: cropH })
    .png()
    .toBuffer();
}

// ─── Provider adapters ──────────────────────────────────────────────

async function generateWithXai({ prompt, refs }) {
  // refs: array of { mime, buffer }. We pass as data URIs per xAI docs.
  const imageField = refs.map((r) => ({
    type: 'image_url',
    url: bufferToDataUri(r.mime, r.buffer),
  }));

  const body = {
    model: 'grok-imagine-image',
    prompt,
    aspect_ratio: GROK_ASPECT_RATIO,
    resolution: GROK_RESOLUTION,
    response_format: 'b64_json',
  };
  // xAI supports 1-5 reference images. Single image goes as object, multiple as array (inferred).
  if (imageField.length === 1) {
    body.image = imageField[0];
  } else if (imageField.length > 1) {
    body.image = imageField;
  }

  const endpoint = refs.length > 0
    ? 'https://api.x.ai/v1/images/edits'
    : 'https://api.x.ai/v1/images/generations';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${XAI_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`xAI ${res.status}: ${text.slice(0, 500)}`);
  }
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`xAI returned non-JSON: ${text.slice(0, 200)}`); }

  const entry = json?.data?.[0];
  if (!entry) throw new Error(`xAI response missing data[0]: ${JSON.stringify(json).slice(0, 500)}`);

  if (entry.b64_json) {
    return Buffer.from(entry.b64_json, 'base64');
  }
  if (entry.url) {
    const imgRes = await fetch(entry.url);
    if (!imgRes.ok) throw new Error(`Failed to download xAI temp URL: ${imgRes.status}`);
    return Buffer.from(await imgRes.arrayBuffer());
  }
  throw new Error(`xAI response had neither b64_json nor url: ${JSON.stringify(json).slice(0, 500)}`);
}

async function generateWithOpenAi({ prompt, refs }) {
  // gpt-image-1 edits endpoint. Multipart form with multiple "image[]" files.
  const form = new FormData();
  form.append('model', 'gpt-image-1');
  form.append('prompt', prompt);
  form.append('size', '1024x1536');
  form.append('n', '1');
  for (let i = 0; i < refs.length; i++) {
    const r = refs[i];
    const blob = new Blob([r.buffer], { type: r.mime });
    form.append('image[]', blob, `ref-${i + 1}.png`);
  }

  const endpoint = refs.length > 0
    ? 'https://api.openai.com/v1/images/edits'
    : 'https://api.openai.com/v1/images/generations';

  // If no refs, we need JSON generations (gpt-image-1) instead
  let res;
  if (refs.length > 0) {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body: form,
    });
  } else {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size: '1024x1536',
        n: 1,
      }),
    });
  }

  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${text.slice(0, 500)}`);
  const json = JSON.parse(text);
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`OpenAI response missing data[0].b64_json: ${text.slice(0, 300)}`);
  return Buffer.from(b64, 'base64');
}

async function runProvider(args) {
  if (PROVIDER === 'openai') return generateWithOpenAi(args);
  return generateWithXai(args);
}

// ─── Routes ─────────────────────────────────────────────────────────

app.get('/api/config', (req, res) => {
  res.json({
    provider: PROVIDER,
    grok: { aspect_ratio: GROK_ASPECT_RATIO, resolution: GROK_RESOLUTION },
  });
});

app.post('/api/save-refs', async (req, res) => {
  try {
    const { carouselSlug, refs } = req.body || {};
    const slug = slugify(carouselSlug);
    const dirs = await ensureCarouselDirs(slug);
    // Clear existing refs
    const existing = await fs.readdir(dirs.refs);
    for (const f of existing) await fs.rm(path.join(dirs.refs, f), { force: true });
    const saved = [];
    for (let i = 0; i < (refs || []).length; i++) {
      const { mime, buffer } = dataUriToBuffer(refs[i]);
      const ext = mime.split('/')[1]?.replace('+xml', '') || 'png';
      const filename = `ref-${pad2(i + 1)}.${ext}`;
      await fs.writeFile(path.join(dirs.refs, filename), buffer);
      saved.push(filename);
    }
    res.json({ slug, saved });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/save-master-prompt', async (req, res) => {
  try {
    const { carouselSlug, masterPrompt } = req.body || {};
    const slug = slugify(carouselSlug);
    const dirs = await ensureCarouselDirs(slug);
    await fs.writeFile(path.join(dirs.base, 'master-prompt.txt'), String(masterPrompt || ''));
    res.json({ slug });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/save-slides', async (req, res) => {
  try {
    const { carouselSlug, slides } = req.body || {};
    const slug = slugify(carouselSlug);
    const dirs = await ensureCarouselDirs(slug);
    await fs.writeFile(
      path.join(dirs.base, 'slides.json'),
      JSON.stringify(slides || [], null, 2),
    );
    res.json({ slug });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/generate', async (req, res) => {
  const started = Date.now();
  try {
    const { carouselSlug, slideNumber, slideText, masterPrompt, refs, cropTo } = req.body || {};
    if (!slideText) return res.status(400).json({ error: 'slideText required' });
    const slug = slugify(carouselSlug);
    const dirs = await ensureCarouselDirs(slug);

    const refBuffers = (refs || []).map(dataUriToBuffer);

    const prompt = [
      String(masterPrompt || '').trim(),
      '',
      '—',
      '',
      `Now generate this slide (render only this slide as a single ${cropTo || '4:5'} image, no surrounding UI, no frame):`,
      '',
      String(slideText).trim(),
    ].join('\n');

    const rawBuffer = await runProvider({ prompt, refs: refBuffers });

    let finalBuffer = rawBuffer;
    if (cropTo === '4:5') {
      finalBuffer = await cropToAspect(rawBuffer, 4, 5);
    }

    const num = pad2(Number(slideNumber || 1));
    const filename = `${num}.png`;
    await fs.writeFile(path.join(dirs.slides, filename), finalBuffer);

    res.json({
      slug,
      slideNumber: Number(slideNumber || 1),
      filename,
      url: `/renders/${slug}/slides/${filename}`,
      ms: Date.now() - started,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e), ms: Date.now() - started });
  }
});

app.get('/api/carousel/:slug', async (req, res) => {
  try {
    const slug = slugify(req.params.slug);
    const base = path.join(RENDERS_DIR, slug);
    if (!fsSync.existsSync(base)) return res.json({ slug, exists: false });
    const master = await fs.readFile(path.join(base, 'master-prompt.txt'), 'utf8').catch(() => '');
    const slidesJson = await fs.readFile(path.join(base, 'slides.json'), 'utf8').catch(() => '[]');
    const refsDir = path.join(base, 'refs');
    const slidesDir = path.join(base, 'slides');
    const refs = fsSync.existsSync(refsDir) ? (await fs.readdir(refsDir)).sort() : [];
    const slides = fsSync.existsSync(slidesDir) ? (await fs.readdir(slidesDir)).sort() : [];
    res.json({
      slug,
      exists: true,
      masterPrompt: master,
      slides: JSON.parse(slidesJson),
      refFiles: refs.map((f) => `/renders/${slug}/refs/${f}`),
      slideFiles: slides.map((f) => `/renders/${slug}/slides/${f}`),
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/api/carousels', async (req, res) => {
  try {
    const entries = await fs.readdir(RENDERS_DIR);
    const out = [];
    for (const name of entries) {
      const p = path.join(RENDERS_DIR, name);
      const stat = await fs.stat(p).catch(() => null);
      if (stat?.isDirectory()) out.push(name);
    }
    res.json({ carousels: out });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.listen(PORT, () => {
  console.log(`\ncarousel-forge ready  →  http://localhost:${PORT}`);
  console.log(`provider: ${PROVIDER}`);
  console.log(`renders:  ${RENDERS_DIR}\n`);
});
