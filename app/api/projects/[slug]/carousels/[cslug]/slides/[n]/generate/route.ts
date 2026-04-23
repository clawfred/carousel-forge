import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import {
  cropToAspect,
  mimeFromFilename,
  slideNumberFromFilename,
} from "@/lib/image";
import { badRequest, errorMessage, notFound } from "@/lib/http";
import { runProvider, type RefImage } from "@/lib/providers";
import {
  dirExists,
  listFiles,
  pad2,
  PROJECTS_DIR,
  readJson,
  safeJoin,
  validSlug,
} from "@/lib/storage";

interface ProjectMeta {
  masterPrompt?: string;
}

interface CarouselMeta {
  description?: string;
  goal?: string;
  idea?: string;
  palette?: string;
  masterPromptOverride?: string;
}

export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; cslug: string; n: string }> },
) {
  const started = Date.now();
  try {
    const { slug, cslug, n } = await params;
    if (!validSlug(slug) || !validSlug(cslug)) return badRequest("invalid slug");
    const slideNumber = Number(n);
    if (!Number.isInteger(slideNumber) || slideNumber < 1 || slideNumber > 99) {
      return badRequest("slide number must be 1-99");
    }

    const projectBase = safeJoin(PROJECTS_DIR, slug);
    const cbase = safeJoin(projectBase, "carousels", cslug);
    if (!(await dirExists(cbase))) return notFound("carousel not found");

    const project = await readJson<ProjectMeta>(path.join(projectBase, "project.json"), {});
    const carouselMeta = await readJson<CarouselMeta>(path.join(cbase, "metadata.json"), {});
    const slides = await readJson<string[]>(path.join(cbase, "slides.json"), []);

    const idx = slideNumber - 1;
    const slideText = slides[idx];
    if (!slideText || !String(slideText).trim()) return badRequest("slide text is empty");

    // Effective master prompt: carousel override wins if non-empty, else project prompt.
    const override = (carouselMeta.masterPromptOverride || "").trim();
    const base = (project.masterPrompt || "").trim();
    const effectivePrompt = override || base;

    const refsDir = path.join(projectBase, "refs");
    const refFiles = (await listFiles(refsDir)).sort();
    const projectRefs: RefImage[] = [];
    for (const f of refFiles) {
      const buffer = await fs.readFile(path.join(refsDir, f));
      projectRefs.push({ mime: mimeFromFilename(f), buffer });
    }

    // For slides 2-N, also anchor to the generated cover if it exists.
    const refs: RefImage[] = [];
    let hasApprovedCover = false;
    if (slideNumber > 1) {
      const coverRender = (await listFiles(path.join(cbase, "slides")))
        .sort()
        .find(
          (f) =>
            slideNumberFromFilename(f) === 1 && /\.(png|jpg|jpeg|webp)$/i.test(f),
        );
      if (coverRender) {
        const buffer = await fs.readFile(path.join(cbase, "slides", coverRender));
        refs.push({ mime: mimeFromFilename(coverRender), buffer });
        hasApprovedCover = true;
      }
    }
    refs.push(...projectRefs);

    const briefLines = [
      carouselMeta.goal ? `- Overall goal: ${String(carouselMeta.goal).trim()}` : null,
      carouselMeta.idea ? `- Core idea: ${String(carouselMeta.idea).trim()}` : null,
      carouselMeta.palette ? `- Palette note: ${String(carouselMeta.palette).trim()}` : null,
      carouselMeta.description
        ? `- Working note: ${String(carouselMeta.description).trim()}`
        : null,
    ].filter(Boolean);

    const styleLines: string[] = [];
    if (hasApprovedCover) {
      styleLines.push(
        "The first attached image is the approved cover for this carousel. Treat it as the primary style anchor for the rest of the deck.",
      );
    }
    if (projectRefs.length > 0) {
      styleLines.push(
        `The remaining attached reference image${projectRefs.length > 1 ? "s are" : " is"} previous successful covers from this project. Reuse their typography, gradient language, spacing rhythm, and color behavior.`,
      );
    }
    if (refs.length > 0) {
      styleLines.push(
        "Do not drift stylistically. Match the type system, contrast, composition discipline, and brand feel as closely as possible.",
      );
    }

    const prompt = [
      effectivePrompt,
      "",
      briefLines.length > 0 ? "Carousel brief:" : null,
      ...briefLines,
      briefLines.length > 0 ? "" : null,
      ...styleLines,
      styleLines.length > 0 ? "" : null,
      "—",
      "",
      "Now generate this slide (render only this slide as a single 4:5 portrait image, no surrounding UI, no frame):",
      "",
      String(slideText).trim(),
    ]
      .filter((line) => line !== null)
      .join("\n");

    const rawBuffer = await runProvider({ prompt, refs });
    const finalBuffer = await cropToAspect(rawBuffer, 4, 5);

    const filename = `${pad2(slideNumber)}.png`;
    const outDir = path.join(cbase, "slides");
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, filename), finalBuffer);

    return NextResponse.json({
      slug,
      carouselSlug: cslug,
      slideNumber,
      filename,
      url: `/projects/${slug}/carousels/${cslug}/slides/${filename}`,
      ms: Date.now() - started,
    });
  } catch (e) {
    return NextResponse.json(
      { error: errorMessage(e), ms: Date.now() - started },
      { status: 500 },
    );
  }
}
