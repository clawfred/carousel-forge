"use client"

import { useEffect } from "react"

import { BrandSettings } from "@/components/brand-settings"
import { StartScreen } from "@/components/start-screen"
import { BriefStage } from "@/components/stages/brief-stage"
import { CoverReviewStage } from "@/components/stages/cover-review-stage"
import { ExportStage } from "@/components/stages/export-stage"
import { ProductionStage } from "@/components/stages/production-stage"
import { SlidesInputStage } from "@/components/stages/slides-input-stage"
import { WorkflowHeader } from "@/components/workflow-header"
import { useAppStore } from "@/lib/store"

function WorkflowContent() {
  const currentProject = useAppStore((s) => s.currentProject)

  if (!currentProject) return <StartScreen />

  switch (currentProject.status) {
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
      return <StartScreen />
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
        <WorkflowContent />
      </main>
    </div>
  )
}
