export interface BrandSettings {
  masterPrompt: string
  referenceImages: ReferenceImage[]
}

export interface ReferenceImage {
  id: string
  url: string
  name: string
  addedAt: Date
  uploading: boolean
}

export type WorkflowStage =
  | "brief"
  | "cover-review"
  | "slides-input"
  | "production"
  | "complete"

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
  status: WorkflowStage
  createdAt: Date
}

export interface CarouselSummary {
  slug: string
  title: string
  slideCount: number
  renderedCount: number
  coverUrl: string | null
  updatedAt: number
}

export interface ProjectSummary {
  slug: string
  name: string
  description: string
  carouselCount: number
  installedFrom: string | null
}
