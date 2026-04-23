// Carousel Forge — v2 server.
// Multi-project architecture: presets (read-only, in repo) + projects (user-created, gitignored).
// Each project has a shared refs library and 1..N carousels.

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

const PRESETS_DIR = path.join(__dirname, 'presets');
const PROJECTS_DIR = path.join(__dirname, 'projects');
await fs.mkdir(PROJECTS_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
// Serve user-generated outputs + uploaded refs as static for the UI to display
app.use('/projects', express.static(PROJECTS_DIR));

// ─── Slug & path helpers ────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

function slugify(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

function validSlug(s) {
  return typeof s === 'string' && SLUG_RE.test(s);
}

// Resolve a safe absolute path under a root directory. Throws on escape attempts.
function safeJoin(root, ...parts) {
  for (const p of parts) {
    if (typeof p !== 'string' || p.includes('..') || p.includes('/') || p.includes('\\')) {
      throw new Error(`Unsafe path segment: ${p}`);
    }
  }
  const abs = path.join(root, ...parts);
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error(`Path escapes root: ${abs}`);
  }
  return abs;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function dataUriToBuffer(dataUri) {
  const m = /^data:(image\/[a-zA-Z+.-]+);base64,(.*)$/.exec(dataUri);
  if (!m) throw new Error('Invalid data URI');
  return { mime: m[1], buffer: Buffer.from(m[2], 'base64') };
}

function bufferToDataUri(mime, buffer) {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, obj) {
  await fs.writeFile(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

async function dirExists(p) {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch { return false; }
}

async function listDirs(p) {
  try {
    const entries = await fs.readdir(p, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch { return []; }
}

// Recursive copy — used when installing a preset into projects/.
async function copyDir(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

// ─── Image crop ─────────────────────────────────────────────────────

async function cropToAspect(inputBuffer, aspectW, aspectH) {
  const img = sharp(inputBuffer);
  const meta = await img.metadata();
  const srcW = meta.width;
  const srcH = meta.height;
  const targetRatio = aspectW / aspectH;
  const srcRatio = srcW / srcH;

  let cropW, cropH, left, top;
  if (srcRatio > targetRatio) {
    cropH = srcH;
    cropW = Math.round(srcH * targetRatio);
    left = Math.round((srcW - cropW) / 2);
    top = 0;
  } else {
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
  if (imageField.length === 1) body.image = imageField[0];
  else if (imageField.length > 1) body.image = imageField;

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
  if (!res.ok) throw new Error(`xAI ${res.status}: ${text.slice(0, 500)}`);

  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`xAI returned non-JSON: ${text.slice(0, 200)}`); }

  const entry = json?.data?.[0];
  if (!entry) throw new Error(`xAI response missing data[0]: ${JSON.stringify(json).slice(0, 500)}`);

  if (entry.b64_json) return Buffer.from(entry.b64_json, 'base64');
  if (entry.url) {
    const imgRes = await fetch(entry.url);
    if (!imgRes.ok) throw new Error(`Failed to download xAI temp URL: ${imgRes.status}`);
    return Buffer.from(await imgRes.arrayBuffer());
  }
  throw new Error(`xAI response had neither b64_json nor url`);
}

async function generateWithOpenAi({ prompt, refs }) {
  const endpoint = refs.length > 0
    ? 'https://api.openai.com/v1/images/edits'
    : 'https://api.openai.com/v1/images/generations';

  let res;
  if (refs.length > 0) {
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

// ─── Project / carousel helpers ─────────────────────────────────────

async function readProject(slug) {
  if (!validSlug(slug)) throw new Error(`invalid project slug: ${slug}`);
  const base = safeJoin(PROJECTS_DIR, slug);
  if (!(await dirExists(base))) return null;

  const meta = await readJson(path.join(base, 'project.json'), {
    name: slug,
    description: '',
    masterPrompt: '',
  });

  const refsDir = path.join(base, 'refs');
  const refFiles = (await listFiles(refsDir)).sort();
  const refs = refFiles.map((f) => `/projects/${slug}/refs/${f}`);

  const carouselSlugs = await listDirs(path.join(base, 'carousels'));
  carouselSlugs.sort();
  const carousels = [];
  for (const cslug of carouselSlugs) {
    const c = await readCarouselSummary(slug, cslug);
    if (c) carousels.push(c);
  }

  return {
    slug,
    name: meta.name || slug,
    description: meta.description || '',
    masterPrompt: meta.masterPrompt || '',
    installedFrom: meta.installedFrom || null,
    refs,
    carousels,
  };
}

async function listFiles(p) {
  try {
    const entries = await fs.readdir(p, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => e.name);
  } catch { return []; }
}

async function readCarouselSummary(projectSlug, cslug) {
  if (!validSlug(cslug)) return null;
  const base = safeJoin(PROJECTS_DIR, projectSlug, 'carousels', cslug);
  if (!(await dirExists(base))) return null;
  const meta = await readJson(path.join(base, 'metadata.json'), {});
  const slides = await readJson(path.join(base, 'slides.json'), []);
  const rendered = await listFiles(path.join(base, 'slides'));
  return {
    slug: cslug,
    title: meta.title || cslug,
    description: meta.description || '',
    palette: meta.palette || '',
    slideCount: Array.isArray(slides) ? slides.length : 0,
    renderedCount: rendered.filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f)).length,
  };
}

async function readCarousel(projectSlug, cslug) {
  if (!validSlug(cslug)) throw new Error(`invalid carousel slug: ${cslug}`);
  const base = safeJoin(PROJECTS_DIR, projectSlug, 'carousels', cslug);
  if (!(await dirExists(base))) return null;

  const meta = await readJson(path.join(base, 'metadata.json'), {});
  const slides = await readJson(path.join(base, 'slides.json'), []);

  const slidesDir = path.join(base, 'slides');
  const rendered = {};
  const files = await listFiles(slidesDir);
  for (const f of files) {
    const m = /^(\d+)\./.exec(f);
    if (m) {
      const idx = Number(m[1]) - 1;
      if (idx >= 0) rendered[idx] = `/projects/${projectSlug}/carousels/${cslug}/slides/${f}`;
    }
  }

  return {
    slug: cslug,
    title: meta.title || cslug,
    description: meta.description || '',
    palette: meta.palette || '',
    masterPromptOverride: meta.masterPromptOverride || '',
    slides: Array.isArray(slides) ? slides : [],
    rendered,
  };
}

// ─── Preset routes ──────────────────────────────────────────────────

async function readPreset(slug) {
  if (!validSlug(slug)) return null;
  const base = safeJoin(PRESETS_DIR, slug);
  if (!(await dirExists(base))) return null;
  const brand = await readJson(path.join(base, 'brand.json'), null);
  if (!brand) return null;
  const carouselSlugs = await listDirs(path.join(base, 'carousels'));
  carouselSlugs.sort();
  const carousels = [];
  for (const cslug of carouselSlugs) {
    const meta = await readJson(path.join(base, 'carousels', cslug, 'metadata.json'), {});
    carousels.push({
      slug: cslug,
      title: meta.title || cslug,
      description: meta.description || '',
    });
  }
  return {
    slug,
    name: brand.name || slug,
    description: brand.description || '',
    carousels,
  };
}

app.get('/api/presets', async (req, res) => {
  try {
    const slugs = await listDirs(PRESETS_DIR);
    slugs.sort();
    const out = [];
    for (const s of slugs) {
      const p = await readPreset(s);
      if (p) out.push(p);
    }
    res.json({ presets: out });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/presets/:slug/install', async (req, res) => {
  try {
    const presetSlug = req.params.slug;
    if (!validSlug(presetSlug)) return res.status(400).json({ error: 'invalid preset slug' });
    const presetDir = safeJoin(PRESETS_DIR, presetSlug);
    if (!(await dirExists(presetDir))) return res.status(404).json({ error: 'preset not found' });

    const requestedSlug = (req.body && req.body.targetSlug) ? slugify(req.body.targetSlug) : presetSlug;
    if (!validSlug(requestedSlug)) return res.status(400).json({ error: 'invalid target slug' });

    const targetDir = safeJoin(PROJECTS_DIR, requestedSlug);
    if (await dirExists(targetDir)) {
      return res.status(409).json({ error: `project "${requestedSlug}" already exists`, slug: requestedSlug });
    }

    // Copy presets/<slug>/carousels/ → projects/<target>/carousels/
    const presetCarouselsDir = path.join(presetDir, 'carousels');
    if (await dirExists(presetCarouselsDir)) {
      await copyDir(presetCarouselsDir, path.join(targetDir, 'carousels'));
    } else {
      await fs.mkdir(path.join(targetDir, 'carousels'), { recursive: true });
    }

    // Create project.json from preset brand.json + installedFrom pointer
    const brand = await readJson(path.join(presetDir, 'brand.json'), {});
    await fs.mkdir(path.join(targetDir, 'refs'), { recursive: true });
    await writeJson(path.join(targetDir, 'project.json'), {
      name: brand.name || presetSlug,
      description: brand.description || '',
      masterPrompt: brand.masterPrompt || '',
      installedFrom: presetSlug,
    });

    res.status(201).json({ slug: requestedSlug });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// ─── Project routes ─────────────────────────────────────────────────

app.get('/api/projects', async (req, res) => {
  try {
    const slugs = await listDirs(PROJECTS_DIR);
    slugs.sort();
    const out = [];
    for (const s of slugs) {
      if (!validSlug(s)) continue;
      const meta = await readJson(path.join(PROJECTS_DIR, s, 'project.json'), { name: s });
      const carouselSlugs = await listDirs(path.join(PROJECTS_DIR, s, 'carousels'));
      out.push({
        slug: s,
        name: meta.name || s,
        description: meta.description || '',
        carouselCount: carouselSlugs.length,
        installedFrom: meta.installedFrom || null,
      });
    }
    res.json({ projects: out });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { name, description, masterPrompt, slug: requestedSlug } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
    const slug = requestedSlug ? slugify(requestedSlug) : slugify(name);
    if (!validSlug(slug)) return res.status(400).json({ error: 'could not derive a valid slug from name' });
    const target = safeJoin(PROJECTS_DIR, slug);
    if (await dirExists(target)) return res.status(409).json({ error: `project "${slug}" already exists`, slug });
    await fs.mkdir(path.join(target, 'refs'), { recursive: true });
    await fs.mkdir(path.join(target, 'carousels'), { recursive: true });
    await writeJson(path.join(target, 'project.json'), {
      name,
      description: description || '',
      masterPrompt: masterPrompt || '',
    });
    res.status(201).json({ slug });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/api/projects/:slug', async (req, res) => {
  try {
    const project = await readProject(req.params.slug);
    if (!project) return res.status(404).json({ error: 'project not found' });
    res.json(project);
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.patch('/api/projects/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!validSlug(slug)) return res.status(400).json({ error: 'invalid slug' });
    const base = safeJoin(PROJECTS_DIR, slug);
    if (!(await dirExists(base))) return res.status(404).json({ error: 'project not found' });
    const metaPath = path.join(base, 'project.json');
    const meta = await readJson(metaPath, {});
    const body = req.body || {};
    if (typeof body.name === 'string') meta.name = body.name;
    if (typeof body.description === 'string') meta.description = body.description;
    if (typeof body.masterPrompt === 'string') meta.masterPrompt = body.masterPrompt;
    await writeJson(metaPath, meta);
    res.json({ slug });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.delete('/api/projects/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!validSlug(slug)) return res.status(400).json({ error: 'invalid slug' });
    const base = safeJoin(PROJECTS_DIR, slug);
    if (!(await dirExists(base))) return res.status(404).json({ error: 'project not found' });
    await fs.rm(base, { recursive: true, force: true });
    res.json({ slug, deleted: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/projects/:slug/refs', async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!validSlug(slug)) return res.status(400).json({ error: 'invalid slug' });
    const base = safeJoin(PROJECTS_DIR, slug);
    if (!(await dirExists(base))) return res.status(404).json({ error: 'project not found' });
    const refsDir = path.join(base, 'refs');
    await fs.mkdir(refsDir, { recursive: true });
    const existing = await listFiles(refsDir);
    for (const f of existing) await fs.rm(path.join(refsDir, f), { force: true });
    const refs = Array.isArray(req.body?.refs) ? req.body.refs : [];
    const saved = [];
    for (let i = 0; i < refs.length; i++) {
      const { mime, buffer } = dataUriToBuffer(refs[i]);
      const ext = (mime.split('/')[1] || 'png').replace('+xml', '');
      const filename = `ref-${pad2(i + 1)}.${ext}`;
      await fs.writeFile(path.join(refsDir, filename), buffer);
      saved.push(`/projects/${slug}/refs/${filename}`);
    }
    res.json({ slug, refs: saved });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// ─── Carousel routes ────────────────────────────────────────────────

app.post('/api/projects/:slug/carousels', async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!validSlug(slug)) return res.status(400).json({ error: 'invalid project slug' });
    const projectBase = safeJoin(PROJECTS_DIR, slug);
    if (!(await dirExists(projectBase))) return res.status(404).json({ error: 'project not found' });

    const { title, description, slug: requestedSlug } = req.body || {};
    if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title required' });
    const cslug = requestedSlug ? slugify(requestedSlug) : slugify(title);
    if (!validSlug(cslug)) return res.status(400).json({ error: 'could not derive valid carousel slug' });

    const cbase = safeJoin(projectBase, 'carousels', cslug);
    if (await dirExists(cbase)) return res.status(409).json({ error: `carousel "${cslug}" already exists`, slug: cslug });

    await fs.mkdir(path.join(cbase, 'slides'), { recursive: true });
    await writeJson(path.join(cbase, 'metadata.json'), {
      title,
      description: description || '',
      palette: '',
      masterPromptOverride: '',
    });
    await writeJson(path.join(cbase, 'slides.json'), ['']);
    res.status(201).json({ slug: cslug });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/api/projects/:slug/carousels/:cslug', async (req, res) => {
  try {
    const { slug, cslug } = req.params;
    const c = await readCarousel(slug, cslug);
    if (!c) return res.status(404).json({ error: 'carousel not found' });
    res.json(c);
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.patch('/api/projects/:slug/carousels/:cslug', async (req, res) => {
  try {
    const { slug, cslug } = req.params;
    if (!validSlug(slug) || !validSlug(cslug)) return res.status(400).json({ error: 'invalid slug' });
    const cbase = safeJoin(PROJECTS_DIR, slug, 'carousels', cslug);
    if (!(await dirExists(cbase))) return res.status(404).json({ error: 'carousel not found' });

    const body = req.body || {};
    if (body.slides !== undefined) {
      if (!Array.isArray(body.slides)) return res.status(400).json({ error: 'slides must be array' });
      await writeJson(path.join(cbase, 'slides.json'), body.slides);
    }
    if (body.title !== undefined || body.description !== undefined || body.palette !== undefined || body.masterPromptOverride !== undefined) {
      const metaPath = path.join(cbase, 'metadata.json');
      const meta = await readJson(metaPath, {});
      if (typeof body.title === 'string') meta.title = body.title;
      if (typeof body.description === 'string') meta.description = body.description;
      if (typeof body.palette === 'string') meta.palette = body.palette;
      if (typeof body.masterPromptOverride === 'string') meta.masterPromptOverride = body.masterPromptOverride;
      await writeJson(metaPath, meta);
    }
    res.json({ slug: cslug });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.delete('/api/projects/:slug/carousels/:cslug', async (req, res) => {
  try {
    const { slug, cslug } = req.params;
    if (!validSlug(slug) || !validSlug(cslug)) return res.status(400).json({ error: 'invalid slug' });
    const cbase = safeJoin(PROJECTS_DIR, slug, 'carousels', cslug);
    if (!(await dirExists(cbase))) return res.status(404).json({ error: 'carousel not found' });
    await fs.rm(cbase, { recursive: true, force: true });
    res.json({ slug: cslug, deleted: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// ─── Generation ─────────────────────────────────────────────────────

app.post('/api/projects/:slug/carousels/:cslug/slides/:n/generate', async (req, res) => {
  const started = Date.now();
  try {
    const { slug, cslug, n } = req.params;
    if (!validSlug(slug) || !validSlug(cslug)) return res.status(400).json({ error: 'invalid slug' });
    const slideNumber = Number(n);
    if (!Number.isInteger(slideNumber) || slideNumber < 1 || slideNumber > 99) {
      return res.status(400).json({ error: 'slide number must be 1-99' });
    }

    const projectBase = safeJoin(PROJECTS_DIR, slug);
    const cbase = safeJoin(projectBase, 'carousels', cslug);
    if (!(await dirExists(cbase))) return res.status(404).json({ error: 'carousel not found' });

    const project = await readJson(path.join(projectBase, 'project.json'), {});
    const carouselMeta = await readJson(path.join(cbase, 'metadata.json'), {});
    const slides = await readJson(path.join(cbase, 'slides.json'), []);

    const idx = slideNumber - 1;
    const slideText = slides[idx];
    if (!slideText || !String(slideText).trim()) return res.status(400).json({ error: 'slide text is empty' });

    // Effective master prompt: carousel override wins if non-empty, else project prompt.
    const override = (carouselMeta.masterPromptOverride || '').trim();
    const base = (project.masterPrompt || '').trim();
    const effectivePrompt = override || base;

    // Load refs from disk (project-level library)
    const refsDir = path.join(projectBase, 'refs');
    const refFiles = (await listFiles(refsDir)).sort();
    const refs = [];
    for (const f of refFiles) {
      const buffer = await fs.readFile(path.join(refsDir, f));
      const ext = path.extname(f).slice(1).toLowerCase();
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext || 'png'}`;
      refs.push({ mime, buffer });
    }

    const prompt = [
      effectivePrompt,
      '',
      '—',
      '',
      `Now generate this slide (render only this slide as a single 4:5 portrait image, no surrounding UI, no frame):`,
      '',
      String(slideText).trim(),
    ].join('\n');

    const rawBuffer = await runProvider({ prompt, refs });
    const finalBuffer = await cropToAspect(rawBuffer, 4, 5);

    const filename = `${pad2(slideNumber)}.png`;
    const outDir = path.join(cbase, 'slides');
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, filename), finalBuffer);

    res.json({
      slug,
      carouselSlug: cslug,
      slideNumber,
      filename,
      url: `/projects/${slug}/carousels/${cslug}/slides/${filename}`,
      ms: Date.now() - started,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e), ms: Date.now() - started });
  }
});

// ─── Config ─────────────────────────────────────────────────────────

app.get('/api/config', (req, res) => {
  res.json({
    provider: PROVIDER,
    grok: { aspect_ratio: GROK_ASPECT_RATIO, resolution: GROK_RESOLUTION },
  });
});

// ─── Boot ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\ncarousel-forge ready  →  http://localhost:${PORT}`);
  console.log(`provider: ${PROVIDER}`);
  console.log(`presets:  ${PRESETS_DIR}`);
  console.log(`projects: ${PROJECTS_DIR}\n`);
});
