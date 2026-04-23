"use client"

import { create } from "zustand"

import type { BrandSettings, CarouselProject, ReferenceImage, WorkflowStage } from "./types"

interface GenerationState {
  coverInFlight: boolean
  slidesTotal: number
  slidesDone: number
  error: string | null
}

export interface CarouselSummary {
  slug: string
  title: string
  slideCount: number
  renderedCount: number
  coverUrl: string | null
  updatedAt: number
}

export interface ProjectSummary {
  slug: string
  name: string
  description: string
  carouselCount: number
  installedFrom: string | null
}

interface AppState {
  initialized: boolean
  initialize: () => Promise<void>

  // Top-level projects (workspaces).
  projects: ProjectSummary[]
  projectsLoading: boolean
  currentProjectSlug: string | null
  currentProjectName: string | null
  refreshProjects: () => Promise<void>
  selectProject: (slug: string) => Promise<void>
  leaveProject: () => void
  createProject: (name: string) => Promise<void>
  deleteProject: (slug: string) => Promise<void>

  // Brand settings, scoped to the currently selected project.
  brandSettings: BrandSettings
  brandPromptDirty: boolean
  brandPromptSaving: boolean
  updateMasterPrompt: (prompt: string) => void
  saveMasterPrompt: () => Promise<void>
  addReferenceImage: (dataUri: string, name: string) => Promise<void>
  removeReferenceImage: (id: string) => Promise<void>

  // Carousels within the current project.
  recentCarousels: CarouselSummary[]
  recentsLoading: boolean
  refreshRecents: () => Promise<void>
  openCarousel: (slug: string) => Promise<void>
  deleteCarousel: (slug: string) => Promise<void>

  // Currently open carousel (the workflow target).
  currentCarousel: CarouselProject | null
  createCarousel: (name: string) => Promise<void>
  updateCarousel: (updates: Partial<CarouselProject>) => void
  setStage: (stage: WorkflowStage) => void
  approveCover: () => void
  addSlidePrompts: (prompts: string[]) => Promise<void>
  generateCover: () => Promise<void>
  generateSlides: () => Promise<void>
  resetCarousel: () => void

  generation: GenerationState

  showBrandSettings: boolean
  toggleBrandSettings: () => void
}

const generateId = () => Math.random().toString(36).substring(2, 9)

function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  })
  const text = await res.text()
  let json: unknown = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      // fall through; non-JSON is treated as error below
    }
  }
  if (!res.ok) {
    const message =
      json && typeof json === "object" && "error" in json
        ? String((json as { error: unknown }).error)
        : `HTTP ${res.status}`
    throw new Error(message)
  }
  return json as T
}

interface ProjectsListApi {
  projects: ProjectSummary[]
}

interface ProjectDetailApi {
  slug: string
  name: string
  description: string
  masterPrompt: string
  refs: string[]
  carousels: CarouselSummary[]
}

interface CarouselDetailApi {
  slug: string
  title: string
  description: string
  goal: string
  idea: string
  palette: string
  masterPromptOverride: string
  slides: string[]
  rendered: Record<number, string>
}

function deriveStage(detail: CarouselDetailApi): WorkflowStage {
  const n = detail.slides.length
  if (n === 0) return "brief"
  const coverRendered = Boolean(detail.rendered[0])
  if (n === 1) return coverRendered ? "cover-review" : "brief"
  let rendered = 0
  for (let i = 0; i < n; i++) if (detail.rendered[i]) rendered++
  if (rendered >= n) return "complete"
  if (coverRendered) return "slides-input"
  return "brief"
}

function filenameFromRefUrl(url: string): string {
  return url.split("/").pop() || ""
}

function refsToImages(refs: string[]): ReferenceImage[] {
  return refs.map((url) => {
    const filename = filenameFromRefUrl(url)
    const name = filename.replace(/\.[^/.]+$/, "")
    return { id: filename, url, name, addedAt: new Date(), uploading: false }
  })
}

const emptyBrand: BrandSettings = { masterPrompt: "", referenceImages: [] }
const emptyGeneration: GenerationState = {
  coverInFlight: false,
  slidesTotal: 0,
  slidesDone: 0,
  error: null,
}

