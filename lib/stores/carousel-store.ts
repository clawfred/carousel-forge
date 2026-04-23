"use client"

import { create } from "zustand"

import { apiFetch, errorMessage } from "@/lib/api"
import { logError } from "@/lib/log"
import { genShortId, slugify } from "@/lib/slug"
import type {
  CarouselProject,
  CarouselSummary,
  WorkflowStage,
} from "@/lib/types"
import {
  parseCarouselDetail,
  parseCarouselSummaries,
  type CarouselDetailPayload,
} from "@/lib/validators"

import { useGenerationStore } from "./generation-store"
import { useProjectStore } from "./project-store"

interface CarouselState {
  recentCarousels: CarouselSummary[]
  recentsLoading: boolean
  currentCarousel: CarouselProject | null

  hydrateRecents: (list: CarouselSummary[]) => void
  refreshRecents: () => Promise<void>
  openCarousel: (slug: string) => Promise<void>
  deleteCarousel: (slug: string) => Promise<void>
  createCarousel: (name: string) => Promise<void>
  updateCurrent: (updates: Partial<CarouselProject>) => void
  setStage: (stage: WorkflowStage) => void
  approveCover: () => void
  addSlidePrompts: (prompts: string[]) => Promise<void>
  closeCarousel: () => void
  reset: () => void
}

export const useCarouselStore = create<CarouselState>((set, get) => ({
  recentCarousels: [],
  recentsLoading: false,
  currentCarousel: null,

  hydrateRecents: (list) => set({ recentCarousels: list }),

  reset: () => {
    useGenerationStore.getState().reset()
    set({ recentCarousels: [], recentsLoading: false, currentCarousel: null })
  },

  refreshRecents: async () => {
    const slug = useProjectStore.getState().currentProjectSlug
    if (!slug) return
    set({ recentsLoading: true })
    try {
      const raw = await apiFetch<unknown>(`/api/projects/${slug}`)
      const carousels = parseCarouselSummaries(
        (raw as { carousels?: unknown })?.carousels,
      )
      set({ recentCarousels: carousels })
    } catch (e) {
      logError("carousel-store.refreshRecents", e)
    } finally {
      set({ recentsLoading: false })
    }
  },

  openCarousel: async (slug) => {
    const projectSlug = useProjectStore.getState().currentProjectSlug
    if (!projectSlug) return
    useGenerationStore.getState().reset()
    try {
      const raw = await apiFetch<unknown>(
        `/api/projects/${projectSlug}/carousels/${slug}`,
      )
      const detail = parseCarouselDetail(raw)
      if (!detail) throw new Error("Invalid carousel response")

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
          coverApproved:
            stage === "slides-input" || stage === "production" || stage === "complete",
          slidePrompts,
          slideImages,
          status: stage,
          createdAt: new Date(),
        },
      })
      useGenerationStore.getState().hydrate({
        slidesTotal: slidePrompts.length,
        slidesDone: slidePrompts.filter((_, i) => Boolean(detail.rendered[i + 1]))
          .length,
      })
    } catch (e) {
      logError("carousel-store.openCarousel", e)
    }
  },

  deleteCarousel: async (slug) => {
    const projectSlug = useProjectStore.getState().currentProjectSlug
    if (!projectSlug) return
    try {
      await apiFetch(`/api/projects/${projectSlug}/carousels/${slug}`, {
        method: "DELETE",
      })
    } catch (e) {
      logError("carousel-store.deleteCarousel", e)
      return
    }
    set((state) => ({
      recentCarousels: state.recentCarousels.filter((c) => c.slug !== slug),
    }))
  },

  createCarousel: async (rawName) => {
    const projectSlug = useProjectStore.getState().currentProjectSlug
    if (!projectSlug) return
    const name = rawName.trim() || `Carousel ${new Date().toLocaleDateString()}`
    try {
      const requestedSlug = `${slugify(name, 40)}-${genShortId()}`
      const out = await apiFetch<{ slug?: unknown }>(
        `/api/projects/${projectSlug}/carousels`,
        {
          method: "POST",
          body: JSON.stringify({ title: name, slug: requestedSlug }),
        },
      )
      const slug = typeof out.slug === "string" ? out.slug : null
      if (!slug) throw new Error("Missing slug in response")
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
      })
      useGenerationStore.getState().reset()
      void get().refreshRecents()
    } catch (e) {
      logError("carousel-store.createCarousel", e)
      useGenerationStore.setState({ error: errorMessage(e) })
    }
  },

  updateCurrent: (updates) =>
    set((state) => ({
      currentCarousel: state.currentCarousel
        ? { ...state.currentCarousel, ...updates }
        : null,
    })),

  setStage: (stage) =>
    set((state) => ({
      currentCarousel: state.currentCarousel
        ? { ...state.currentCarousel, status: stage }
        : null,
    })),

  approveCover: () =>
    set((state) => ({
      currentCarousel: state.currentCarousel
        ? { ...state.currentCarousel, coverApproved: true, status: "slides-input" }
        : null,
    })),

  // PATCH first, then flip to production and kick off generation inline. The
  // status flip is deliberately paired with the generation call so there's no
  // window where the UI sits on the Production stage without work in flight.
  addSlidePrompts: async (prompts) => {
    const projectSlug = useProjectStore.getState().currentProjectSlug
    const carousel = get().currentCarousel
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
      logError("carousel-store.addSlidePrompts", e)
      useGenerationStore.setState({ error: errorMessage(e) })
      return
    }
    set({
      currentCarousel: {
        ...carousel,
        slidePrompts: prompts,
        slideImages: [],
        status: "production",
      },
    })
    useGenerationStore.getState().hydrate({
      slidesTotal: prompts.length,
      slidesDone: 0,
    })
    await useGenerationStore.getState().generateSlides()
  },

  closeCarousel: () => {
    useGenerationStore.getState().reset()
    set({ currentCarousel: null })
    void get().refreshRecents()
  },
}))

function deriveStage(detail: CarouselDetailPayload): WorkflowStage {
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
