import path from "node:path";
import sharp from "sharp";

export function slideNumberFromFilename(filename: string): number | null {
  const match = /^(\d+)\./.exec(filename);
  return match ? Number(match[1]) : null;
}

export function mimeFromFilename(filename: string): string {
  const ext = path.extname(filename).slice(1).toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

export function dataUriToBuffer(dataUri: string): { mime: string; buffer: Buffer } {
  const m = /^data:(image\/[a-zA-Z+.-]+);base64,(.*)$/.exec(dataUri);
  if (!m) throw new Error("Invalid data URI");
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
}

export function bufferToDataUri(mime: string, buffer: Buffer): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

// Center-crop to the requested aspect. Used to enforce 4:5 on provider output.
export async function cropToAspect(
  inputBuffer: Buffer,
  aspectW: number,
  aspectH: number,
): Promise<Buffer> {
  const img = sharp(inputBuffer);
  const meta = await img.metadata();
  const srcW = meta.width;
  const srcH = meta.height;
  if (!srcW || !srcH) throw new Error("Source image missing dimensions");

  const targetRatio = aspectW / aspectH;
  const srcRatio = srcW / srcH;

  let cropW: number;
  let cropH: number;
  let left: number;
  let top: number;
  if (srcRatio > targetRatio) {
    cropH = srcH;
    cropW = Math.round(srcH * targetRatio);
    left = Math.round((srcW - cropW) / 2);
    top = 0;
  } else {
    cropW = srcW;
    cropH = Math.round(srcW / targetRatio);
    left = 0;
    top = Math.round((srcH - cropH) / 2);
  }
  return sharp(inputBuffer)
    .extract({ left, top, width: cropW, height: cropH })
    .png()
    .toBuffer();
}
