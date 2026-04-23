"use client"

import { create } from "zustand"

import { apiFetch } from "@/lib/api"
import { logError } from "@/lib/log"
import { genShortId, slugify } from "@/lib/slug"
import type { ProjectSummary } from "@/lib/types"
import {
  parseProjectDetail,
  parseProjectSummaries,
} from "@/lib/validators"

import { useBrandStore } from "./brand-store"
import { useCarouselStore } from "./carousel-store"
import { useGenerationStore } from "./generation-store"

interface ProjectState {
  initialized: boolean
  projects: ProjectSummary[]
  projectsLoading: boolean
  projectLoading: boolean
  currentProjectSlug: string | null
  currentProjectName: string | null

  initialize: () => Promise<void>
  refreshProjects: () => Promise<void>
  selectProject: (slug: string) => Promise<void>
  leaveProject: () => void
  createProject: (name: string) => Promise<void>
  deleteProject: (slug: string) => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  initialized: false,
  projects: [],
  projectsLoading: false,
  projectLoading: false,
  currentProjectSlug: null,
  currentProjectName: null,

  initialize: async () => {
    if (get().initialized) return
    try {
      await get().refreshProjects()
    } finally {
      set({ initialized: true })
    }
  },

  refreshProjects: async () => {
    set({ projectsLoading: true })
    try {
      const raw = await apiFetch<unknown>("/api/projects")
      const projects = parseProjectSummaries(
        (raw as { projects?: unknown })?.projects,
      )
      set({ projects })
    } catch (e) {
      logError("project-store.refreshProjects", e)
    } finally {
      set({ projectsLoading: false })
    }
  },

  selectProject: async (slug) => {
    set({ projectLoading: true })
    try {
      const raw = await apiFetch<unknown>(`/api/projects/${slug}`)
      const detail = parseProjectDetail(raw)
      if (!detail) throw new Error("Invalid project response")
      set({
        currentProjectSlug: detail.slug,
        currentProjectName: detail.name,
      })
      useBrandStore.getState().hydrate({
        masterPrompt: detail.masterPrompt,
        refs: detail.refs,
      })
      useCarouselStore.getState().hydrateRecents(detail.carousels)
      useCarouselStore.setState({ currentCarousel: null })
      useGenerationStore.getState().reset()
    } catch (e) {
      logError("project-store.selectProject", e)
    } finally {
      set({ projectLoading: false })
    }
  },

  leaveProject: () => {
    useGenerationStore.getState().reset()
    useBrandStore.getState().reset()
    useCarouselStore.getState().reset()
    set({ currentProjectSlug: null, currentProjectName: null })
    void get().refreshProjects()
  },

  createProject: async (rawName) => {
    const name = rawName.trim()
    if (!name) return
    const requestedSlug = `${slugify(name, 40)}-${genShortId()}`
    try {
      const out = await apiFetch<{ slug?: unknown }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name, slug: requestedSlug }),
      })
      const slug = typeof out.slug === "string" ? out.slug : null
      if (!slug) throw new Error("Missing slug in response")
      await get().refreshProjects()
      await get().selectProject(slug)
    } catch (e) {
      logError("project-store.createProject", e)
    }
  },

  deleteProject: async (slug) => {
    try {
      await apiFetch(`/api/projects/${slug}`, { method: "DELETE" })
    } catch (e) {
      logError("project-store.deleteProject", e)
      return
    }
    const wasCurrent = get().currentProjectSlug === slug
    set((state) => ({
      projects: state.projects.filter((p) => p.slug !== slug),
      ...(wasCurrent
        ? { currentProjectSlug: null, currentProjectName: null }
        : {}),
    }))
    if (wasCurrent) {
      useBrandStore.getState().reset()
      useCarouselStore.getState().reset()
      useGenerationStore.getState().reset()
    }
  },
}))
