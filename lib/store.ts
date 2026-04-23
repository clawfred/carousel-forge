"use client"

import { create } from "zustand"

import type { BrandSettings, CarouselProject, ReferenceImage, WorkflowStage } from "./types"

// The reference UI is single-brand. We pin it to a single backend project
// slug and auto-create it on first use. Each "carousel project" in the UI
// maps to a carousel under this project.
const STUDIO_SLUG = "studio"
const STUDIO_NAME = "Studio"

interface GenerationState {
  coverInFlight: boolean
  slidesTotal: number
  slidesDone: number
  error: string | null
}

interface AppState {
  initialized: boolean
  initialize: () => Promise<void>

  brandSettings: BrandSettings
  brandDirty: boolean
  brandSaving: boolean
  updateMasterPrompt: (prompt: string) => void
  addReferenceImage: (url: string, name: string) => void
  removeReferenceImage: (id: string) => void
  saveBrandSettings: () => Promise<void>

  currentProject: CarouselProject | null
  createProject: (name: string) => Promise<void>
  updateProject: (updates: Partial<CarouselProject>) => void
  setStage: (stage: WorkflowStage) => void
  approveCover: () => void
  addSlidePrompts: (prompts: string[]) => Promise<void>
  generateCover: () => Promise<void>
  generateSlides: () => Promise<void>
  resetProject: () => void

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

async function ensureStudioProject(): Promise<void> {
  try {
    await apiFetch(`/api/projects/${STUDIO_SLUG}`)
    return
  } catch {
    // Doesn't exist (or invalid); attempt to create.
  }
  try {
    await apiFetch<{ slug: string }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: STUDIO_NAME, slug: STUDIO_SLUG }),
    })
  } catch (e) {
    // 409 Conflict is fine — another tab may have created it.
    if (!String(errorMessage(e)).toLowerCase().includes("already exists")) {
      throw e
    }
  }
}

interface ProjectDetailApi {
  slug: string
  name: string
  description: string
  masterPrompt: string
  refs: string[]
}

async function blobToDataUri(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const base64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64")
  const mime = blob.type || "image/png"
  return `data:${mime};base64,${base64}`
}

async function urlToDataUri(url: string): Promise<string> {
  const res = await fetch(url)
  const blob = await res.blob()
  return blobToDataUri(blob)
}

function refsToImages(refs: string[]): ReferenceImage[] {
  return refs.map((url) => {
    const filename = url.split("/").pop() || "ref"
    const name = filename.replace(/\.[^/.]+$/, "")
    return { id: url, url, name, addedAt: new Date() }
  })
}

