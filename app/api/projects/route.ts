import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import { badRequest, conflict, jsonError } from "@/lib/http";
import {
  dirExists,
  listDirs,
  PROJECTS_DIR,
  readJson,
  safeJoin,
  slugify,
  validSlug,
  writeJson,
} from "@/lib/storage";

interface ProjectMeta {
  name?: string;
  description?: string;
  masterPrompt?: string;
  installedFrom?: string | null;
}

export async function GET() {
  try {
    const slugs = (await listDirs(PROJECTS_DIR)).sort();
    const projects = [];
    for (const s of slugs) {
      if (!validSlug(s)) continue;
      const meta = await readJson<ProjectMeta>(path.join(PROJECTS_DIR, s, "project.json"), {
        name: s,
      });
      const carouselSlugs = await listDirs(path.join(PROJECTS_DIR, s, "carousels"));
      projects.push({
        slug: s,
        name: meta.name || s,
        description: meta.description || "",
        carouselCount: carouselSlugs.length,
        installedFrom: meta.installedFrom || null,
      });
    }
    return NextResponse.json({ projects });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
      masterPrompt?: string;
      slug?: string;
    };
    const { name, description, masterPrompt, slug: requestedSlug } = body;
    if (!name || typeof name !== "string") return badRequest("name required");
    const slug = requestedSlug ? slugify(requestedSlug) : slugify(name);
    if (!validSlug(slug)) return badRequest("could not derive a valid slug from name");

    const target = safeJoin(PROJECTS_DIR, slug);
    if (await dirExists(target)) {
      return conflict(`project "${slug}" already exists`, { slug });
    }

    await fs.mkdir(path.join(target, "refs"), { recursive: true });
    await fs.mkdir(path.join(target, "carousels"), { recursive: true });
    await writeJson(path.join(target, "project.json"), {
      name,
      description: description || "",
      masterPrompt: masterPrompt || "",
    });
    return NextResponse.json({ slug }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
