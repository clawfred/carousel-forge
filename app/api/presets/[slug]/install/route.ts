import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import { badRequest, conflict, jsonError, notFound } from "@/lib/http";
import {
  copyDir,
  dirExists,
  PRESETS_DIR,
  PROJECTS_DIR,
  readJson,
  safeJoin,
  slugify,
  validSlug,
  writeJson,
} from "@/lib/storage";

interface BrandMeta {
  name?: string;
  description?: string;
  masterPrompt?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug: presetSlug } = await params;
    if (!validSlug(presetSlug)) return badRequest("invalid preset slug");
    const presetDir = safeJoin(PRESETS_DIR, presetSlug);
    if (!(await dirExists(presetDir))) return notFound("preset not found");

    const body = (await req.json().catch(() => ({}))) as { targetSlug?: string };
    const requestedSlug = body.targetSlug ? slugify(body.targetSlug) : presetSlug;
    if (!validSlug(requestedSlug)) return badRequest("invalid target slug");

    const targetDir = safeJoin(PROJECTS_DIR, requestedSlug);
    if (await dirExists(targetDir)) {
      return conflict(`project "${requestedSlug}" already exists`, { slug: requestedSlug });
    }

    const presetCarouselsDir = path.join(presetDir, "carousels");
    if (await dirExists(presetCarouselsDir)) {
      await copyDir(presetCarouselsDir, path.join(targetDir, "carousels"));
    } else {
      await fs.mkdir(path.join(targetDir, "carousels"), { recursive: true });
    }

    const brand = await readJson<BrandMeta>(path.join(presetDir, "brand.json"), {});
    await fs.mkdir(path.join(targetDir, "refs"), { recursive: true });
    await writeJson(path.join(targetDir, "project.json"), {
      name: brand.name || presetSlug,
      description: brand.description || "",
      masterPrompt: brand.masterPrompt || "",
      installedFrom: presetSlug,
    });

    return NextResponse.json({ slug: requestedSlug }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
