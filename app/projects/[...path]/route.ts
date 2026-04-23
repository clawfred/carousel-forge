import fs from "node:fs/promises";
import path from "node:path";

import { type NextRequest } from "next/server";

import { mimeFromFilename } from "@/lib/image";
import { badRequest, notFound } from "@/lib/http";
import { PROJECTS_DIR } from "@/lib/storage";

// Serve user-generated project assets (uploaded refs + rendered slides).
// Mirrors what express.static did, with explicit path-traversal guards.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  if (!segments || segments.length === 0) return notFound("not found");

  for (const s of segments) {
    if (!s || s === "." || s === ".." || s.includes("/") || s.includes("\\")) {
      return badRequest("invalid path segment");
    }
  }

  const abs = path.join(PROJECTS_DIR, ...segments);
  if (!abs.startsWith(PROJECTS_DIR + path.sep)) return badRequest("path escapes root");

  let stat;
  try {
    stat = await fs.stat(abs);
  } catch {
    return notFound("not found");
  }
  if (!stat.isFile()) return notFound("not found");

  const buffer = await fs.readFile(abs);
  const body = new Uint8Array(buffer);
  const mime = mimeFromFilename(abs);
  return new Response(body, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
