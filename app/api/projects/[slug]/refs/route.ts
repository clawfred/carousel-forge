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
    const existing = await listFiles(refsDir);
    for (const f of existing) await fs.rm(path.join(refsDir, f), { force: true });

    const body = (await req.json().catch(() => ({}))) as { refs?: unknown };
    const refs = Array.isArray(body.refs) ? (body.refs as string[]) : [];
    const saved: string[] = [];
    for (let i = 0; i < refs.length; i++) {
      const { mime, buffer } = dataUriToBuffer(refs[i]);
      const ext = (mime.split("/")[1] || "png").replace("+xml", "");
      const filename = `ref-${pad2(i + 1)}.${ext}`;
      await fs.writeFile(path.join(refsDir, filename), buffer);
      saved.push(`/projects/${slug}/refs/${filename}`);
    }
    return NextResponse.json({ slug, refs: saved });
  } catch (e) {
    return jsonError(e);
  }
}
