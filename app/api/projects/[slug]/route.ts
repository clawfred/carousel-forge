import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import { badRequest, jsonError, notFound } from "@/lib/http";
import { readProject } from "@/lib/project-store";
import {
  dirExists,
  PROJECTS_DIR,
  readJson,
  safeJoin,
  validSlug,
  writeJson,
} from "@/lib/storage";

interface ProjectMeta {
  name?: string;
  description?: string;
  masterPrompt?: string;
  installedFrom?: string | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const project = await readProject(slug);
    if (!project) return notFound("project not found");
    return NextResponse.json(project);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    if (!validSlug(slug)) return badRequest("invalid slug");
    const base = safeJoin(PROJECTS_DIR, slug);
    if (!(await dirExists(base))) return notFound("project not found");

    const metaPath = path.join(base, "project.json");
    const meta = await readJson<ProjectMeta>(metaPath, {});
    const body = (await req.json().catch(() => ({}))) as ProjectMeta;
    if (typeof body.name === "string") meta.name = body.name;
    if (typeof body.description === "string") meta.description = body.description;
    if (typeof body.masterPrompt === "string") meta.masterPrompt = body.masterPrompt;
    await writeJson(metaPath, meta);
    return NextResponse.json({ slug });
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    if (!validSlug(slug)) return badRequest("invalid slug");
    const base = safeJoin(PROJECTS_DIR, slug);
    if (!(await dirExists(base))) return notFound("project not found");
    await fs.rm(base, { recursive: true, force: true });
    return NextResponse.json({ slug, deleted: true });
  } catch (e) {
    return jsonError(e);
  }
}