export const useAppStore = create<AppState>((set, get) => ({
  initialized: false,

  initialize: async () => {
    if (get().initialized) return
    try {
      await ensureStudioProject()
      const project = await apiFetch<ProjectDetailApi>(`/api/projects/${STUDIO_SLUG}`)
      set({
        brandSettings: {
          masterPrompt: project.masterPrompt,
          referenceImages: refsToImages(project.refs),
        },
        brandDirty: false,
        initialized: true,
      })
    } catch (e) {
      console.error("[store] initialize failed:", errorMessage(e))
      set({ initialized: true })
    }
  },

  brandSettings: { masterPrompt: "", referenceImages: [] },
  brandDirty: false,
  brandSaving: false,

  updateMasterPrompt: (prompt) =>
    set((state) => ({
      brandSettings: { ...state.brandSettings, masterPrompt: prompt },
      brandDirty: true,
    })),

  addReferenceImage: (url, name) =>
    set((state) => ({
      brandSettings: {
        ...state.brandSettings,
        referenceImages: [
          ...state.brandSettings.referenceImages,
          { id: generateId(), url, name, addedAt: new Date() },
        ],
      },
      brandDirty: true,
    })),

  removeReferenceImage: (id) =>
    set((state) => ({
      brandSettings: {
        ...state.brandSettings,
        referenceImages: state.brandSettings.referenceImages.filter((img) => img.id !== id),
      },
      brandDirty: true,
    })),

  saveBrandSettings: async () => {
    const { brandSettings, brandDirty } = get()
    if (!brandDirty) return
    set({ brandSaving: true })
    try {
      await apiFetch(`/api/projects/${STUDIO_SLUG}`, {
        method: "PATCH",
        body: JSON.stringify({ masterPrompt: brandSettings.masterPrompt }),
      })

      // The refs endpoint replaces the full set. Re-hydrate any remote refs
      // back to data URIs so nothing is lost.
      const dataUris: string[] = []
      for (const img of brandSettings.referenceImages) {
        if (img.url.startsWith("data:")) dataUris.push(img.url)
        else dataUris.push(await urlToDataUri(img.url))
      }
      const saved = await apiFetch<{ refs: string[] }>(
        `/api/projects/${STUDIO_SLUG}/refs`,
        {
          method: "POST",
          body: JSON.stringify({ refs: dataUris }),
        },
      )
      set({
        brandSettings: {
          masterPrompt: brandSettings.masterPrompt,
          referenceImages: refsToImages(saved.refs),
        },
        brandDirty: false,
      })
    } finally {
      set({ brandSaving: false })
    }
  },

  currentProject: null,

  createProject: async (rawName) => {
    const name = rawName.trim() || `Carousel ${new Date().toLocaleDateString()}`
    try {
      await ensureStudioProject()
      // Generate a unique-enough slug to avoid 409 collisions on same title.
      const requestedSlug = `${slugify(name)}-${generateId()}`
      const { slug } = await apiFetch<{ slug: string }>(
        `/api/projects/${STUDIO_SLUG}/carousels`,
        {
          method: "POST",
          body: JSON.stringify({ title: name, slug: requestedSlug }),
        },
      )
      set({
        currentProject: {
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
        generation: { coverInFlight: false, slidesTotal: 0, slidesDone: 0, error: null },
      })
    } catch (e) {
      console.error("[store] createProject failed:", errorMessage(e))
      set((state) => ({
        generation: { ...state.generation, error: errorMessage(e) },
      }))
    }
  },

  updateProject: (updates) =>
    set((state) => ({
      currentProject: state.currentProject ? { ...state.currentProject, ...updates } : null,
    })),

  setStage: (stage) =>
    set((state) => ({
      currentProject: state.currentProject ? { ...state.currentProject, status: stage } : null,
    })),

  approveCover: () =>
    set((state) => ({
      currentProject: state.currentProject
        ? { ...state.currentProject, coverApproved: true, status: "slides-input" }
        : null,
    })),

  addSlidePrompts: async (prompts) => {
    const state = get()
    const project = state.currentProject
    if (!project) return
    const slides = [project.coverPrompt.trim(), ...prompts.map((p) => p.trim())]
    try {
      await apiFetch(`/api/projects/${STUDIO_SLUG}/carousels/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          goal: project.goal,
          idea: project.coreIdea,
          slides,
        }),
      })
    } catch (e) {
      console.error("[store] addSlidePrompts PATCH failed:", errorMessage(e))
      set((s) => ({ generation: { ...s.generation, error: errorMessage(e) } }))
      return
    }
    set({
      currentProject: {
        ...project,
        slidePrompts: prompts,
        slideImages: [],
        status: "production",
      },
      generation: { coverInFlight: false, slidesTotal: prompts.length, slidesDone: 0, error: null },
    })
  },

  generateCover: async () => {
    const project = get().currentProject
    if (!project) return
    set({
      generation: { ...get().generation, coverInFlight: true, error: null },
    })
    try {
      // Persist the brief + cover prompt as slide 1 before firing generation.
      await apiFetch(`/api/projects/${STUDIO_SLUG}/carousels/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          goal: project.goal,
          idea: project.coreIdea,
          slides: [project.coverPrompt.trim()],
        }),
      })
      const result = await apiFetch<{ url: string }>(
        `/api/projects/${STUDIO_SLUG}/carousels/${project.id}/slides/1/generate`,
        { method: "POST" },
      )
      set((state) => ({
        currentProject: state.currentProject
          ? { ...state.currentProject, coverImage: result.url }
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
    const project = get().currentProject
    if (!project) return
    const total = project.slidePrompts.length
    set({ generation: { coverInFlight: false, slidesTotal: total, slidesDone: 0, error: null } })

    const results: Array<{ index: number; url: string } | null> = new Array(total).fill(null)
    let hadError: string | null = null

    await Promise.all(
      project.slidePrompts.map(async (_, i) => {
        const slideNumber = i + 2 // cover is slide 1
        try {
          const out = await apiFetch<{ url: string }>(
            `/api/projects/${STUDIO_SLUG}/carousels/${project.id}/slides/${slideNumber}/generate`,
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
      currentProject: state.currentProject
        ? {
            ...state.currentProject,
            slideImages,
            status: hadError ? "production" : "complete",
          }
        : null,
      generation: { ...state.generation, error: hadError },
    }))
  },

  resetProject: () =>
    set({
      currentProject: null,
      generation: { coverInFlight: false, slidesTotal: 0, slidesDone: 0, error: null },
    }),

  generation: { coverInFlight: false, slidesTotal: 0, slidesDone: 0, error: null },

  showBrandSettings: false,
  toggleBrandSettings: () => set((state) => ({ showBrandSettings: !state.showBrandSettings })),
}))

export const STUDIO_PROJECT_SLUG = STUDIO_SLUG
