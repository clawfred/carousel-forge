export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  })
  const text = await res.text()
  let json: unknown = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      // non-JSON body — surface as error below if !ok, ignore otherwise
    }
  }
  if (!res.ok) {
    const message =
      json && typeof json === "object" && "error" in json
        ? String((json as { error: unknown }).error)
        : `HTTP ${res.status}`
    throw new ApiError(message, res.status)
  }
  return json as T
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError"
}
