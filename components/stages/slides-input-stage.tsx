"use client"

import { useState } from "react"
import { ArrowRight, ArrowLeft, Layers, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAppStore } from "@/lib/store"

export function SlidesInputStage() {
  const { currentCarousel, addSlidePrompts, setStage } = useAppStore()
  const [bulkPrompts, setBulkPrompts] = useState("")
  
  const promptLines = bulkPrompts
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
  
  const promptCount = promptLines.length
  
  const handleGenerate = () => {
    addSlidePrompts(promptLines)
  }
  
  return (
    <div className="min-h-[calc(100vh-73px)] px-6 py-12">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
              Step 3 of 4
            </span>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Add slide prompts
            </h1>
            <p className="mt-1.5 text-muted-foreground">
              Paste prompts for slides 2 through N, one per line
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setStage('cover-review')}
            className="text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to cover
          </Button>
        </div>
        
        {/* Main Content */}
        <div className="grid lg:grid-cols-5 gap-10">
          {/* Approved Cover Reference */}
          <div className="lg:col-span-2 space-y-4">
            <p className="text-sm font-medium">Approved Cover</p>
            <div className="aspect-[4/5] rounded-xl overflow-hidden bg-muted relative">
              {currentCarousel?.coverImage && (
                <img 
                  src={currentCarousel.coverImage} 
                  alt="Approved cover"
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/90 text-xs font-medium">
                <Check className="h-3 w-3 text-green-600" />
                Approved
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your cover direction is locked. Slides will follow this visual style.
            </p>
          </div>
          
          {/* Bulk Prompt Input */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Slide Prompts</p>
              {promptCount > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Layers className="h-3 w-3" />
                  {promptCount} slide{promptCount !== 1 ? 's' : ''} queued
                </span>
              )}
            </div>
            
            <Textarea
              value={bulkPrompts}
              onChange={(e) => setBulkPrompts(e.target.value)}
              placeholder={`Paste your slide prompts here, one per line:

Slide 2: A closeup of hands typing on a sleek keyboard, morning light streaming in...
Slide 3: A split-screen showing chaos vs. calm workspace...
Slide 4: An elegant infographic showing the 5-step process...
Slide 5: A confident professional reviewing their completed tasks...`}
              className="min-h-[320px] resize-none leading-relaxed font-mono text-sm"
            />
            
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground max-w-sm">
                Each line becomes a separate slide. The cover style will be applied automatically.
              </p>
              <Button 
                size="lg"
                onClick={handleGenerate}
                disabled={promptCount === 0}
                className="h-12 px-6"
              >
                Generate {promptCount > 0 ? `${promptCount} Slides` : 'Slides'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
