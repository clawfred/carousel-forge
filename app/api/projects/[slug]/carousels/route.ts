import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import { badRequest, conflict, jsonError, notFound } from "@/lib/http";
import {
  dirExists,
  PROJECTS_DIR,
  safeJoin,
  slugify,
  validSlug,
  writeJson,
} from "@/lib/storage";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    if (!validSlug(slug)) return badRequest("invalid project slug");
    const projectBase = safeJoin(PROJECTS_DIR, slug);
    if (!(await dirExists(projectBase))) return notFound("project not found");

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      description?: string;
      slug?: string;
    };
    const { title, description, slug: requestedSlug } = body;
    if (!title || typeof title !== "string") return badRequest("title required");
    const cslug = requestedSlug ? slugify(requestedSlug) : slugify(title);
    if (!validSlug(cslug)) return badRequest("could not derive valid carousel slug");

    const cbase = safeJoin(projectBase, "carousels", cslug);
    if (await dirExists(cbase)) {
      return conflict(`carousel "${cslug}" already exists`, { slug: cslug });
    }

    await fs.mkdir(path.join(cbase, "slides"), { recursive: true });
    await writeJson(path.join(cbase, "metadata.json"), {
      title,
      description: description || "",
      goal: "",
      idea: "",
      palette: "",
      masterPromptOverride: "",
    });
    await writeJson(path.join(cbase, "slides.json"), [""]);
    return NextResponse.json({ slug: cslug }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
