"use client"

import { ArrowLeft, RotateCcw, Settings2 } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { useBrandStore } from "@/lib/stores/brand-store"
import { useCarouselStore } from "@/lib/stores/carousel-store"
import { useProjectStore } from "@/lib/stores/project-store"
import type { WorkflowStage } from "@/lib/types"

const stages: { key: WorkflowStage; label: string }[] = [
  { key: "brief", label: "Brief" },
  { key: "cover-review", label: "Cover" },
  { key: "slides-input", label: "Slides" },
  { key: "production", label: "Production" },
  { key: "complete", label: "Export" },
]

function getStageIndex(stage: WorkflowStage): number {
  return stages.findIndex((s) => s.key === stage)
}

export function WorkflowHeader() {
  const currentCarousel = useCarouselStore((s) => s.currentCarousel)
  const closeCarousel = useCarouselStore((s) => s.closeCarousel)
  const currentProjectSlug = useProjectStore((s) => s.currentProjectSlug)
  const currentProjectName = useProjectStore((s) => s.currentProjectName)
  const leaveProject = useProjectStore((s) => s.leaveProject)
  const toggleBrandSettings = useBrandStore((s) => s.toggleBrandSettings)

  const currentStageIndex = currentCarousel ? getStageIndex(currentCarousel.status) : -1

  const handleLogoClick = () => {
    if (currentCarousel) {
      closeCarousel()
    } else if (currentProjectSlug) {
      leaveProject()
    }
  }

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button onClick={handleLogoClick} className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
                <span className="text-background font-semibold text-sm">CS</span>
              </div>
              <span className="font-medium tracking-tight text-foreground group-hover:text-muted-foreground transition-colors">
                Carousel Studio
              </span>
            </button>

            {currentProjectSlug && !currentCarousel && (
              <button
                onClick={leaveProject}
                className="hidden md:inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                All projects
              </button>
            )}

            {currentCarousel && (
              <nav className="hidden md:flex items-center gap-1">
                {stages.map((stage, index) => {
                  const isActive = currentStageIndex === index
                  const isPast = currentStageIndex > index

                  return (
                    <div key={stage.key} className="flex items-center">
                      {index > 0 && (
                        <div
                          className={`w-8 h-px mx-1 ${
                            isPast ? "bg-foreground" : "bg-border"
                          }`}
                        />
                      )}
                      <span
                        className={`text-sm px-2.5 py-1 rounded-md transition-colors ${
                          isActive
                            ? "bg-foreground text-background font-medium"
                            : isPast
                              ? "text-foreground"
                              : "text-muted-foreground"
                        }`}
                      >
                        {stage.label}
                      </span>
                    </div>
                  )
                })}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentProjectSlug && currentProjectName && !currentCarousel && (
              <span className="hidden lg:inline text-sm text-muted-foreground mr-2 truncate max-w-[180px]">
                {currentProjectName}
              </span>
            )}
            {currentCarousel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={closeCarousel}
                className="text-muted-foreground"
              >
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Back
              </Button>
            )}
            {currentProjectSlug && (
              <Button variant="outline" size="sm" onClick={toggleBrandSettings}>
                <Settings2 className="h-4 w-4 mr-1.5" />
                Brand
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
