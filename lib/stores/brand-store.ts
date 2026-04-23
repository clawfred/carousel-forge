"use client"

import { create } from "zustand"

import { apiFetch } from "@/lib/api"
import { logError } from "@/lib/log"
import { genShortId } from "@/lib/slug"
import type { BrandSettings } from "@/lib/types"
import { refsToImages } from "@/lib/validators"

import { useProjectStore } from "./project-store"

const emptyBrand: BrandSettings = { masterPrompt: "", referenceImages: [] }

interface BrandState {
  brandSettings: BrandSettings
  brandPromptDirty: boolean
  brandPromptSaving: boolean
  showBrandSettings: boolean

  hydrate: (input: { masterPrompt: string; refs: string[] }) => void
  reset: () => void
  updateMasterPrompt: (prompt: string) => void
  saveMasterPrompt: () => Promise<void>
  addReferenceImage: (dataUri: string, name: string) => Promise<void>
  removeReferenceImage: (id: string) => Promise<void>
  toggleBrandSettings: () => void
}

export const useBrandStore = create<BrandState>((set, get) => ({
  brandSettings: { ...emptyBrand },
  brandPromptDirty: false,
  brandPromptSaving: false,
  showBrandSettings: false,

  hydrate: ({ masterPrompt, refs }) =>
    set({
      brandSettings: { masterPrompt, referenceImages: refsToImages(refs) },
      brandPromptDirty: false,
      brandPromptSaving: false,
    }),

  reset: () =>
    set({
      brandSettings: { ...emptyBrand },
      brandPromptDirty: false,
      brandPromptSaving: false,
    }),

  updateMasterPrompt: (prompt) =>
    set((state) => ({
      brandSettings: { ...state.brandSettings, masterPrompt: prompt },
      brandPromptDirty: true,
    })),

  saveMasterPrompt: async () => {
    const { brandSettings, brandPromptDirty } = get()
    const slug = useProjectStore.getState().currentProjectSlug
    if (!brandPromptDirty || !slug) return
    set({ brandPromptSaving: true })
    try {
      await apiFetch(`/api/projects/${slug}`, {
        method: "PATCH",
        body: JSON.stringify({ masterPrompt: brandSettings.masterPrompt }),
      })
      set({ brandPromptDirty: false })
    } finally {
      set({ brandPromptSaving: false })
    }
  },

  addReferenceImage: async (dataUri, name) => {
    const slug = useProjectStore.getState().currentProjectSlug
    if (!slug) return
    const tempId = `temp-${genShortId()}`
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
      const out = await apiFetch<{ filename?: unknown; ref?: unknown }>(
        `/api/projects/${slug}/refs`,
        { method: "POST", body: JSON.stringify({ dataUri }) },
      )
      const filename = typeof out.filename === "string" ? out.filename : null
      const ref = typeof out.ref === "string" ? out.ref : null
      if (!filename || !ref) throw new Error("Invalid upload response")
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
      logError("brand-store.addReferenceImage", e)
      set((state) => ({
        brandSettings: {
          ...state.brandSettings,
          referenceImages: state.brandSettings.referenceImages.filter(
            (img) => img.id !== tempId,
          ),
        },
      }))
    }
  },

  removeReferenceImage: async (id) => {
    const slug = useProjectStore.getState().currentProjectSlug
    if (!slug) return
    const img = get().brandSettings.referenceImages.find((r) => r.id === id)
    if (!img) return

    set((state) => ({
      brandSettings: {
        ...state.brandSettings,
        referenceImages: state.brandSettings.referenceImages.filter((r) => r.id !== id),
      },
    }))

    // Still uploading — nothing on disk to delete yet.
    if (img.uploading) return

    try {
      await apiFetch(`/api/projects/${slug}/refs/${id}`, { method: "DELETE" })
    } catch (e) {
      logError("brand-store.removeReferenceImage", e)
    }
  },

  toggleBrandSettings: () =>
    set((state) => ({ showBrandSettings: !state.showBrandSettings })),
}))
