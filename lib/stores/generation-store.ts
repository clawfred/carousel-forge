"use client"

import { create } from "zustand"

import { apiFetch, errorMessage, isAbortError } from "@/lib/api"

import { useCarouselStore } from "./carousel-store"
import { useProjectStore } from "./project-store"

interface GenerationState {
  coverInFlight: boolean
  slidesTotal: number
  slidesDone: number
  error: string | null

  generateCover: () => Promise<void>
  generateSlides: () => Promise<void>
  cancel: () => void
  reset: () => void
  hydrate: (input: { slidesTotal: number; slidesDone: number }) => void
}

const empty = {
  coverInFlight: false,
  slidesTotal: 0,
  slidesDone: 0,
  error: null as string | null,
}

// Module-level so multiple calls to the store share the same controller and
// `cancel()` can abort in-flight fetches deterministically.
let controller: AbortController | null = null

function freshController(): AbortController {
  controller?.abort()
  const c = new AbortController()
  controller = c
  return c
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  ...empty,

  hydrate: ({ slidesTotal, slidesDone }) =>
    set({ ...empty, slidesTotal, slidesDone }),

  cancel: () => {
    controller?.abort()
    controller = null
  },

  reset: () => {
    get().cancel()
    set({ ...empty })
  },

  generateCover: async () => {
    const projectSlug = useProjectStore.getState().currentProjectSlug
    const carousel = useCarouselStore.getState().currentCarousel
    if (!projectSlug || !carousel) return

    const c = freshController()
    set({ coverInFlight: true, error: null })
    try {
      await apiFetch(`/api/projects/${projectSlug}/carousels/${carousel.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          goal: carousel.goal,
          idea: carousel.coreIdea,
          slides: [carousel.coverPrompt.trim()],
        }),
        signal: c.signal,
      })
      const result = await apiFetch<{ url?: unknown }>(
        `/api/projects/${projectSlug}/carousels/${carousel.id}/slides/1/generate`,
        { method: "POST", signal: c.signal },
      )
      if (c.signal.aborted) return
      const url = typeof result.url === "string" ? result.url : null
      if (!url) throw new Error("Invalid generation response")
      useCarouselStore.getState().updateCurrent({ coverImage: url })
      set({ coverInFlight: false })
    } catch (e) {
      if (isAbortError(e)) return
      set({ coverInFlight: false, error: errorMessage(e) })
    }
  },

  generateSlides: async () => {
    const projectSlug = useProjectStore.getState().currentProjectSlug
    const carousel = useCarouselStore.getState().currentCarousel
    if (!projectSlug || !carousel) return
    const prompts = carousel.slidePrompts
    const total = prompts.length
    if (total === 0) return

    const c = freshController()
    set({ coverInFlight: false, slidesTotal: total, slidesDone: 0, error: null })

    const results: Array<string | null> = new Array(total).fill(null)
    let hadError: string | null = null

    await Promise.all(
      prompts.map(async (_, i) => {
        const slideNumber = i + 2 // cover is slide 1
        try {
          const out = await apiFetch<{ url?: unknown }>(
            `/api/projects/${projectSlug}/carousels/${carousel.id}/slides/${slideNumber}/generate`,
            { method: "POST", signal: c.signal },
          )
          if (c.signal.aborted) return
          const url = typeof out.url === "string" ? out.url : null
          if (!url) throw new Error("Invalid generation response")
          results[i] = url
        } catch (e) {
          if (isAbortError(e)) return
          if (!hadError) hadError = errorMessage(e)
        } finally {
          if (!c.signal.aborted) {
            set((state) => ({ slidesDone: state.slidesDone + 1 }))
          }
        }
      }),
    )

    if (c.signal.aborted) return

    const slideImages = results.map((r) => r ?? "")
    useCarouselStore.getState().updateCurrent({
      slideImages,
      status: hadError ? "production" : "complete",
    })
    set({ error: hadError })
  },
}))
