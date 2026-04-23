// Carousel Forge — v2 frontend.
// Three views: project-list, project-detail, carousel-detail.
// Truth lives on the server. localStorage only remembers where you last were.

const LS_KEY = 'carousel-forge.v2';

const state = {
  provider: '—',
  presets: [],
  projects: [],
  mode: 'project-list',           // 'project-list' | 'project-detail' | 'carousel-detail'
  currentProjectSlug: null,
  currentCarouselSlug: null,
  project: null,                  // full detail (null unless in project-detail or carousel-detail)
  carousel: null,                 // full detail (null unless in carousel-detail)
  runStatus: 'idle',
};

function saveLocation() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      mode: state.mode,
      currentProjectSlug: state.currentProjectSlug,
      currentCarouselSlug: state.currentCarouselSlug,
    }));
  } catch {}
}

function loadLocation() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function slugify(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

// ─── HTTP helpers ───────────────────────────────────────────────────
async function api(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const msg = (json && json.error) || `${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

// ─── View switching ─────────────────────────────────────────────────
function showView(name) {
  state.mode = name;
  for (const v of ['viewProjectList', 'viewProject', 'viewCarousel']) {
    document.getElementById(v).hidden = true;
  }
  const map = {
    'project-list': 'viewProjectList',
    'project-detail': 'viewProject',
    'carousel-detail': 'viewCarousel',
  };
  document.getElementById(map[name]).hidden = false;
  renderBreadcrumb();
  saveLocation();
}

function renderBreadcrumb() {
  const bc = document.getElementById('breadcrumb');
  const crumbP = document.getElementById('crumbProject');
  const crumbC = document.getElementById('crumbCarousel');
  if (state.mode === 'project-list') {
    bc.hidden = true;
    return;
  }
  bc.hidden = false;
  crumbP.innerHTML = '';
  crumbC.innerHTML = '';
  if (state.project) {
    crumbP.innerHTML = ` / <a href="#" data-nav="project-detail">${escapeHtml(state.project.name)}</a>`;
  }
  if (state.mode === 'carousel-detail' && state.carousel) {
    crumbC.innerHTML = ` / <span>${escapeHtml(state.carousel.title)}</span>`;
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ─── Project list view ─────────────────────────────────────────────
async function loadProjectList() {
  const [{ projects }, { presets }] = await Promise.all([
    api('GET', '/api/projects'),
    api('GET', '/api/presets'),
  ]);
  state.projects = projects;
  state.presets = presets;
  renderProjectList();
  renderPresetList();
}

function renderProjectList() {
  const list = document.getElementById('projectsList');
  list.innerHTML = '';
  if (state.projects.length === 0) {
    list.innerHTML = '<div class="hint pad">no projects yet. install a preset or create a blank one.</div>';
    return;
  }
  const tpl = document.getElementById('projectRowTpl');
  for (const p of state.projects) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.slug = p.slug;
    node.querySelector('.item-title').textContent = p.name;
    node.querySelector('.item-desc').textContent = p.description || '';
    node.querySelector('.item-meta').textContent =
      `${p.carouselCount} carousel${p.carouselCount === 1 ? '' : 's'}` +
      (p.installedFrom ? ` · from preset: ${p.installedFrom}` : '');
    node.querySelector('.open').addEventListener('click', () => openProject(p.slug));
    list.appendChild(node);
  }
}

function renderPresetList() {
  const list = document.getElementById('presetsList');
  list.innerHTML = '';
  if (state.presets.length === 0) {
    list.innerHTML = '<div class="hint pad">no presets available.</div>';
    return;
  }
  const tpl = document.getElementById('presetRowTpl');
  for (const p of state.presets) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.slug = p.slug;
    node.querySelector('.item-title').textContent = p.name;
    node.querySelector('.item-desc').textContent = p.description || '';
    node.querySelector('.item-meta').textContent =
      `${p.carousels.length} carousel${p.carousels.length === 1 ? '' : 's'}`;
    node.querySelector('.install').addEventListener('click', () => installPreset(p.slug));
    list.appendChild(node);
  }
}

async function installPreset(presetSlug) {
  let targetSlug = presetSlug;
  if (state.projects.some((p) => p.slug === targetSlug)) {
    const altName = prompt(`A project "${targetSlug}" already exists.\nInstall as a different name?`, `${targetSlug}-2`);
    if (!altName) return;
    targetSlug = slugify(altName);
    if (!targetSlug) return alert('invalid slug');
  }
  try {
    const result = await api('POST', `/api/presets/${presetSlug}/install`, { targetSlug });
    await loadProjectList();
    openProject(result.slug);
  } catch (e) {
    alert(`install failed: ${e.message}`);
  }
}

function openProject(slug) {
  state.currentProjectSlug = slug;
  state.currentCarouselSlug = null;
  state.carousel = null;
  loadProjectDetail();
}

// ─── Project detail view ───────────────────────────────────────────
async function loadProjectDetail() {
  try {
    state.project = await api('GET', `/api/projects/${state.currentProjectSlug}`);
  } catch (e) {
    alert(`failed to load project: ${e.message}`);
    state.currentProjectSlug = null;
    showView('project-list');
    return;
  }
  renderProjectDetail();
  showView('project-detail');
}

function renderProjectDetail() {
  const p = state.project;
  document.getElementById('projectName').value = p.name || '';
  document.getElementById('projectDesc').value = p.description || '';
  document.getElementById('masterPrompt').value = p.masterPrompt || '';
  renderRefs(p.refs);
  renderCarouselsList(p.carousels);
}

function renderRefs(refs) {
  const grid = document.getElementById('refGrid');
  grid.innerHTML = '';
  for (let i = 0; i < refs.length; i++) {
    const cell = document.createElement('div');
    cell.className = 'thumb';
    cell.innerHTML = `<img src="${refs[i]}?t=${Date.now()}" alt="ref-${i + 1}" /><div class="rm" data-i="${i}">×</div>`;
    grid.appendChild(cell);
  }
  grid.querySelectorAll('.rm').forEach((btn) => {
    btn.addEventListener('click', () => removeRefAt(Number(btn.dataset.i)));
  });
}

async function removeRefAt(i) {
  const refs = state.project.refs.slice();
  refs.splice(i, 1);
  // Re-upload remaining refs as data URIs (server replaces the set).
  const dataUris = [];
  for (const url of refs) {
    const resp = await fetch(url);
    const blob = await resp.blob();
    dataUris.push(await blobToDataUri(blob));
  }
  await saveRefs(dataUris);
}

function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

async function saveRefs(dataUris) {
  await api('POST', `/api/projects/${state.currentProjectSlug}/refs`, { refs: dataUris });
  state.project = await api('GET', `/api/projects/${state.currentProjectSlug}`);
  renderRefs(state.project.refs);
}

function renderCarouselsList(carousels) {
  const list = document.getElementById('carouselsList');
  list.innerHTML = '';
  if (carousels.length === 0) {
    list.innerHTML = '<div class="hint pad">no carousels yet. click + new carousel.</div>';
    return;
  }
  const tpl = document.getElementById('carouselRowTpl');
  for (const c of carousels) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.slug = c.slug;
    node.querySelector('.item-title').textContent = c.title;
    node.querySelector('.item-desc').textContent = c.description || '';
    node.querySelector('.item-meta').textContent =
      `${c.renderedCount}/${c.slideCount} rendered` + (c.palette ? ` · ${c.palette.slice(0, 80)}` : '');
    node.querySelector('.open').addEventListener('click', () => openCarousel(c.slug));
    list.appendChild(node);
  }
}

function openCarousel(cslug) {
  state.currentCarouselSlug = cslug;
  loadCarouselDetail();
}

// ─── Carousel detail view ─────────────────────────────────────────
async function loadCarouselDetail() {
  try {
    state.carousel = await api(
      'GET',
      `/api/projects/${state.currentProjectSlug}/carousels/${state.currentCarouselSlug}`,
    );
  } catch (e) {
    alert(`failed to load carousel: ${e.message}`);
    state.currentCarouselSlug = null;
    showView('project-detail');
    return;
  }
  renderCarouselDetail();
  showView('carousel-detail');
}

function renderCarouselDetail() {
  const c = state.carousel;
  const p = state.project;
  document.getElementById('carouselTitle').value = c.title || '';
  document.getElementById('carouselDesc').value = c.description || '';
  document.getElementById('carouselPalette').value = c.palette || '';
  document.getElementById('masterPromptOverride').value = c.masterPromptOverride || '';
  const badge = document.getElementById('overrideBadge');
  badge.textContent = c.masterPromptOverride
    ? 'using carousel override'
    : 'using project default';
  badge.classList.toggle('ok', !!c.masterPromptOverride);

  // Render project refs as faded inline reminders
  const grid = document.getElementById('carouselRefsGrid');
  grid.innerHTML = '';
  const hint = document.getElementById('carouselRefsHint');
  if (!p.refs || p.refs.length === 0) {
    hint.textContent = 'no references in project. generation will be text-only.';
  } else {
    hint.textContent = `${p.refs.length} reference${p.refs.length === 1 ? '' : 's'} from project library.`;
    for (let i = 0; i < p.refs.length; i++) {
      const cell = document.createElement('div');
      cell.className = 'thumb';
      cell.innerHTML = `<img src="${p.refs[i]}" alt="ref-${i + 1}" />`;
      grid.appendChild(cell);
    }
  }

  renderSlides();
  updateExportControls();
}

function updateExportControls() {
  const c = state.carousel;
  if (!c) return;
  const renderedCount = Object.keys(c.rendered || {}).length;
  const total = c.slides.length;
  const countEl = document.getElementById('renderedCount');
  if (countEl) countEl.textContent = `${renderedCount}/${total} rendered`;
  const btn = document.getElementById('downloadZipBtn');
  if (btn) btn.disabled = renderedCount === 0;
}

function renderSlides() {
  const list = document.getElementById('slidesList');
  list.innerHTML = '';
  const tpl = document.getElementById('slideRowTpl');
  const c = state.carousel;
  c.slides.forEach((text, i) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.slide = String(i);
    node.querySelector('.num').textContent = `slide ${String(i + 1).padStart(2, '0')}`;
    const ta = node.querySelector('textarea');
    ta.value = text || '';
    ta.addEventListener('input', () => { c.slides[i] = ta.value; });
    ta.addEventListener('blur', () => persistSlides());

    const outWrap = node.querySelector('.slide-output');
    const url = c.rendered[i];
    if (url) {
      outWrap.innerHTML = `<img src="${url}?t=${Date.now()}" alt="slide ${i + 1}" />`;
      node.querySelector('.open').disabled = false;
    }

    node.querySelector('.gen').addEventListener('click', () => generateSlide(i));
    node.querySelector('.open').addEventListener('click', () => {
      const u = c.rendered[i];
      if (u) window.open(u, '_blank');
    });
    node.querySelector('.remove').addEventListener('click', () => removeSlide(i));
    list.appendChild(node);
  });
  updateExportControls();
}

async function persistSlides() {
  await api('PATCH',
    `/api/projects/${state.currentProjectSlug}/carousels/${state.currentCarouselSlug}`,
    { slides: state.carousel.slides });
}

async function removeSlide(i) {
  if (state.carousel.slides.length <= 1) return;
  if (!confirm(`Remove slide ${i + 1}?`)) return;
  state.carousel.slides.splice(i, 1);
  delete state.carousel.rendered[i];
  // Re-key rendered map
  const next = {};
  Object.entries(state.carousel.rendered).forEach(([k, v]) => {
    const idx = Number(k);
    if (idx > i) next[idx - 1] = v; else next[idx] = v;
  });
  state.carousel.rendered = next;
  renderSlides();
  await persistSlides();
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
  state.carousel.rendered[i] = url;
  updateExportControls();
}

function setRunStatus(text, cls) {
  const el = document.getElementById('runStatus');
  el.textContent = text;
  el.classList.remove('ok', 'err');
  if (cls) el.classList.add(cls);
}

async function generateSlide(i) {
  const text = state.carousel.slides[i];
  if (!text || !text.trim()) { setSlideStatus(i, 'empty slide', 'err'); return; }
  // Make sure the latest text is persisted before generation
  await persistSlides();
  setSlideStatus(i, 'generating…', 'running');
  try {
    const res = await api(
      'POST',
      `/api/projects/${state.currentProjectSlug}/carousels/${state.currentCarouselSlug}/slides/${i + 1}/generate`,
    );
    setSlideImage(i, res.url);
    setSlideStatus(i, `done in ${Math.round(res.ms / 100) / 10}s`, 'ok');
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
  // Provider badge
  try {
    const cfg = await api('GET', '/api/config');
    state.provider = cfg.provider;
    document.getElementById('providerBadge').textContent =
      `provider: ${cfg.provider} · ${cfg.grok.aspect_ratio} · ${cfg.grok.resolution}`;
  } catch {}

  // Breadcrumb navigation
  document.getElementById('breadcrumb').addEventListener('click', (e) => {
    const a = e.target.closest('a[data-nav]');
    if (!a) return;
    e.preventDefault();
    const to = a.dataset.nav;
    if (to === 'project-list') {
      state.currentProjectSlug = null;
      state.currentCarouselSlug = null;
      state.project = null;
      state.carousel = null;
      loadProjectList().then(() => showView('project-list'));
    } else if (to === 'project-detail') {
      state.currentCarouselSlug = null;
      state.carousel = null;
      loadProjectDetail();
    }
  });

  wireProjectListView();
  wireProjectDetailView();
  wireCarouselDetailView();

  // Restore last location
  const loc = loadLocation();
  if (loc && loc.currentProjectSlug) {
    state.currentProjectSlug = loc.currentProjectSlug;
    try {
      state.project = await api('GET', `/api/projects/${loc.currentProjectSlug}`);
      if (loc.currentCarouselSlug && loc.mode === 'carousel-detail') {
        state.currentCarouselSlug = loc.currentCarouselSlug;
        try {
          state.carousel = await api('GET', `/api/projects/${loc.currentProjectSlug}/carousels/${loc.currentCarouselSlug}`);
          renderProjectDetail();
          renderCarouselDetail();
          showView('carousel-detail');
          return;
        } catch {}
      }
      renderProjectDetail();
      showView('project-detail');
      return;
    } catch {
      // project gone; fall through to list
    }
  }
  await loadProjectList();
  showView('project-list');
}

function wireProjectListView() {
  const dlg = document.getElementById('newProjectDialog');
  document.getElementById('openNewProjectBtn').addEventListener('click', () => {
    document.getElementById('newProjectName').value = '';
    document.getElementById('newProjectDesc').value = '';
    document.getElementById('newProjectPrompt').value = '';
    dlg.hidden = false;
  });
  document.getElementById('cancelNewProject').addEventListener('click', () => { dlg.hidden = true; });
  document.getElementById('createProjectBtn').addEventListener('click', async () => {
    const name = document.getElementById('newProjectName').value.trim();
    if (!name) return alert('name required');
    const description = document.getElementById('newProjectDesc').value.trim();
    const masterPrompt = document.getElementById('newProjectPrompt').value;
    try {
      const result = await api('POST', '/api/projects', { name, description, masterPrompt });
      dlg.hidden = true;
      await loadProjectList();
      openProject(result.slug);
    } catch (e) {
      alert(`create failed: ${e.message}`);
    }
  });
}

function wireProjectDetailView() {
  const name = document.getElementById('projectName');
  const desc = document.getElementById('projectDesc');
  const mp = document.getElementById('masterPrompt');
  const patch = async (body) => {
    try {
      await api('PATCH', `/api/projects/${state.currentProjectSlug}`, body);
    } catch (e) {
      console.warn('patch failed', e);
    }
  };
  name.addEventListener('blur', () => patch({ name: name.value.trim() || state.project.name }));
  desc.addEventListener('blur', () => patch({ description: desc.value }));
  mp.addEventListener('blur', () => patch({ masterPrompt: mp.value }));

  document.getElementById('deleteProjectBtn').addEventListener('click', async () => {
    if (!confirm(`Delete project "${state.project.name}" and all its carousels + renders? This cannot be undone.`)) return;
    try {
      await api('DELETE', `/api/projects/${state.currentProjectSlug}`);
      state.currentProjectSlug = null;
      state.project = null;
      await loadProjectList();
      showView('project-list');
    } catch (e) {
      alert(`delete failed: ${e.message}`);
    }
  });

  // Drag + drop refs
  const dz = document.getElementById('dropzone');
  const refInput = document.getElementById('refInput');
  dz.addEventListener('click', () => refInput.click());
  ['dragenter', 'dragover'].forEach((evt) => dz.addEventListener(evt, (e) => { e.preventDefault(); dz.classList.add('hover'); }));
  ['dragleave', 'drop'].forEach((evt) => dz.addEventListener(evt, (e) => { e.preventDefault(); dz.classList.remove('hover'); }));
  dz.addEventListener('drop', (e) => handleFiles(Array.from(e.dataTransfer.files)));
  refInput.addEventListener('change', () => { handleFiles(Array.from(refInput.files)); refInput.value = ''; });

  async function handleFiles(files) {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    const current = state.project.refs.slice();
    // Turn current refs back into data URIs (so we can replace the whole set)
    const currentDataUris = [];
    for (const url of current) {
      try {
        const resp = await fetch(url);
        const blob = await resp.blob();
        currentDataUris.push(await blobToDataUri(blob));
      } catch {}
    }
    const room = 5 - currentDataUris.length;
    const take = imgs.slice(0, Math.max(room, 0));
    for (const f of take) {
      const b64 = await blobToDataUri(f);
      currentDataUris.push(b64);
    }
    await saveRefs(currentDataUris);
  }

  // New carousel
  const cd = document.getElementById('newCarouselDialog');
  document.getElementById('newCarouselBtn').addEventListener('click', () => {
    document.getElementById('newCarouselTitle').value = '';
    document.getElementById('newCarouselDesc').value = '';
    cd.hidden = false;
  });
  document.getElementById('cancelNewCarousel').addEventListener('click', () => { cd.hidden = true; });
  document.getElementById('createCarouselBtn').addEventListener('click', async () => {
    const title = document.getElementById('newCarouselTitle').value.trim();
    if (!title) return alert('title required');
    const description = document.getElementById('newCarouselDesc').value.trim();
    try {
      const result = await api('POST', `/api/projects/${state.currentProjectSlug}/carousels`, { title, description });
      cd.hidden = true;
      await loadProjectDetail();
      openCarousel(result.slug);
    } catch (e) {
      alert(`create failed: ${e.message}`);
    }
  });
}

function wireCarouselDetailView() {
  const title = document.getElementById('carouselTitle');
  const desc = document.getElementById('carouselDesc');
  const pal = document.getElementById('carouselPalette');
  const override = document.getElementById('masterPromptOverride');

  const patch = async (body) => {
    try {
      await api('PATCH',
        `/api/projects/${state.currentProjectSlug}/carousels/${state.currentCarouselSlug}`,
        body);
    } catch (e) { console.warn('patch failed', e); }
  };
  title.addEventListener('blur', () => patch({ title: title.value.trim() || state.carousel.title }));
  desc.addEventListener('blur', () => patch({ description: desc.value }));
  pal.addEventListener('blur', () => patch({ palette: pal.value }));
  override.addEventListener('blur', async () => {
    const v = override.value;
    await patch({ masterPromptOverride: v });
    state.carousel.masterPromptOverride = v;
    const badge = document.getElementById('overrideBadge');
    badge.textContent = v ? 'using carousel override' : 'using project default';
    badge.classList.toggle('ok', !!v);
  });
  document.getElementById('clearOverrideBtn').addEventListener('click', async () => {
    override.value = '';
    await patch({ masterPromptOverride: '' });
    state.carousel.masterPromptOverride = '';
    const badge = document.getElementById('overrideBadge');
    badge.textContent = 'using project default';
    badge.classList.remove('ok');
  });

  document.getElementById('deleteCarouselBtn').addEventListener('click', async () => {
    if (!confirm(`Delete carousel "${state.carousel.title}" and all its renders?`)) return;
    try {
      await api('DELETE', `/api/projects/${state.currentProjectSlug}/carousels/${state.currentCarouselSlug}`);
      state.currentCarouselSlug = null;
      state.carousel = null;
      await loadProjectDetail();
    } catch (e) {
      alert(`delete failed: ${e.message}`);
    }
  });

  document.getElementById('addSlideBtn').addEventListener('click', async () => {
    state.carousel.slides.push('');
    await persistSlides();
    renderSlides();
  });

  document.getElementById('previewBtn').addEventListener('click', async () => {
    if (!state.carousel.slides[0] || !state.carousel.slides[0].trim()) {
      setRunStatus('slide 1 is empty', 'err');
      return;
    }
    setRunStatus('previewing slide 1…');
    await generateSlide(0);
    setRunStatus('slide 1 done — review it, then fan out 2-N', 'ok');
  });

  document.getElementById('generateAllBtn').addEventListener('click', async () => {
    const indices = state.carousel.slides
      .map((_, i) => i)
      .filter((i) => i !== 0 && state.carousel.slides[i].trim());
    if (indices.length === 0) { setRunStatus('no slides 2-N to generate', 'err'); return; }
    await generateMany(indices);
  });

  document.getElementById('regenAllBtn').addEventListener('click', async () => {
    if (!confirm('Regenerate ALL slides (1-N) in parallel? Replaces existing renders.')) return;
    const indices = state.carousel.slides
      .map((_, i) => i)
      .filter((i) => state.carousel.slides[i].trim());
    state.carousel.rendered = {};
    renderSlides();
    updateExportControls();
    await generateMany(indices);
  });

  document.getElementById('downloadZipBtn').addEventListener('click', () => {
    if (!state.currentProjectSlug || !state.currentCarouselSlug) return;
    const url = `/api/projects/${state.currentProjectSlug}/carousels/${state.currentCarouselSlug}/zip`;
    // Trigger browser download via Content-Disposition header.
    const a = document.createElement('a');
    a.href = url;
    a.download = ''; // let server filename win
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
}

init();
