export function slugify(s: string, maxLen = 63): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen)
}

export function genShortId(): string {
  return Math.random().toString(36).substring(2, 9)
}
