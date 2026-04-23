import { NextResponse } from "next/server";

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function jsonError(e: unknown, status = 500, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: errorMessage(e), ...(extra || {}) }, { status });
}

export function badRequest(message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...(extra || {}) }, { status: 400 });
}

export function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...(extra || {}) }, { status: 409 });
}
