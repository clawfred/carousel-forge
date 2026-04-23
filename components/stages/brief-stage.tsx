"use client"

import { useState } from "react"
import { ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAppStore } from "@/lib/store"

export function BriefStage() {
  const { currentProject, updateProject, setStage, brandSettings } = useAppStore()
  
  const [goal, setGoal] = useState(currentProject?.goal || "")
  const [coreIdea, setCoreIdea] = useState(currentProject?.coreIdea || "")
  const [coverPrompt, setCoverPrompt] = useState(currentProject?.coverPrompt || "")
  
  const canProceed = goal.trim() && coreIdea.trim() && coverPrompt.trim()
  
  const handleGenerateCover = () => {
    updateProject({ goal, coreIdea, coverPrompt })
    setStage('cover-review')
  }
  
  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl">
        {/* Stage Label */}
        <div className="mb-12">
          <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Step 1 of 4
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance">
            Define the cover direction
          </h1>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            Lock in your creative direction before generating the full set.
          </p>
        </div>
        
        {/* Form */}
        <div className="space-y-8">
          {/* Carousel Goal */}
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium">Carousel Goal</span>
              <span className="text-sm text-muted-foreground ml-2">
                What should this carousel achieve?
              </span>
            </label>
            <Input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g., Drive signups for the new product launch"
              className="h-12"
            />
          </div>
          
          {/* Core Idea */}
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium">Core Idea</span>
              <span className="text-sm text-muted-foreground ml-2">
                The central concept or hook
              </span>
            </label>
            <Input
              value={coreIdea}
              onChange={(e) => setCoreIdea(e.target.value)}
              placeholder="e.g., 5 reasons your morning routine is killing your productivity"
              className="h-12"
            />
          </div>
          
          {/* Cover Prompt */}
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium">Cover Prompt</span>
              <span className="text-sm text-muted-foreground ml-2">
                Visual direction for the first slide
              </span>
            </label>
            <Textarea
              value={coverPrompt}
              onChange={(e) => setCoverPrompt(e.target.value)}
              placeholder="e.g., A person standing confidently at a minimalist desk at sunrise, warm golden light, clean composition, text overlay area on the right third..."
              className="min-h-[120px] resize-none leading-relaxed"
            />
            {brandSettings.masterPrompt && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Will be combined with your master prompt
              </p>
            )}
          </div>
        </div>
        
        {/* Action */}
        <div className="mt-12 flex justify-end">
          <Button 
            size="lg"
            onClick={handleGenerateCover}
            disabled={!canProceed}
            className="h-12 px-6"
          >
            Generate Cover
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
