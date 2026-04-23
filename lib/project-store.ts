import path from "node:path";

import { slideNumberFromFilename } from "@/lib/image";
import {
  dirExists,
  listDirs,
  listFiles,
  PRESETS_DIR,
  PROJECTS_DIR,
  readJson,
  safeJoin,
  validSlug,
} from "@/lib/storage";

interface ProjectMeta {
  name?: string;
  description?: string;
  masterPrompt?: string;
  installedFrom?: string | null;
}

interface CarouselMeta {
  title?: string;
  description?: string;
  goal?: string;
  idea?: string;
  palette?: string;
  masterPromptOverride?: string;
}

interface BrandMeta {
  name?: string;
  description?: string;
  masterPrompt?: string;
}

export interface CarouselSummary {
  slug: string;
  title: string;
  description: string;
  palette: string;
  slideCount: number;
  renderedCount: number;
}

export interface ProjectDetail {
  slug: string;
  name: string;
  description: string;
  masterPrompt: string;
  installedFrom: string | null;
  refs: string[];
  carousels: CarouselSummary[];
}

export interface CarouselDetail {
  slug: string;
  title: string;
  description: string;
  goal: string;
  idea: string;
  palette: string;
  masterPromptOverride: string;
  slides: string[];
  rendered: Record<number, string>;
}

export interface PresetSummary {
  slug: string;
  name: string;
  description: string;
  carousels: Array<{ slug: string; title: string; description: string }>;
}

const IMAGE_EXT_RE = /\.(png|jpg|jpeg|webp)$/i;

export async function readProject(slug: string): Promise<ProjectDetail | null> {
  if (!validSlug(slug)) throw new Error(`invalid project slug: ${slug}`);
  const base = safeJoin(PROJECTS_DIR, slug);
  if (!(await dirExists(base))) return null;

  const meta = await readJson<ProjectMeta>(path.join(base, "project.json"), {
    name: slug,
    description: "",
    masterPrompt: "",
  });

  const refsDir = path.join(base, "refs");
  const refFiles = (await listFiles(refsDir)).sort();
  const refs = refFiles.map((f) => `/projects/${slug}/refs/${f}`);

  const carouselSlugs = (await listDirs(path.join(base, "carousels"))).sort();
  const carousels: CarouselSummary[] = [];
  for (const cslug of carouselSlugs) {
    const c = await readCarouselSummary(slug, cslug);
    if (c) carousels.push(c);
  }

  return {
    slug,
    name: meta.name || slug,
    description: meta.description || "",
    masterPrompt: meta.masterPrompt || "",
    installedFrom: meta.installedFrom || null,
    refs,
    carousels,
  };
}

export async function readCarouselSummary(
  projectSlug: string,
  cslug: string,
): Promise<CarouselSummary | null> {
  if (!validSlug(cslug)) return null;
  const base = safeJoin(PROJECTS_DIR, projectSlug, "carousels", cslug);
  if (!(await dirExists(base))) return null;
  const meta = await readJson<CarouselMeta>(path.join(base, "metadata.json"), {});
  const slides = await readJson<string[]>(path.join(base, "slides.json"), []);
  const rendered = await listFiles(path.join(base, "slides"));
  const slideCount = Array.isArray(slides) ? slides.length : 0;
  return {
    slug: cslug,
    title: meta.title || cslug,
    description: meta.description || "",
    palette: meta.palette || "",
    slideCount,
    renderedCount: rendered.filter((f) => {
      if (!IMAGE_EXT_RE.test(f)) return false;
      const n = slideNumberFromFilename(f);
      return n !== null && n >= 1 && n <= slideCount;
    }).length,
  };
}

export async function readCarousel(
  projectSlug: string,
  cslug: string,
): Promise<CarouselDetail | null> {
  if (!validSlug(cslug)) throw new Error(`invalid carousel slug: ${cslug}`);
  const base = safeJoin(PROJECTS_DIR, projectSlug, "carousels", cslug);
  if (!(await dirExists(base))) return null;

  const meta = await readJson<CarouselMeta>(path.join(base, "metadata.json"), {});
  const slides = await readJson<string[]>(path.join(base, "slides.json"), []);
  const normalizedSlides = Array.isArray(slides) ? slides : [];

  const slidesDir = path.join(base, "slides");
  const rendered: Record<number, string> = {};
  const files = await listFiles(slidesDir);
  for (const f of files) {
    if (!IMAGE_EXT_RE.test(f)) continue;
    const n = slideNumberFromFilename(f);
    if (n === null) continue;
    const idx = n - 1;
    if (idx < 0 || idx >= normalizedSlides.length) continue;
    rendered[idx] = `/projects/${projectSlug}/carousels/${cslug}/slides/${f}`;
  }

  return {
    slug: cslug,
    title: meta.title || cslug,
    description: meta.description || "",
    goal: meta.goal || "",
    idea: meta.idea || "",
    palette: meta.palette || "",
    masterPromptOverride: meta.masterPromptOverride || "",
    slides: normalizedSlides,
    rendered,
  };
}

export async function readPreset(slug: string): Promise<PresetSummary | null> {
  if (!validSlug(slug)) return null;
  const base = safeJoin(PRESETS_DIR, slug);
  if (!(await dirExists(base))) return null;
  const brand = await readJson<BrandMeta | null>(path.join(base, "brand.json"), null);
  if (!brand) return null;
  const carouselSlugs = (await listDirs(path.join(base, "carousels"))).sort();
  const carousels: PresetSummary["carousels"] = [];
  for (const cslug of carouselSlugs) {
    const meta = await readJson<CarouselMeta>(
      path.join(base, "carousels", cslug, "metadata.json"),
      {},
    );
    carousels.push({
      slug: cslug,
      title: meta.title || cslug,
      description: meta.description || "",
    });
  }
  return {
    slug,
    name: brand.name || slug,
    description: brand.description || "",
    carousels,
  };
}
