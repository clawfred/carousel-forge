import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import { slideNumberFromFilename } from "@/lib/image";
import { badRequest, jsonError, notFound } from "@/lib/http";
import { readCarousel } from "@/lib/project-store";
import {
  dirExists,
  listFiles,
  PROJECTS_DIR,
  readJson,
  safeJoin,
  validSlug,
  writeJson,
} from "@/lib/storage";

interface CarouselMeta {
  title?: string;
  description?: string;
  goal?: string;
  idea?: string;
  palette?: string;
  masterPromptOverride?: string;
}

interface PatchBody extends CarouselMeta {
  slides?: string[];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; cslug: string }> },
) {
  try {
    const { slug, cslug } = await params;
    const c = await readCarousel(slug, cslug);
    if (!c) return notFound("carousel not found");
    return NextResponse.json(c);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; cslug: string }> },
) {
  try {
    const { slug, cslug } = await params;
    if (!validSlug(slug) || !validSlug(cslug)) return badRequest("invalid slug");
    const cbase = safeJoin(PROJECTS_DIR, slug, "carousels", cslug);
    if (!(await dirExists(cbase))) return notFound("carousel not found");

    const body = (await req.json().catch(() => ({}))) as PatchBody;

    if (body.slides !== undefined) {
      if (!Array.isArray(body.slides)) return badRequest("slides must be array");
      const slidesPath = path.join(cbase, "slides.json");
      const oldSlides = await readJson<string[]>(slidesPath, []);
      const nextSlides = body.slides;
      await writeJson(slidesPath, nextSlides);

      // Invalidate stale renders when prompt text changes or slide count shrinks.
      const slidesDir = path.join(cbase, "slides");
      const renderedFiles = await listFiles(slidesDir);
      const stale = new Set<number>();
      const max = Math.max(oldSlides.length, nextSlides.length);
      for (let i = 0; i < max; i++) {
        const oldText = typeof oldSlides[i] === "string" ? oldSlides[i] : "";
        const nextText = typeof nextSlides[i] === "string" ? nextSlides[i] : "";
        if (i >= nextSlides.length || oldText !== nextText) stale.add(i + 1);
      }
      for (const file of renderedFiles) {
        const n = slideNumberFromFilename(file);
        if (n !== null && stale.has(n)) {
          await fs.rm(path.join(slidesDir, file), { force: true });
        }
      }
    }

    if (
      body.title !== undefined ||
      body.description !== undefined ||
      body.goal !== undefined ||
      body.idea !== undefined ||
      body.palette !== undefined ||
      body.masterPromptOverride !== undefined
    ) {
      const metaPath = path.join(cbase, "metadata.json");
      const meta = await readJson<CarouselMeta>(metaPath, {});
      if (typeof body.title === "string") meta.title = body.title;
      if (typeof body.description === "string") meta.description = body.description;
      if (typeof body.goal === "string") meta.goal = body.goal;
      if (typeof body.idea === "string") meta.idea = body.idea;
      if (typeof body.palette === "string") meta.palette = body.palette;
      if (typeof body.masterPromptOverride === "string") {
        meta.masterPromptOverride = body.masterPromptOverride;
      }
      await writeJson(metaPath, meta);
    }

    return NextResponse.json({ slug: cslug });
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; cslug: string }> },
) {
  try {
    const { slug, cslug } = await params;
    if (!validSlug(slug) || !validSlug(cslug)) return badRequest("invalid slug");
    const cbase = safeJoin(PROJECTS_DIR, slug, "carousels", cslug);
    if (!(await dirExists(cbase))) return notFound("carousel not found");
    await fs.rm(cbase, { recursive: true, force: true });
    return NextResponse.json({ slug: cslug, deleted: true });
  } catch (e) {
    return jsonError(e);
  }
}
