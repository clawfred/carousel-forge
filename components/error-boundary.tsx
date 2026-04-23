"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"

import { Button } from "@/components/ui/button"

interface Props {
  children: ReactNode
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode
  onReset?: () => void
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[error-boundary]", error, info.componentStack)
  }

  reset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    if (!this.state.error) return this.props.children
    if (this.props.fallback) {
      return this.props.fallback({ error: this.state.error, reset: this.reset })
    }
    return (
      <div className="min-h-[calc(100vh-73px)] flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <h2 className="text-xl font-semibold tracking-tight mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground mb-6 break-words">
            {this.state.error.message}
          </p>
          <Button onClick={this.reset}>Try again</Button>
        </div>
      </div>
    )
  }
}
