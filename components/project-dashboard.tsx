"use client"

import { useState } from "react"
import { ArrowRight, Sparkles, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useBrandStore } from "@/lib/stores/brand-store"
import { useCarouselStore } from "@/lib/stores/carousel-store"
import { useProjectStore } from "@/lib/stores/project-store"
import type { CarouselSummary } from "@/lib/types"

function statusLabel(c: CarouselSummary): string {
  if (c.slideCount === 0) return "Brief"
  if (c.slideCount === 1) return c.renderedCount >= 1 ? "Cover ready" : "Drafting cover"
  if (c.renderedCount >= c.slideCount) return "Complete"
  if (c.renderedCount === 0) return "Slides queued"
  return `${c.renderedCount}/${c.slideCount} rendered`
}

function formatRelative(ts: number): string {
  if (!ts) return ""
  const diff = Date.now() - ts
  const m = Math.round(diff / 60_000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}

function CarouselCard({ carousel }: { carousel: CarouselSummary }) {
  const openCarousel = useCarouselStore((s) => s.openCarousel)
  const deleteCarousel = useCarouselStore((s) => s.deleteCarousel)

  const handleOpen = () => openCarousel(carousel.slug)
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete "${carousel.title}"? This can't be undone.`)) return
    await deleteCarousel(carousel.slug)
  }

  return (
    <div className="group relative flex flex-col rounded-xl border border-border bg-card hover:border-foreground/20 hover:shadow-sm transition-all overflow-hidden">
      <button
        type="button"
        onClick={handleOpen}
        className="text-left flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-xl"
      >
        <div className="aspect-4/5 bg-muted relative overflow-hidden">
          {carousel.coverUrl ? (
            <img
              src={carousel.coverUrl}
              alt={carousel.title}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-muted-foreground/40" />
            </div>
          )}
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-background/90 text-[11px] font-medium">
            {statusLabel(carousel)}
          </div>
        </div>
        <div className="px-3.5 py-3">
          <p className="text-sm font-medium truncate">{carousel.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {carousel.slideCount} slide{carousel.slideCount === 1 ? "" : "s"}
            {carousel.updatedAt ? ` · ${formatRelative(carousel.updatedAt)}` : ""}
          </p>
        </div>
      </button>
      <button
        type="button"
        onClick={handleDelete}
        aria-label={`Delete ${carousel.title}`}
        className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
      >
        <Trash2 className="h-3.5 w-3.5 text-foreground" />
      </button>
    </div>
  )
}

function NewCarouselForm({ compact = false }: { compact?: boolean }) {
  const createCarousel = useCarouselStore((s) => s.createCarousel)
  const [name, setName] = useState("")

  const handleStart = () => {
    const finalName = name.trim() || `Carousel ${new Date().toLocaleDateString()}`
    createCarousel(finalName)
  }

  return (
    <div className={compact ? "flex gap-3 w-full" : "flex gap-3 max-w-md mx-auto mb-6"}>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Carousel name (optional)"
        className="h-12 text-base"
        onKeyDown={(e) => e.key === "Enter" && handleStart()}
      />
      <Button size="lg" onClick={handleStart} className="h-12 px-6 shrink-0">
        Start
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}

function EmptyState() {
  const toggleBrandSettings = useBrandStore((s) => s.toggleBrandSettings)

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl text-center">
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
            Let&apos;s make your first carousel
          </h1>
          <p className="mt-3 text-lg text-muted-foreground leading-relaxed max-w-md mx-auto">
            Lock in your brand direction, then generate the rest fast.
          </p>
        </div>

        <NewCarouselForm />

        <button
          onClick={toggleBrandSettings}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          or configure this project&apos;s brand system first
        </button>
      </div>
    </div>
  )
}

function Grid({ carousels }: { carousels: CarouselSummary[] }) {
  const toggleBrandSettings = useBrandStore((s) => s.toggleBrandSettings)
  const projectName = useProjectStore((s) => s.currentProjectName)

  return (
    <div className="min-h-[calc(100vh-73px)] px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {projectName || "Your carousels"}
            </h1>
            <p className="mt-1.5 text-muted-foreground">
              Pick up where you left off or start something new.
            </p>
          </div>
          <button
            onClick={toggleBrandSettings}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline-block"
          >
            Configure brand system
          </button>
        </div>

        <div className="mb-10 p-5 rounded-xl border border-border bg-muted/20">
          <p className="text-sm font-medium mb-3">Start a new carousel</p>
          <NewCarouselForm compact />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {carousels.map((c) => (
            <CarouselCard key={c.slug} carousel={c} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ProjectDashboard() {
  const carousels = useCarouselStore((s) => s.recentCarousels)

  if (carousels.length === 0) return <EmptyState />
  return <Grid carousels={carousels} />
}
