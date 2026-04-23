"use client"

import { useState } from "react"
import { Check, Copy, Download, ExternalLink, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { STUDIO_PROJECT_SLUG, useAppStore } from "@/lib/store"

export function ExportStage() {
  const currentProject = useAppStore((s) => s.currentProject)
  const resetProject = useAppStore((s) => s.resetProject)

  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadComplete, setDownloadComplete] = useState(false)

  const allImages = [
    currentProject?.coverImage,
    ...(currentProject?.slideImages || []),
  ].filter((url): url is string => Boolean(url))

  const handleDownload = async () => {
    if (!currentProject) return
    setIsDownloading(true)
    try {
      const zipUrl = `/api/projects/${STUDIO_PROJECT_SLUG}/carousels/${currentProject.id}/zip`
      const res = await fetch(zipUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = `${currentProject.id}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
      setDownloadComplete(true)
    } catch (e) {
      console.error("[export] download failed:", e)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-73px)] px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between mb-10">
          <div>
            <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
              Complete
            </span>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Your carousel is ready
            </h1>
            <p className="mt-1.5 text-muted-foreground">
              {allImages.length} images ready for export
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={resetProject}>
              <RotateCcw className="h-4 w-4 mr-2" />
              New Carousel
            </Button>
            <Button
              size="lg"
              onClick={handleDownload}
              disabled={isDownloading}
              className="h-11 px-6"
            >
              {downloadComplete ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Downloaded
                </>
              ) : isDownloading ? (
                <>Preparing ZIP...</>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download ZIP
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-muted/30 border border-border mb-10">
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Project Name
              </p>
              <p className="font-medium">{currentProject?.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Goal
              </p>
              <p className="text-sm text-muted-foreground">{currentProject?.goal}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Core Idea
              </p>
              <p className="text-sm text-muted-foreground">{currentProject?.coreIdea}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {allImages.map((url, index) => (
            <div
              key={index}
              className="group relative aspect-[4/5] rounded-xl overflow-hidden bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Slide ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors" />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-background/90 text-xs font-medium">
                {index === 0 ? "Cover" : `Slide ${index + 1}`}
              </div>
              <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="p-2 rounded-md bg-background/90 hover:bg-background transition-colors"
                  onClick={() => window.open(url, "_blank")}
                  aria-label="Open image"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
                <button
                  className="p-2 rounded-md bg-background/90 hover:bg-background transition-colors"
                  onClick={() => navigator.clipboard.writeText(new URL(url, location.origin).toString())}
                  aria-label="Copy URL"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            Images are optimized for social media carousel formats. Download includes all
            {" "}
            {allImages.length} images in high resolution.
          </p>
        </div>
      </div>
    </div>
  )
}
