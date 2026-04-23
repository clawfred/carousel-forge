// Carousel Forge — vanilla JS frontend.
// Keeps state in memory + localStorage per-carousel-slug.

const DEFAULT_MASTER_PROMPT = `CELPIP Speaking Coach is an iOS app for English exam prep. I'm making 4:5 portrait carousels for Instagram and TikTok.

Match the composition of the attached reference slides exactly. What varies per carousel:
- Background: near-black, warm off-white, or a full grainy gradient.
- Main text: white or black, whichever contrasts the background.
- Accent color: ONE of blue or gold per carousel, used for the highlight block behind one word, the underline scribble, the save-this-for-later cue, the side rule on body text, and any accent word. The exact blue shade can vary across carousels.
- Grainy gradient position: side, corner, top, or bottom. Keep the grain texture.

No hashtags, no topic tags, no divider line across the top.

I'll send each slide's text only. You own composition from the references.`;

const CAROUSEL_1_PRESET = {
  name: 'carousel-01-accent-myth',
  overview: `Carousel #1 for @celpipspeaking. Flagship trust-builder. Flips the biggest anxiety in the CELPIP audience ("will my accent hurt my score?") and introduces the 5-dimension speaking rubric as the real scoring lens. 10 slides, 4:5 portrait. No product pitch.

Palette for this carousel: near-black background, white text, vivid blue accent. Grainy gradient bloom in the corner (pearl-to-gold). Blue is the single accent color for the highlight block, underline scribble, save cue, side rule, and accent word.`,
  slides: [
    `Slide 1 of 10 — cover
HEADLINE: CELPIP doesn't score your accent. Here's what it actually scores.
SAVE CUE (bottom corner, small): save this for later — with bookmark icon
SLIDE NUMBER: 01`,
    `Slide 2 of 10
HEADLINE: Every week someone asks: will my accent hurt my score?
BODY: The fear is fair. CELPIP moved to AI-Human Hybrid scoring in 2025, and most test-takers don't trust that an AI reads a non-native accent fairly. Indian, Filipino, and Nigerian applicants ask this most.
SLIDE NUMBER: 02`,
    `Slide 3 of 10
HEADLINE: The speaking rubric scores five things. Accent is not one of them.
LIST (lowercase, one per row, numbered):
1. content
2. coherence
3. vocabulary
4. listenability
5. task fulfillment
SLIDE NUMBER: 03`,
    `Slide 4 of 10
HEADLINE: Listenability is not accent.
BODY: It's clarity, pacing, and intonation. Can a regular Canadian listener follow what you said without rewinding? A strong accent with clear pacing scores well. A "neutral" accent spoken too fast scores worse.
COMPARE (two rows, one checked, one crossed):
- strong accent, clear pacing ✓
- neutral accent, rushed ✗
SLIDE NUMBER: 04`,
    `Slide 5 of 10
HEADLINE: Content is whether you actually answered the question.
SUBHEAD: Specific. On-topic. Complete.
EXAMPLE (two cards, labeled):
- LOW CONTENT: "Moving is a big decision. Cities can be expensive. There's a lot to think about."
- HIGH CONTENT: "I'd tell them to visit for a week first, talk to one person who lives there, and check if their job lets them work remote as a backup."
SLIDE NUMBER: 05`,
    `Slide 6 of 10
HEADLINE: Coherence is how your ideas connect.
BODY: Not "use more transition words". Connectors help, but what graders are really hearing: does your second sentence build on your first? Repeating "moreover" three times doesn't fix a scattered answer.
EXAMPLE (two cards, labeled):
- SCATTERED: "Working from home is good. The commute is bad. I can focus."
- CONNECTED: "Working from home helps me focus because I skip the commute, and that saves me two hours a day."
SLIDE NUMBER: 06`,
    `Slide 7 of 10
HEADLINE: Vocabulary is range, not difficulty.
BODY: Using "significant" where "big" works doesn't lift your score. Range beats rare.
PILLS (four, in a row): big / huge / a lot of / substantial
CAPTION UNDER PILLS: Switch between these across one response. Don't pick the rarest.
SLIDE NUMBER: 07`,
    `Slide 8 of 10
HEADLINE: Task fulfillment is whether you actually did the task.
BODY: Task 1 asks for advice. If you describe the problem for 45 seconds and never give advice, you fail the task no matter how clearly you spoke or how wide your vocabulary was.
PULLQUOTE (small, accent color, own line at the bottom): The task is the task. Do the task.
SLIDE NUMBER: 08`,
    `Slide 9 of 10
HEADLINE: What the AI actually flags, apparently.
LIST (four items, each in a small pill):
- pacing (too fast or too slow)
- long filler pauses
- restarted sentences
- prompt-drift
BODY (under the list): It's not parsing accent. A human rater verifies the AI's read.
SLIDE NUMBER: 09`,
    `Slide 10 of 10 — CTA
HEADLINE (two lines): Stop practicing your accent. / Start practicing the rubric.
BODY: Every drill targets one of the five: content, coherence, vocabulary, listenability, task fulfillment. Not "sounding Canadian".
PRIMARY CTA (banner across the slide): SAVE THIS FOR BEFORE YOUR TEST
TERTIARY (smaller, under the banner): Follow @celpipspeaking for one rubric dimension per week.
SLIDE NUMBER: 10`,
  ],
};

