"use client"

import { Settings2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAppStore } from "@/lib/store"
import type { WorkflowStage } from "@/lib/types"

const stages: { key: WorkflowStage; label: string }[] = [
  { key: 'brief', label: 'Brief' },
  { key: 'cover-review', label: 'Cover' },
  { key: 'slides-input', label: 'Slides' },
  { key: 'production', label: 'Production' },
  { key: 'complete', label: 'Export' },
]

function getStageIndex(stage: WorkflowStage): number {
  return stages.findIndex(s => s.key === stage)
}

export function WorkflowHeader() {
  const { currentProject, toggleBrandSettings, resetProject } = useAppStore()
  
  const currentStageIndex = currentProject 
    ? getStageIndex(currentProject.status) 
    : -1
  
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <button 
              onClick={resetProject}
              className="flex items-center gap-2.5 group"
            >
              <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
                <span className="text-background font-semibold text-sm">CS</span>
              </div>
              <span className="font-medium tracking-tight text-foreground group-hover:text-muted-foreground transition-colors">
                Carousel Studio
              </span>
            </button>
            
            {/* Stage Progress */}
            {currentProject && (
              <nav className="hidden md:flex items-center gap-1">
                {stages.map((stage, index) => {
                  const isActive = currentStageIndex === index
                  const isPast = currentStageIndex > index
                  
                  return (
                    <div key={stage.key} className="flex items-center">
                      {index > 0 && (
                        <div 
                          className={`w-8 h-px mx-1 ${
                            isPast ? 'bg-foreground' : 'bg-border'
                          }`} 
                        />
                      )}
                      <span 
                        className={`text-sm px-2.5 py-1 rounded-md transition-colors ${
                          isActive 
                            ? 'bg-foreground text-background font-medium' 
                            : isPast 
                              ? 'text-foreground' 
                              : 'text-muted-foreground'
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
          
          {/* Actions */}
          <div className="flex items-center gap-2">
            {currentProject && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={resetProject}
                className="text-muted-foreground"
              >
                <RotateCcw className="h-4 w-4 mr-1.5" />
                New
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={toggleBrandSettings}
            >
              <Settings2 className="h-4 w-4 mr-1.5" />
              Brand
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
