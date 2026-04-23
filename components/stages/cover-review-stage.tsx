"use client"

import { useEffect } from "react"
import { ArrowLeft, Check, Loader2, RefreshCw, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useBrandStore } from "@/lib/stores/brand-store"
import { useCarouselStore } from "@/lib/stores/carousel-store"
import { useGenerationStore } from "@/lib/stores/generation-store"

export function CoverReviewStage() {
  const currentCarousel = useCarouselStore((s) => s.currentCarousel)
  const updateCurrent = useCarouselStore((s) => s.updateCurrent)
  const approveCover = useCarouselStore((s) => s.approveCover)
  const setStage = useCarouselStore((s) => s.setStage)
  const brandSettings = useBrandStore((s) => s.brandSettings)
  const generateCover = useGenerationStore((s) => s.generateCover)
  const coverInFlight = useGenerationStore((s) => s.coverInFlight)
  const error = useGenerationStore((s) => s.error)

  const coverUrl = currentCarousel?.coverImage || null
  const coverPrompt = currentCarousel?.coverPrompt ?? ""
  const hasBrandPrompt = Boolean(brandSettings.masterPrompt?.trim())

  useEffect(() => {
    if (!coverUrl && !coverInFlight) {
      void generateCover()
    }
    // Run once on mount — a stable carousel.id would be cleaner but this is a
    // one-shot bootstrap for the stage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRegenerate = async () => {
    updateCurrent({ coverImage: null })
    await generateCover()
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
              {coverInFlight ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                  <p className="text-sm text-muted-foreground">Generating cover...</p>
                </div>
              ) : coverUrl ? (
                <img src={coverUrl} alt="Cover preview" className="w-full h-full object-cover" />
              ) : error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                  <p className="text-sm font-medium">Generation failed</p>
                  <p className="text-xs text-muted-foreground">{error}</p>
                </div>
              ) : null}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleRegenerate}
                disabled={coverInFlight}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${coverInFlight ? "animate-spin" : ""}`} />
                Regenerate
              </Button>
              <Button
                className="flex-1"
                onClick={approveCover}
                disabled={coverInFlight || !coverUrl}
              >
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
                <p className="text-sm">{currentCarousel?.goal}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Core Idea
                </p>
                <p className="text-sm">{currentCarousel?.coreIdea}</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium">Cover Prompt</span>
                <span className="text-sm text-muted-foreground ml-2">Edit and regenerate</span>
              </label>
              <Textarea
                value={coverPrompt}
                onChange={(e) => updateCurrent({ coverPrompt: e.target.value })}
                className="min-h-[180px] resize-none leading-relaxed"
                disabled={coverInFlight}
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
