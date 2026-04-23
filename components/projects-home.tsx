"use client"

import { useState } from "react"
import { ArrowRight, FolderOpen, Layers, Sparkles, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { type ProjectSummary, useAppStore } from "@/lib/store"

function ProjectCard({ project }: { project: ProjectSummary }) {
  const selectProject = useAppStore((s) => s.selectProject)
  const deleteProject = useAppStore((s) => s.deleteProject)

  const handleOpen = () => selectProject(project.slug)
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const msg = `Delete project "${project.name}" and all ${project.carouselCount} carousel${
      project.carouselCount === 1 ? "" : "s"
    } inside it? This can't be undone.`
    if (!confirm(msg)) return
    await deleteProject(project.slug)
  }

  return (
    <div className="group relative flex flex-col rounded-xl border border-border bg-card hover:border-foreground/20 hover:shadow-sm transition-all overflow-hidden">
      <button
        type="button"
        onClick={handleOpen}
        className="text-left flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-xl"
      >
        <div className="aspect-[4/3] bg-muted/40 relative overflow-hidden flex items-center justify-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
          {project.installedFrom && (
            <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-background/90 text-[11px] font-medium text-muted-foreground">
              from {project.installedFrom}
            </div>
          )}
        </div>
        <div className="px-4 py-3">
          <p className="text-sm font-medium truncate">{project.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <Layers className="h-3 w-3" />
            {project.carouselCount} carousel{project.carouselCount === 1 ? "" : "s"}
          </p>
        </div>
      </button>
      <button
        type="button"
        onClick={handleDelete}
        aria-label={`Delete ${project.name}`}
        className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
      >
        <Trash2 className="h-3.5 w-3.5 text-foreground" />
      </button>
    </div>
  )
}

function NewProjectForm({ compact = false }: { compact?: boolean }) {
  const createProject = useAppStore((s) => s.createProject)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      await createProject(trimmed)
      setName("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={compact ? "flex gap-3 w-full" : "flex gap-3 max-w-md mx-auto mb-6"}>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name (e.g., Acme Studio, Personal Brand)"
        className="h-12 text-base"
        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
      />
      <Button
        size="lg"
        onClick={handleCreate}
        className="h-12 px-6 shrink-0"
        disabled={busy || !name.trim()}
      >
        Create
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}

function Welcome() {
  return (
    <div className="min-h-[calc(100vh-73px)] flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-xl text-center">
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-balance">
              Cover-first carousel creation
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-md mx-auto">
              Create a project to define your brand. Generate carousels fast under it.
            </p>
          </div>

          <NewProjectForm />

          <p className="text-sm text-muted-foreground">
            Each project has its own master prompt and reference library.
          </p>
        </div>
      </div>

      <div className="border-t border-border bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { title: "Brand System", desc: "Master prompt + refs per project" },
            { title: "Cover First", desc: "Lock direction before slides" },
            { title: "Bulk Generation", desc: "Paste prompts, render all" },
            { title: "Quick Export", desc: "One-click ZIP download" },
          ].map((f) => (
            <div key={f.title} className="text-center">
              <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-background border border-border flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-medium mb-1">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Grid({ projects }: { projects: ProjectSummary[] }) {
  return (
    <div className="min-h-[calc(100vh-73px)] px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <h1 className="text-2xl font-semibold tracking-tight">Your projects</h1>
          <p className="mt-1.5 text-muted-foreground">
            Each project has its own brand system and carousels.
          </p>
        </div>

        <div className="mb-10 p-5 rounded-xl border border-border bg-muted/20">
          <p className="text-sm font-medium mb-3">Start a new project</p>
          <NewProjectForm compact />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ProjectsHome() {
  const projects = useAppStore((s) => s.projects)
  const initialized = useAppStore((s) => s.initialized)

  if (!initialized) {
    return (
      <div className="min-h-[calc(100vh-73px)] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-muted border-t-foreground animate-spin" />
      </div>
    )
  }

  if (projects.length > 0) return <Grid projects={projects} />
  return <Welcome />
}
