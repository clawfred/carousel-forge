import path from "node:path";
import { Readable } from "node:stream";

import archiver from "archiver";
import { type NextRequest } from "next/server";

import { slideNumberFromFilename } from "@/lib/image";
import { badRequest, notFound } from "@/lib/http";
import {
  dirExists,
  listFiles,
  PROJECTS_DIR,
  readJson,
  safeJoin,
  validSlug,
} from "@/lib/storage";

export const maxDuration = 300;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; cslug: string }> },
) {
  const { slug, cslug } = await params;
  if (!validSlug(slug) || !validSlug(cslug)) return badRequest("invalid slug");
  const cbase = safeJoin(PROJECTS_DIR, slug, "carousels", cslug);
  if (!(await dirExists(cbase))) return notFound("carousel not found");

  const slidesDir = path.join(cbase, "slides");
  const files = (await listFiles(slidesDir))
    .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .sort();
  const slides = await readJson<string[]>(path.join(cbase, "slides.json"), []);
  const validSlideNumbers = new Set(
    (Array.isArray(slides) ? slides : []).map((_, index) => index + 1),
  );
  const filtered = files.filter((f) => {
    const n = slideNumberFromFilename(f);
    return n !== null && validSlideNumbers.has(n);
  });
  if (filtered.length === 0) return notFound("no rendered slides yet");

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("warning", (err: NodeJS.ErrnoException) => {
    if (err.code !== "ENOENT") console.error("[zip] warning", err);
  });
  archive.on("error", (err) => {
    console.error("[zip] error", err);
  });
  for (const f of filtered) {
    archive.file(path.join(slidesDir, f), { name: `${cslug}/${f}` });
  }
  archive.finalize();

  const webStream = Readable.toWeb(archive) as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${cslug}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
