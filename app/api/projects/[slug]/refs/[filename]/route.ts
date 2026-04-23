import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import { badRequest, jsonError, notFound } from "@/lib/http";
import { dirExists, PROJECTS_DIR, safeJoin, validSlug } from "@/lib/storage";

const REF_FILE_RE = /^ref-\d+\.(png|jpg|jpeg|webp)$/i;

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; filename: string }> },
) {
  try {
    const { slug, filename } = await params;
    if (!validSlug(slug)) return badRequest("invalid slug");
    if (!REF_FILE_RE.test(filename)) return badRequest("invalid filename");

    const refsDir = safeJoin(PROJECTS_DIR, slug, "refs");
    if (!(await dirExists(refsDir))) return notFound("project not found");
    const target = path.join(refsDir, filename);
    if (!target.startsWith(refsDir + path.sep)) return badRequest("path escapes refs dir");

    try {
      await fs.rm(target, { force: true });
    } catch (e) {
      return jsonError(e);
    }
    return NextResponse.json({ slug, filename, deleted: true });
  } catch (e) {
    return jsonError(e);
  }
}
