"use client"

import { useEffect } from "react"

import { BrandSettings } from "@/components/brand-settings"
import { ErrorBoundary } from "@/components/error-boundary"
import { ProjectDashboard } from "@/components/project-dashboard"
import { ProjectsHome } from "@/components/projects-home"
import { BriefStage } from "@/components/stages/brief-stage"
import { CoverReviewStage } from "@/components/stages/cover-review-stage"
import { ExportStage } from "@/components/stages/export-stage"
import { ProductionStage } from "@/components/stages/production-stage"
import { SlidesInputStage } from "@/components/stages/slides-input-stage"
import { WorkflowHeader } from "@/components/workflow-header"
import { useCarouselStore } from "@/lib/stores/carousel-store"
import { useProjectStore } from "@/lib/stores/project-store"

function Main() {
  const currentCarousel = useCarouselStore((s) => s.currentCarousel)
  const currentProjectSlug = useProjectStore((s) => s.currentProjectSlug)

  if (!currentProjectSlug) return <ProjectsHome />
  if (!currentCarousel) return <ProjectDashboard />

  switch (currentCarousel.status) {
    case "brief":
      return <BriefStage />
    case "cover-review":
      return <CoverReviewStage />
    case "slides-input":
      return <SlidesInputStage />
    case "production":
      return <ProductionStage />
    case "complete":
      return <ExportStage />
    default:
      return <ProjectDashboard />
  }
}

export default function Home() {
  const initialize = useProjectStore((s) => s.initialize)
  const closeCarousel = useCarouselStore((s) => s.closeCarousel)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <div className="min-h-screen bg-background">
      <WorkflowHeader />
      <BrandSettings />
      <main>
        <ErrorBoundary onReset={closeCarousel}>
          <Main />
        </ErrorBoundary>
      </main>
    </div>
  )
}
