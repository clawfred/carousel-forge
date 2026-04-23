import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import { dataUriToBuffer } from "@/lib/image";
import { badRequest, jsonError, notFound } from "@/lib/http";
import {
  dirExists,
  listFiles,
  pad2,
  PROJECTS_DIR,
  safeJoin,
  validSlug,
} from "@/lib/storage";

const REF_FILE_RE = /^ref-(\d+)\.(png|jpg|jpeg|webp)$/i;

function nextRefNumber(existing: string[]): number {
  let max = 0;
  for (const f of existing) {
    const m = REF_FILE_RE.exec(f);
    if (m) {
      const n = Number(m[1]);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

// Append a single reference image. Body: { dataUri }. Returns the saved URL.
// This avoids the previous "replace full set" behavior, which forced clients
// to re-upload every existing ref on every save.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    if (!validSlug(slug)) return badRequest("invalid slug");
    const base = safeJoin(PROJECTS_DIR, slug);
    if (!(await dirExists(base))) return notFound("project not found");

    const refsDir = path.join(base, "refs");
    await fs.mkdir(refsDir, { recursive: true });

    const body = (await req.json().catch(() => ({}))) as { dataUri?: unknown };
    if (typeof body.dataUri !== "string") return badRequest("dataUri required");

    const { mime, buffer } = dataUriToBuffer(body.dataUri);
    const ext = (mime.split("/")[1] || "png").replace("+xml", "");
    const existing = await listFiles(refsDir);
    const filename = `ref-${pad2(nextRefNumber(existing))}.${ext}`;
    await fs.writeFile(path.join(refsDir, filename), buffer);
    return NextResponse.json({
      slug,
      filename,
      ref: `/projects/${slug}/refs/${filename}`,
    });
  } catch (e) {
    return jsonError(e);
  }
}
