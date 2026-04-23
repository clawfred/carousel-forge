import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { readPreset } from "@/lib/project-store";
import { listDirs, PRESETS_DIR } from "@/lib/storage";

export async function GET() {
  try {
    const slugs = (await listDirs(PRESETS_DIR)).sort();
    const presets = [];
    for (const s of slugs) {
      const p = await readPreset(s);
      if (p) presets.push(p);
    }
    return NextResponse.json({ presets });
  } catch (e) {
    return jsonError(e);
  }
}
