"use client"

import { useState } from "react"
import { ArrowRight, Settings2, Layers, Sparkles, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAppStore } from "@/lib/store"

const features = [
  {
    icon: Settings2,
    title: "Brand System",
    description: "Define master prompts and reference images"
  },
  {
    icon: Sparkles,
    title: "Cover First",
    description: "Lock in your direction before generating slides"
  },
  {
    icon: Layers,
    title: "Bulk Generation",
    description: "Paste prompts and generate all slides at once"
  },
  {
    icon: Download,
    title: "Quick Export",
    description: "Download your complete carousel as a ZIP"
  }
]

export function StartScreen() {
  const { createProject, toggleBrandSettings } = useAppStore()
  const [projectName, setProjectName] = useState("")
  
  const handleStart = () => {
    const name = projectName.trim() || `Carousel ${new Date().toLocaleDateString()}`
    createProject(name)
  }
  
  return (
    <div className="min-h-[calc(100vh-73px)] flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-xl text-center">
          {/* Hero */}
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-balance">
              Cover-first carousel creation
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-md mx-auto">
              Lock in your brand direction, then generate the rest fast.
            </p>
          </div>
          
          {/* Start Form */}
          <div className="flex gap-3 max-w-md mx-auto mb-6">
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project name (optional)"
              className="h-12 text-base"
              onKeyDown={(e) => e.key === 'Enter' && handleStart()}
            />
            <Button 
              size="lg" 
              onClick={handleStart}
              className="h-12 px-6 flex-shrink-0"
            >
              Start
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          
          <button
            onClick={toggleBrandSettings}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            or configure your brand system first
          </button>
        </div>
      </div>
      
      {/* Features */}
      <div className="border-t border-border bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {features.map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-background border border-border flex items-center justify-center">
                  <feature.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-medium mb-1">{feature.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
