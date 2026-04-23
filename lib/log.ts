import { errorMessage } from "./api"

export function logError(context: string, e: unknown): void {
  console.error(`[${context}]`, errorMessage(e))
}