// ─── State ──────────────────────────────────────────────────────────
const state = {
  provider: '—',
  carouselName: '',
  slug: '',
  refs: [],        // array of data URIs (client-side)
  masterPrompt: DEFAULT_MASTER_PROMPT,
  slides: [''],    // array of text per slide
  rendered: {},    // slideIndex → URL (served by backend)
};

const LS_KEY = 'carousel-forge.state';

function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      carouselName: state.carouselName,
      refs: state.refs,
      masterPrompt: state.masterPrompt,
      slides: state.slides,
      rendered: state.rendered,
    }));
  } catch (e) {
    console.warn('localStorage save failed', e);
  }
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    Object.assign(state, parsed);
  } catch (e) { console.warn('localStorage load failed', e); }
}

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

// ─── Rendering ──────────────────────────────────────────────────────
function renderName() {
  document.getElementById('carouselName').value = state.carouselName || '';
  state.slug = slugify(state.carouselName) || 'untitled';
  document.getElementById('slugPreview').textContent = `slug: ${state.slug}`;
}

function renderRefs() {
  const grid = document.getElementById('refGrid');
  grid.innerHTML = '';
  state.refs.forEach((dataUri, i) => {
    const cell = document.createElement('div');
    cell.className = 'thumb';
    cell.innerHTML = `<img src="${dataUri}" alt="ref-${i + 1}" /><div class="rm" data-i="${i}">×</div>`;
    grid.appendChild(cell);
  });
  grid.querySelectorAll('.rm').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.i);
      state.refs.splice(i, 1);
      renderRefs();
      save();
      syncRefsToServer();
    });
  });
}

function renderMaster() {
  document.getElementById('masterPrompt').value = state.masterPrompt || '';
}

function renderSlides() {
  const list = document.getElementById('slidesList');
  list.innerHTML = '';
  const tpl = document.getElementById('slideRowTpl');
  state.slides.forEach((text, i) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.slide = String(i);
    node.querySelector('.num').textContent = `slide ${String(i + 1).padStart(2, '0')}`;
    const ta = node.querySelector('textarea');
    ta.value = text || '';
    ta.addEventListener('input', () => { state.slides[i] = ta.value; });
    ta.addEventListener('blur', () => { save(); saveSlidesToServer(); });

    const outWrap = node.querySelector('.slide-output');
    const url = state.rendered[i];
    if (url) {
      outWrap.innerHTML = `<img src="${url}?t=${Date.now()}" alt="slide ${i + 1}" />`;
      node.querySelector('.open').disabled = false;
    }

    node.querySelector('.gen').addEventListener('click', () => generateSlide(i));
    node.querySelector('.open').addEventListener('click', () => {
      const u = state.rendered[i];
      if (u) window.open(u, '_blank');
    });
    node.querySelector('.remove').addEventListener('click', () => {
      if (state.slides.length <= 1) return;
      state.slides.splice(i, 1);
      delete state.rendered[i];
      // Re-key rendered for higher indices
      const next = {};
      Object.entries(state.rendered).forEach(([k, v]) => {
        const idx = Number(k);
        if (idx > i) next[idx - 1] = v; else next[idx] = v;
      });
      state.rendered = next;
      renderSlides();
      save();
      saveSlidesToServer();
    });
    list.appendChild(node);
  });
}