export const useAppStore = create<AppState>((set, get) => ({
  initialized: false,

  initialize: async () => {
    if (get().initialized) return
    try {
      await get().refreshProjects()
    } finally {
      set({ initialized: true })
    }
  },

  projects: [],
  projectsLoading: false,
  currentProjectSlug: null,
  currentProjectName: null,

  refreshProjects: async () => {
    set({ projectsLoading: true })
    try {
      const { projects } = await apiFetch<ProjectsListApi>("/api/projects")
      set({ projects })
    } catch (e) {
      console.error("[store] refreshProjects failed:", errorMessage(e))
    } finally {
      set({ projectsLoading: false })
    }
  },

  selectProject: async (slug) => {
    try {
      const project = await apiFetch<ProjectDetailApi>(`/api/projects/${slug}`)
      set({
        currentProjectSlug: project.slug,
        currentProjectName: project.name,
        brandSettings: {
          masterPrompt: project.masterPrompt,
          referenceImages: refsToImages(project.refs),
        },
        brandPromptDirty: false,
        recentCarousels: project.carousels,
        currentCarousel: null,
        generation: { ...emptyGeneration },
      })
    } catch (e) {
      console.error("[store] selectProject failed:", errorMessage(e))
    }
  },

  leaveProject: () => {
    set({
      currentProjectSlug: null,
      currentProjectName: null,
      brandSettings: { ...emptyBrand },
      brandPromptDirty: false,
      recentCarousels: [],
      currentCarousel: null,
      generation: { ...emptyGeneration },
    })
    void get().refreshProjects()
  },

  createProject: async (rawName) => {
    const name = rawName.trim()
    if (!name) return
    const requestedSlug = `${slugify(name)}-${generateId()}`
    try {
      const { slug } = await apiFetch<{ slug: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name, slug: requestedSlug }),
      })
      await get().refreshProjects()
      await get().selectProject(slug)
    } catch (e) {
      console.error("[store] createProject failed:", errorMessage(e))
    }
  },

  deleteProject: async (slug) => {
    try {
      await apiFetch(`/api/projects/${slug}`, { method: "DELETE" })
    } catch (e) {
      console.error("[store] deleteProject failed:", errorMessage(e))
      return
    }
    set((state) => {
      const wasCurrent = state.currentProjectSlug === slug
      return {
        projects: state.projects.filter((p) => p.slug !== slug),
        ...(wasCurrent
          ? {
              currentProjectSlug: null,
              currentProjectName: null,
              brandSettings: { ...emptyBrand },
              recentCarousels: [],
              currentCarousel: null,
            }
          : {}),
      }
    })
  },

  brandSettings: { ...emptyBrand },
  brandPromptDirty: false,
  brandPromptSaving: false,

  updateMasterPrompt: (prompt) =>
    set((state) => ({
      brandSettings: { ...state.brandSettings, masterPrompt: prompt },
      brandPromptDirty: true,
    })),

  saveMasterPrompt: async () => {
    const { brandSettings, brandPromptDirty, currentProjectSlug } = get()
    if (!brandPromptDirty || !currentProjectSlug) return
    set({ brandPromptSaving: true })
    try {
      await apiFetch(`/api/projects/${currentProjectSlug}`, {
        method: "PATCH",
        body: JSON.stringify({ masterPrompt: brandSettings.masterPrompt }),
      })
      set({ brandPromptDirty: false })
    } finally {
      set({ brandPromptSaving: false })
    }
  },

  addReferenceImage: async (dataUri, name) => {
    const slug = get().currentProjectSlug
    if (!slug) return
    const tempId = `temp-${generateId()}`
    set((state) => ({
      brandSettings: {
        ...state.brandSettings,
        referenceImages: [
          ...state.brandSettings.referenceImages,
          { id: tempId, url: dataUri, name, addedAt: new Date(), uploading: true },
        ],
      },
    }))
    try {
      const { filename, ref } = await apiFetch<{ filename: string; ref: string }>(
        `/api/projects/${slug}/refs`,
        {
          method: "POST",
          body: JSON.stringify({ dataUri }),
        },
      )
      set((state) => ({
        brandSettings: {
          ...state.brandSettings,
          referenceImages: state.brandSettings.referenceImages.map((img) =>
            img.id === tempId
              ? { id: filename, url: ref, name, addedAt: img.addedAt, uploading: false }
              : img,
          ),
        },
      }))
    } catch (e) {
      console.error("[store] addReferenceImage failed:", errorMessage(e))
      set((state) => ({
        brandSettings: {
          ...state.brandSettings,
          referenceImages: state.brandSettings.referenceImages.filter((img) => img.id !== tempId),
        },
      }))
    }
  },

  removeReferenceImage: async (id) => {
    const slug = get().currentProjectSlug
    if (!slug) return
    const img = get().brandSettings.referenceImages.find((r) => r.id === id)
    if (!img) return

    set((state) => ({
      brandSettings: {
        ...state.brandSettings,
        referenceImages: state.brandSettings.referenceImages.filter((r) => r.id !== id),
      },
    }))

    // Still uploading — nothing on disk to delete.
    if (img.uploading) return

    try {
      await apiFetch(`/api/projects/${slug}/refs/${id}`, { method: "DELETE" })
    } catch (e) {
      console.error("[store] removeReferenceImage failed:", errorMessage(e))
    }
  },

  recentCarousels: [],
  recentsLoading: false,

  refreshRecents: async () => {
    const slug = get().currentProjectSlug
    if (!slug) return
    set({ recentsLoading: true })
    try {
      const project = await apiFetch<ProjectDetailApi>(`/api/projects/${slug}`)
      set({ recentCarousels: project.carousels })
    } catch (e) {
      console.error("[store] refreshRecents failed:", errorMessage(e))
    } finally {
      set({ recentsLoading: false })
    }
  },

  openCarousel: async (slug) => {
    const projectSlug = get().currentProjectSlug
    if (!projectSlug) return
    try {
      const detail = await apiFetch<CarouselDetailApi>(
        `/api/projects/${projectSlug}/carousels/${slug}`,
      )
      const stage = deriveStage(detail)
      const coverImage = detail.rendered[0] || null
      const slidePrompts = detail.slides.slice(1)
      const slideImages = slidePrompts.map((_, i) => detail.rendered[i + 1] || "")
      set({
        currentCarousel: {
          id: detail.slug,
          name: detail.title,
          goal: detail.goal,
          coreIdea: detail.idea,
          coverPrompt: detail.slides[0] || "",
          coverImage,
          coverApproved: stage === "slides-input" || stage === "production" || stage === "complete",
          slidePrompts,
          slideImages,
          status: stage,
          createdAt: new Date(),
        },
        generation: {
          coverInFlight: false,
          slidesTotal: slidePrompts.length,
          slidesDone: slidePrompts.filter((_, i) => Boolean(detail.rendered[i + 1])).length,
          error: null,
        },
      })
    } catch (e) {
      console.error("[store] openCarousel failed:", errorMessage(e))
    }
  },

  deleteCarousel: async (slug) => {
    const projectSlug = get().currentProjectSlug
    if (!projectSlug) return
    try {
      await apiFetch(`/api/projects/${projectSlug}/carousels/${slug}`, { method: "DELETE" })
    } catch (e) {
      console.error("[store] deleteCarousel failed:", errorMessage(e))
      return
    }
    set((state) => ({
      recentCarousels: state.recentCarousels.filter((c) => c.slug !== slug),
    }))
  },

  currentCarousel: null,

  createCarousel: async (rawName) => {
    const projectSlug = get().currentProjectSlug
    if (!projectSlug) return
    const name = rawName.trim() || `Carousel ${new Date().toLocaleDateString()}`
    try {
      const requestedSlug = `${slugify(name)}-${generateId()}`
      const { slug } = await apiFetch<{ slug: string }>(
        `/api/projects/${projectSlug}/carousels`,
        {
          method: "POST",
          body: JSON.stringify({ title: name, slug: requestedSlug }),
        },
      )
      set({
        currentCarousel: {
          id: slug,
          name,
          goal: "",
          coreIdea: "",
          coverPrompt: "",
          coverImage: null,
          coverApproved: false,
          slidePrompts: [],
          slideImages: [],
          status: "brief",
          createdAt: new Date(),
        },
        generation: { ...emptyGeneration },
      })
      void get().refreshRecents()
    } catch (e) {
      console.error("[store] createCarousel failed:", errorMessage(e))
      set((state) => ({
        generation: { ...state.generation, error: errorMessage(e) },
      }))
    }
  },

  updateCarousel: (updates) =>
    set((state) => ({
      currentCarousel: state.currentCarousel ? { ...state.currentCarousel, ...updates } : null,
    })),

  setStage: (stage) =>
    set((state) => ({
      currentCarousel: state.currentCarousel ? { ...state.currentCarousel, status: stage } : null,
    })),

  approveCover: () =>
    set((state) => ({
      currentCarousel: state.currentCarousel
        ? { ...state.currentCarousel, coverApproved: true, status: "slides-input" }
        : null,
    })),

  addSlidePrompts: async (prompts) => {
    const state = get()
    const projectSlug = state.currentProjectSlug
    const carousel = state.currentCarousel
    if (!projectSlug || !carousel) return
    const slides = [carousel.coverPrompt.trim(), ...prompts.map((p) => p.trim())]
    try {
      await apiFetch(`/api/projects/${projectSlug}/carousels/${carousel.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          goal: carousel.goal,
          idea: carousel.coreIdea,
          slides,
        }),
      })
    } catch (e) {
      console.error("[store] addSlidePrompts PATCH failed:", errorMessage(e))
      set((s) => ({ generation: { ...s.generation, error: errorMessage(e) } }))
      return
    }
    set({
      currentCarousel: {
        ...carousel,
        slidePrompts: prompts,
        slideImages: [],
        status: "production",
      },
      generation: { coverInFlight: false, slidesTotal: prompts.length, slidesDone: 0, error: null },
    })
  },

  generateCover: async () => {
    const projectSlug = get().currentProjectSlug
    const carousel = get().currentCarousel
    if (!projectSlug || !carousel) return
    set({
      generation: { ...get().generation, coverInFlight: true, error: null },
    })
    try {
      await apiFetch(`/api/projects/${projectSlug}/carousels/${carousel.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          goal: carousel.goal,
          idea: carousel.coreIdea,
          slides: [carousel.coverPrompt.trim()],
        }),
      })
      const result = await apiFetch<{ url: string }>(
        `/api/projects/${projectSlug}/carousels/${carousel.id}/slides/1/generate`,
        { method: "POST" },
      )
      set((state) => ({
        currentCarousel: state.currentCarousel
          ? { ...state.currentCarousel, coverImage: result.url }
          : null,
        generation: { ...state.generation, coverInFlight: false },
      }))
    } catch (e) {
      set((state) => ({
        generation: { ...state.generation, coverInFlight: false, error: errorMessage(e) },
      }))
    }
  },

  generateSlides: async () => {
    const projectSlug = get().currentProjectSlug
    const carousel = get().currentCarousel
    if (!projectSlug || !carousel) return
    const total = carousel.slidePrompts.length
    set({ generation: { coverInFlight: false, slidesTotal: total, slidesDone: 0, error: null } })

    const results: Array<{ index: number; url: string } | null> = new Array(total).fill(null)
    let hadError: string | null = null

    await Promise.all(
      carousel.slidePrompts.map(async (_, i) => {
        const slideNumber = i + 2 // cover is slide 1
        try {
          const out = await apiFetch<{ url: string }>(
            `/api/projects/${projectSlug}/carousels/${carousel.id}/slides/${slideNumber}/generate`,
            { method: "POST" },
          )
          results[i] = { index: i, url: out.url }
        } catch (e) {
          if (!hadError) hadError = errorMessage(e)
        } finally {
          set((state) => ({
            generation: { ...state.generation, slidesDone: state.generation.slidesDone + 1 },
          }))
        }
      }),
    )

    const slideImages = results.map((r) => r?.url || "")
    set((state) => ({
      currentCarousel: state.currentCarousel
        ? {
            ...state.currentCarousel,
            slideImages,
            status: hadError ? "production" : "complete",
          }
        : null,
      generation: { ...state.generation, error: hadError },
    }))
  },

  resetCarousel: () => {
    set({
      currentCarousel: null,
      generation: { ...emptyGeneration },
    })
    void get().refreshRecents()
  },

  generation: { ...emptyGeneration },

  showBrandSettings: false,
  toggleBrandSettings: () => set((state) => ({ showBrandSettings: !state.showBrandSettings })),
}))
