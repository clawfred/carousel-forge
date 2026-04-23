export interface BrandSettings {
  masterPrompt: string
  referenceImages: ReferenceImage[]
}

export interface ReferenceImage {
  id: string
  url: string
  name: string
  addedAt: Date
  uploading?: boolean
}

export interface CarouselProject {
  id: string
  name: string
  goal: string
  coreIdea: string
  coverPrompt: string
  coverImage: string | null
  coverApproved: boolean
  slidePrompts: string[]
  slideImages: string[]
  status: 'brief' | 'cover-review' | 'slides-input' | 'production' | 'complete'
  createdAt: Date
}

export type WorkflowStage = 'brief' | 'cover-review' | 'slides-input' | 'production' | 'complete'