function setSlideStatus(i, text, cls) {
  const row = document.querySelector(`.slide-row[data-slide="${i}"]`);
  if (!row) return;
  const el = row.querySelector('.slide-status');
  el.textContent = text;
  el.classList.remove('ok', 'err', 'running');
  if (cls) el.classList.add(cls);
}

function setSlideImage(i, url) {
  const row = document.querySelector(`.slide-row[data-slide="${i}"]`);
  if (!row) return;
  const out = row.querySelector('.slide-output');
  out.innerHTML = `<img src="${url}?t=${Date.now()}" alt="slide ${i + 1}" />`;
  row.querySelector('.open').disabled = false;
}

function setRunStatus(text, cls) {
  const el = document.getElementById('runStatus');
  el.textContent = text;
  el.classList.remove('ok', 'err');
  if (cls) el.classList.add(cls);
}

// ─── Server sync ────────────────────────────────────────────────────
async function syncRefsToServer() {
  if (!state.slug) return;
  try {
    await fetch('/api/save-refs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carouselSlug: state.slug, refs: state.refs }),
    });
  } catch (e) { console.warn('save-refs failed', e); }
}
async function saveMasterToServer() {
  if (!state.slug) return;
  try {
    await fetch('/api/save-master-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carouselSlug: state.slug, masterPrompt: state.masterPrompt }),
    });
  } catch (e) { console.warn('save-master failed', e); }
}
async function saveSlidesToServer() {
  if (!state.slug) return;
  try {
    await fetch('/api/save-slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carouselSlug: state.slug, slides: state.slides }),
    });
  } catch (e) { console.warn('save-slides failed', e); }
}

// ─── Generation ─────────────────────────────────────────────────────
async function generateSlide(i) {
  if (!state.slug) { alert('Set a carousel name first'); return; }
  const text = state.slides[i];
  if (!text || !text.trim()) { setSlideStatus(i, 'empty slide', 'err'); return; }
  setSlideStatus(i, 'generating…', 'running');
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carouselSlug: state.slug,
        slideNumber: i + 1,
        slideText: text,
        masterPrompt: state.masterPrompt,
        refs: state.refs,
        cropTo: '4:5',
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'generation failed');
    state.rendered[i] = json.url;
    save();
    setSlideImage(i, json.url);
    setSlideStatus(i, `done in ${Math.round(json.ms / 100) / 10}s`, 'ok');
    document.getElementById('generateAllBtn').disabled = false;
    document.getElementById('regenAllBtn').disabled = false;
  } catch (e) {
    setSlideStatus(i, String(e.message || e), 'err');
  }
}

async function generateMany(indices) {
  setRunStatus(`firing ${indices.length} slides in parallel…`);
  const results = await Promise.allSettled(indices.map(generateSlide));
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const err = results.length - ok;
  setRunStatus(`done. ${ok} ok, ${err} failed`, err ? 'err' : 'ok');
}

