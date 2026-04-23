"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Check, Loader2, RefreshCw, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAppStore } from "@/lib/store"

export function CoverReviewStage() {
  const currentProject = useAppStore((s) => s.currentProject)
  const brandSettings = useAppStore((s) => s.brandSettings)
  const updateProject = useAppStore((s) => s.updateProject)
  const approveCover = useAppStore((s) => s.approveCover)
  const setStage = useAppStore((s) => s.setStage)
  const generateCover = useAppStore((s) => s.generateCover)
  const generation = useAppStore((s) => s.generation)

  const [editedPrompt, setEditedPrompt] = useState(currentProject?.coverPrompt || "")

  useEffect(() => {
    if (!currentProject?.coverImage && !generation.coverInFlight) {
      void generateCover()
    }
    // Intentionally only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const coverUrl = currentProject?.coverImage || null
  const isGenerating = generation.coverInFlight
  const hasBrandPrompt = Boolean(brandSettings.masterPrompt?.trim())

  const handleRegenerate = async () => {
    updateProject({ coverPrompt: editedPrompt, coverImage: null })
    await generateCover()
  }

  const handleApprove = () => {
    updateProject({ coverPrompt: editedPrompt })
    approveCover()
  }

  return (
    <div className="min-h-[calc(100vh-73px)] px-6 py-12">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-10">
          <div>
            <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
              Step 2 of 4
            </span>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Review your cover</h1>
            <p className="mt-1.5 text-muted-foreground">
              Approve or refine before generating slides
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStage("brief")}
            className="text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to brief
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-10">
          <div className="space-y-4">
            <div className="aspect-[4/5] rounded-xl overflow-hidden bg-muted relative">
              {isGenerating ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                  <p className="text-sm text-muted-foreground">Generating cover...</p>
                </div>
              ) : coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverUrl} alt="Cover preview" className="w-full h-full object-cover" />
              ) : generation.error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                  <p className="text-sm font-medium">Generation failed</p>
                  <p className="text-xs text-muted-foreground">{generation.error}</p>
                </div>
              ) : null}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleRegenerate}
                disabled={isGenerating}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? "animate-spin" : ""}`} />
                Regenerate
              </Button>
              <Button className="flex-1" onClick={handleApprove} disabled={isGenerating || !coverUrl}>
                <Check className="h-4 w-4 mr-2" />
                Approve Cover
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-muted/50 space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Goal
                </p>
                <p className="text-sm">{currentProject?.goal}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Core Idea
                </p>
                <p className="text-sm">{currentProject?.coreIdea}</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium">Cover Prompt</span>
                <span className="text-sm text-muted-foreground ml-2">Edit and regenerate</span>
              </label>
              <Textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                className="min-h-[180px] resize-none leading-relaxed"
                disabled={isGenerating}
              />
              {hasBrandPrompt && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  Your master prompt is applied automatically
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
