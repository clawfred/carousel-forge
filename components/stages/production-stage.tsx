"use client"

import { Check, Loader2 } from "lucide-react"

import { useCarouselStore } from "@/lib/stores/carousel-store"
import { useGenerationStore } from "@/lib/stores/generation-store"

export function ProductionStage() {
  const currentCarousel = useCarouselStore((s) => s.currentCarousel)
  const slidesDone = useGenerationStore((s) => s.slidesDone)
  const error = useGenerationStore((s) => s.error)

  const totalSlides = currentCarousel?.slidePrompts.length || 0
  const isComplete =
    totalSlides > 0 &&
    slidesDone >= totalSlides &&
    currentCarousel?.status === "complete"
  const progress = totalSlides > 0 ? (slidesDone / totalSlides) * 100 : 0

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          {isComplete ? (
            <div className="w-16 h-16 mx-auto rounded-full bg-foreground flex items-center justify-center">
              <Check className="h-8 w-8 text-background" />
            </div>
          ) : (
            <div className="w-16 h-16 mx-auto rounded-full border-2 border-border flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-foreground animate-spin" />
            </div>
          )}
        </div>

        <h2 className="text-xl font-semibold tracking-tight mb-2">
          {isComplete ? "All slides ready" : "Generating slides..."}
        </h2>
        <p className="text-muted-foreground mb-2">
          {isComplete
            ? "Your carousel is complete"
            : `${slidesDone} of ${totalSlides} slides generated`}
        </p>
        {error && <p className="text-xs text-destructive mb-6">{error}</p>}

        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-6">
          <div
            className="h-full bg-foreground transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-10 space-y-2">
          {currentCarousel?.slidePrompts.map((prompt, index) => {
            const isGenerated = index < slidesDone
            const isGenerating = index === slidesDone && !isComplete

            return (
              <div
                // Slide prompts are a fixed, ordered list for the stage — position is the stable identity.
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors ${
                  isGenerated
                    ? "bg-muted/50"
                    : isGenerating
                      ? "bg-muted/30"
                      : ""
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isGenerated
                      ? "bg-foreground"
                      : isGenerating
                        ? "border-2 border-foreground"
                        : "border border-border"
                  }`}
                >
                  {isGenerated && <Check className="h-3 w-3 text-background" />}
                  {isGenerating && (
                    <div className="w-2 h-2 bg-foreground rounded-full animate-pulse" />
                  )}
                </div>
                <span
                  className={`text-sm truncate ${
                    isGenerated || isGenerating ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  Slide {index + 2}: {prompt.slice(0, 50)}
                  {prompt.length > 50 ? "..." : ""}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