// ─── Wire up ────────────────────────────────────────────────────────
async function init() {
  load();
  renderName();
  renderRefs();
  renderMaster();
  renderSlides();

  // provider badge
  try {
    const cfg = await fetch('/api/config').then((r) => r.json());
    state.provider = cfg.provider;
    document.getElementById('providerBadge').textContent = `provider: ${cfg.provider} · ${cfg.grok.aspect_ratio} · ${cfg.grok.resolution}`;
  } catch {}

  const nameInput = document.getElementById('carouselName');
  nameInput.addEventListener('input', () => {
    state.carouselName = nameInput.value;
    state.slug = slugify(state.carouselName) || 'untitled';
    document.getElementById('slugPreview').textContent = `slug: ${state.slug}`;
  });
  nameInput.addEventListener('blur', () => { save(); syncRefsToServer(); saveMasterToServer(); saveSlidesToServer(); });

  const dz = document.getElementById('dropzone');
  const refInput = document.getElementById('refInput');
  dz.addEventListener('click', () => refInput.click());
  ['dragenter', 'dragover'].forEach((evt) => dz.addEventListener(evt, (e) => { e.preventDefault(); dz.classList.add('hover'); }));
  ['dragleave', 'drop'].forEach((evt) => dz.addEventListener(evt, (e) => { e.preventDefault(); dz.classList.remove('hover'); }));
  dz.addEventListener('drop', (e) => handleFiles(Array.from(e.dataTransfer.files)));
  refInput.addEventListener('change', () => handleFiles(Array.from(refInput.files)));

  async function handleFiles(files) {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    const room = 5 - state.refs.length;
    const take = imgs.slice(0, Math.max(room, 0));
    for (const f of take) {
      const b64 = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(f);
      });
      state.refs.push(b64);
    }
    renderRefs();
    save();
    syncRefsToServer();
  }

  const mp = document.getElementById('masterPrompt');
  mp.addEventListener('input', () => { state.masterPrompt = mp.value; });
  mp.addEventListener('blur', () => { save(); saveMasterToServer(); });

  document.getElementById('loadDefaultPrompt').addEventListener('click', () => {
    if (!confirm('Replace master prompt with the default?')) return;
    state.masterPrompt = DEFAULT_MASTER_PROMPT;
    renderMaster();
    save();
    saveMasterToServer();
  });

  document.getElementById('loadCarousel1Btn').addEventListener('click', () => {
    if (!confirm('Load Carousel #1 preset? Overrides current slides + name.')) return;
    state.carouselName = CAROUSEL_1_PRESET.name;
    state.slides = [...CAROUSEL_1_PRESET.slides];
    // Prepend overview line to master prompt note (just informational — user still owns master)
    state.rendered = {};
    renderName();
    renderSlides();
    save();
    saveSlidesToServer();
    syncRefsToServer();
    saveMasterToServer();
  });

  document.getElementById('addSlideBtn').addEventListener('click', () => {
    state.slides.push('');
    renderSlides();
    save();
    saveSlidesToServer();
  });

  document.getElementById('previewBtn').addEventListener('click', async () => {
    if (!state.slides[0] || !state.slides[0].trim()) { setRunStatus('slide 1 is empty', 'err'); return; }
    setRunStatus('previewing slide 1…');
    await generateSlide(0);
    setRunStatus('slide 1 done — review it, tweak master prompt if needed, then fan out 2-N', 'ok');
  });

  document.getElementById('generateAllBtn').addEventListener('click', async () => {
    const indices = state.slides.map((_, i) => i).filter((i) => i !== 0 && state.slides[i].trim());
    if (indices.length === 0) { setRunStatus('no slides 2-N to generate', 'err'); return; }
    await generateMany(indices);
  });

  document.getElementById('regenAllBtn').addEventListener('click', async () => {
    if (!confirm('Regenerate ALL slides (1-N) in parallel? Replaces existing renders.')) return;
    const indices = state.slides.map((_, i) => i).filter((i) => state.slides[i].trim());
    state.rendered = {};
    renderSlides();
    save();
    await generateMany(indices);
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('Clear local state? (Saved images on disk stay.)')) return;
    localStorage.removeItem(LS_KEY);
    location.reload();
  });
}

init();
