"use client"

import { useEffect, useRef } from "react"

import { useCarouselStore } from "@/lib/stores/carousel-store"
import { useProjectStore } from "@/lib/stores/project-store"
import type { WorkflowStage } from "@/lib/types"

type View =
  | { kind: "home" }
  | { kind: "dashboard"; project: string }
  | {
      kind: "carousel"
      project: string
      carousel: string
      stage: WorkflowStage
    }

function viewKey(v: View): string {
  if (v.kind === "home") return "home"
  if (v.kind === "dashboard") return `p:${v.project}`
  return `c:${v.project}:${v.carousel}:${v.stage}`
}

function computeView(
  projectSlug: string | null,
  carouselId: string | null,
  stage: WorkflowStage | null,
): View {
  if (!projectSlug) return { kind: "home" }
  if (!carouselId || !stage) return { kind: "dashboard", project: projectSlug }
  return {
    kind: "carousel",
    project: projectSlug,
    carousel: carouselId,
    stage,
  }
}

async function applyView(target: View): Promise<void> {
  const project = useProjectStore.getState()

  if (target.kind === "home") {
    if (project.currentProjectSlug !== null) project.leaveProject()
    return
  }

  if (project.currentProjectSlug !== target.project) {
    await project.selectProject(target.project)
  }

  if (target.kind === "dashboard") {
    const carousel = useCarouselStore.getState()
    if (carousel.currentCarousel !== null) carousel.closeCarousel()
    return
  }

  let carousel = useCarouselStore.getState()
  if (carousel.currentCarousel?.id !== target.carousel) {
    await carousel.openCarousel(target.carousel)
    carousel = useCarouselStore.getState()
  }
  if (
    carousel.currentCarousel &&
    carousel.currentCarousel.status !== target.stage
  ) {
    carousel.setStage(target.stage)
  }
}

// Mirror app state into the browser History API so the back button pops
// between projects / carousels / stages instead of leaving the site.
// Store actions are the source of truth; this hook just reflects them into
// history entries and replays popped entries back into the stores.
export function useBrowserHistory(): void {
  const projectSlug = useProjectStore((s) => s.currentProjectSlug)
  const carouselId = useCarouselStore((s) => s.currentCarousel?.id ?? null)
  const stage = useCarouselStore((s) => s.currentCarousel?.status ?? null)

  // True while a popstate-driven store update is in flight. Suppresses the
  // push-effect so syncing to a popped state doesn't also push a new entry.
  const isApplying = useRef(false)

  useEffect(() => {
    const v = computeView(
      useProjectStore.getState().currentProjectSlug,
      useCarouselStore.getState().currentCarousel?.id ?? null,
      useCarouselStore.getState().currentCarousel?.status ?? null,
    )
    window.history.replaceState({ view: v, key: viewKey(v) }, "")
  }, [])

  useEffect(() => {
    const handler = async (e: PopStateEvent) => {
      const state = e.state as { view?: View } | null
      const target: View = state?.view ?? { kind: "home" }
      isApplying.current = true
      try {
        await applyView(target)
      } finally {
        isApplying.current = false
      }
    }
    window.addEventListener("popstate", handler)
    return () => window.removeEventListener("popstate", handler)
  }, [])

  useEffect(() => {
    if (isApplying.current) return
    const v = computeView(projectSlug, carouselId, stage)
    const key = viewKey(v)
    const current = window.history.state as { key?: string } | null
    if (current?.key === key) return
    window.history.pushState({ view: v, key }, "")
  }, [projectSlug, carouselId, stage])
}
