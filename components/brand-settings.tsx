"use client"

import { useCallback, useRef, useState } from "react"
import { Loader2, Trash2, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { logError } from "@/lib/log"
import { useBrandStore } from "@/lib/stores/brand-store"
import { useProjectStore } from "@/lib/stores/project-store"

export function BrandSettings() {
  const brandSettings = useBrandStore((s) => s.brandSettings)
  const updateMasterPrompt = useBrandStore((s) => s.updateMasterPrompt)
  const addReferenceImage = useBrandStore((s) => s.addReferenceImage)
  const removeReferenceImage = useBrandStore((s) => s.removeReferenceImage)
  const showBrandSettings = useBrandStore((s) => s.showBrandSettings)
  const toggleBrandSettings = useBrandStore((s) => s.toggleBrandSettings)
  const saveMasterPrompt = useBrandStore((s) => s.saveMasterPrompt)
  const brandPromptDirty = useBrandStore((s) => s.brandPromptDirty)
  const brandPromptSaving = useBrandStore((s) => s.brandPromptSaving)
  const projectName = useProjectStore((s) => s.currentProjectName)

  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClose = async () => {
    if (brandPromptDirty) {
      try {
        await saveMasterPrompt()
      } catch (e) {
        logError("brand-settings.save", e)
        return
      }
    }
    toggleBrandSettings()
  }

  const processFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        const name = file.name.replace(/\.[^/.]+$/, "")
        void addReferenceImage(dataUrl, name)
      }
      reader.readAsDataURL(file)
    },
    [addReferenceImage],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      const files = Array.from(e.dataTransfer.files)
      files.forEach(processFile)
    },
    [processFile],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      files.forEach(processFile)
      if (fileInputRef.current) fileInputRef.current.value = ""
    },
    [processFile],
  )

  if (!showBrandSettings) return null

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-background border-l border-border shadow-2xl">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-8 py-6 border-b border-border">
            <div>
              <h2 className="text-lg font-medium tracking-tight">Brand System</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {projectName ? `For "${projectName}"` : "Define your visual identity"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleBrandSettings}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-auto px-8 py-8 space-y-10">
            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Master Prompt</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Style directives applied to every generation
                </p>
              </div>
              <Textarea
                value={brandSettings.masterPrompt}
                onChange={(e) => updateMasterPrompt(e.target.value)}
                placeholder="e.g., Minimalist, clean backgrounds, soft shadows, professional photography style, brand colors: navy blue and warm white..."
                className="min-h-[140px] resize-none text-sm leading-relaxed"
              />
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Reference Library</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Past successful covers to guide generation. Uploads save immediately.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center py-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                  isDragging
                    ? "border-foreground/40 bg-muted/50"
                    : "border-border hover:border-foreground/20 hover:bg-muted/30"
                }`}
              >
                <Upload
                  className={`h-6 w-6 mb-2 transition-colors ${
                    isDragging ? "text-foreground" : "text-muted-foreground/50"
                  }`}
                />
                <p className="text-sm text-muted-foreground">
                  {isDragging ? "Drop images here" : "Drop images or click to upload"}
                </p>
              </div>

              {brandSettings.referenceImages.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {brandSettings.referenceImages.map((img) => (
                    <div
                      key={img.id}
                      className="group relative aspect-square rounded-lg overflow-hidden bg-muted"
                    >
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors" />
                      {img.uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                          <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                        </div>
                      )}
                      <button
                        onClick={() => void removeReferenceImage(img.id)}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-foreground" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
                        <p className="text-xs text-white truncate">{img.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="px-8 py-6 border-t border-border">
            <Button onClick={handleClose} className="w-full" disabled={brandPromptSaving}>
              {brandPromptSaving ? "Saving…" : brandPromptDirty ? "Save & Close" : "Close"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
