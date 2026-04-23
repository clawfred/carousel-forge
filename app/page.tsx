"use client"

import { useEffect } from "react"

import { BrandSettings } from "@/components/brand-settings"
import { ProjectDashboard } from "@/components/project-dashboard"
import { ProjectsHome } from "@/components/projects-home"
import { BriefStage } from "@/components/stages/brief-stage"
import { CoverReviewStage } from "@/components/stages/cover-review-stage"
import { ExportStage } from "@/components/stages/export-stage"
import { ProductionStage } from "@/components/stages/production-stage"
import { SlidesInputStage } from "@/components/stages/slides-input-stage"
import { WorkflowHeader } from "@/components/workflow-header"
import { useAppStore } from "@/lib/store"

function Main() {
  const currentCarousel = useAppStore((s) => s.currentCarousel)
  const currentProjectSlug = useAppStore((s) => s.currentProjectSlug)

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
  const initialize = useAppStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <div className="min-h-screen bg-background">
      <WorkflowHeader />
      <BrandSettings />
      <main>
        <Main />
      </main>
    </div>
  )
}
