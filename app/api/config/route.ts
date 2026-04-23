import { NextResponse } from "next/server";

import { GROK_ASPECT_RATIO, GROK_RESOLUTION, PROVIDER } from "@/lib/providers";

export async function GET() {
  return NextResponse.json({
    provider: PROVIDER,
    grok: { aspect_ratio: GROK_ASPECT_RATIO, resolution: GROK_RESOLUTION },
  });
}
