import type {
  CarouselSummary,
  ProjectSummary,
  ReferenceImage,
} from "./types"

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []
}

export function parseProjectSummaries(v: unknown): ProjectSummary[] {
  if (!Array.isArray(v)) return []
  const out: ProjectSummary[] = []
  for (const item of v) {
    const o = obj(item)
    const slug = str(o.slug)
    if (!slug) continue
    out.push({
      slug,
      name: str(o.name, slug),
      description: str(o.description),
      carouselCount: num(o.carouselCount),
      installedFrom: typeof o.installedFrom === "string" ? o.installedFrom : null,
    })
  }
  return out
}

export interface ProjectDetail {
  slug: string
  name: string
  description: string
  masterPrompt: string
  refs: string[]
  carousels: CarouselSummary[]
}

export function parseProjectDetail(v: unknown): ProjectDetail | null {
  const o = obj(v)
  const slug = str(o.slug)
  if (!slug) return null
  return {
    slug,
    name: str(o.name, slug),
    description: str(o.description),
    masterPrompt: str(o.masterPrompt),
    refs: strArr(o.refs),
    carousels: parseCarouselSummaries(o.carousels),
  }
}

export function parseCarouselSummaries(v: unknown): CarouselSummary[] {
  if (!Array.isArray(v)) return []
  const out: CarouselSummary[] = []
  for (const item of v) {
    const o = obj(item)
    const slug = str(o.slug)
    if (!slug) continue
    out.push({
      slug,
      title: str(o.title, slug),
      slideCount: num(o.slideCount),
      renderedCount: num(o.renderedCount),
      coverUrl: typeof o.coverUrl === "string" ? o.coverUrl : null,
      updatedAt: num(o.updatedAt),
    })
  }
  return out
}

export interface CarouselDetailPayload {
  slug: string
  title: string
  goal: string
  idea: string
  slides: string[]
  rendered: Record<number, string>
}

export function parseCarouselDetail(v: unknown): CarouselDetailPayload | null {
  const o = obj(v)
  const slug = str(o.slug)
  if (!slug) return null
  return {
    slug,
    title: str(o.title, slug),
    goal: str(o.goal),
    idea: str(o.idea),
    slides: strArr(o.slides),
    rendered: parseRendered(o.rendered),
  }
}

function parseRendered(v: unknown): Record<number, string> {
  const o = obj(v)
  const out: Record<number, string> = {}
  for (const [k, val] of Object.entries(o)) {
    const n = Number(k)
    if (!Number.isInteger(n)) continue
    if (typeof val === "string") out[n] = val
  }
  return out
}

export function refsToImages(refs: string[]): ReferenceImage[] {
  return refs.map((url) => {
    const filename = url.split("/").pop() || ""
    const name = filename.replace(/\.[^/.]+$/, "")
    return { id: filename, url, name, addedAt: new Date(), uploading: false }
  })
}
