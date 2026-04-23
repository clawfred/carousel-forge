import { bufferToDataUri } from "@/lib/image";

export const PROVIDER = (process.env.PROVIDER || "openai").toLowerCase();
export const GROK_ASPECT_RATIO = process.env.GROK_ASPECT_RATIO || "3:4";
export const GROK_RESOLUTION = process.env.GROK_RESOLUTION || "2k";

const XAI_KEY = process.env.XAI_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

export interface RefImage {
  mime: string;
  buffer: Buffer;
}

interface GenerateArgs {
  prompt: string;
  refs: RefImage[];
}

function requireKey(provider: "xai" | "openai", key: string | undefined): string {
  if (!key) {
    throw new Error(
      `PROVIDER=${provider} but ${provider === "xai" ? "XAI_API_KEY" : "OPENAI_API_KEY"} is missing. Set it in .env and restart.`,
    );
  }
  return key;
}

async function generateWithXai({ prompt, refs }: GenerateArgs): Promise<Buffer> {
  const key = requireKey("xai", XAI_KEY);
  const imageField = refs.map((r) => ({
    type: "image_url" as const,
    url: bufferToDataUri(r.mime, r.buffer),
  }));

  const body: Record<string, unknown> = {
    model: "grok-imagine-image",
    prompt,
    aspect_ratio: GROK_ASPECT_RATIO,
    resolution: GROK_RESOLUTION,
    response_format: "b64_json",
  };
  if (imageField.length === 1) body.image = imageField[0];
  else if (imageField.length > 1) body.image = imageField;

  const endpoint =
    refs.length > 0
      ? "https://api.x.ai/v1/images/edits"
      : "https://api.x.ai/v1/images/generations";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`xAI ${res.status}: ${text.slice(0, 500)}`);

  let json: { data?: Array<{ b64_json?: string; url?: string }> };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`xAI returned non-JSON: ${text.slice(0, 200)}`);
  }

  const entry = json?.data?.[0];
  if (!entry) throw new Error(`xAI response missing data[0]: ${JSON.stringify(json).slice(0, 500)}`);

  if (entry.b64_json) return Buffer.from(entry.b64_json, "base64");
  if (entry.url) {
    const imgRes = await fetch(entry.url);
    if (!imgRes.ok) throw new Error(`Failed to download xAI temp URL: ${imgRes.status}`);
    return Buffer.from(await imgRes.arrayBuffer());
  }
  throw new Error("xAI response had neither b64_json nor url");
}

async function generateWithOpenAi({ prompt, refs }: GenerateArgs): Promise<Buffer> {
  const key = requireKey("openai", OPENAI_KEY);
  const endpoint =
    refs.length > 0
      ? "https://api.openai.com/v1/images/edits"
      : "https://api.openai.com/v1/images/generations";

  let res: Response;
  if (refs.length > 0) {
    const form = new FormData();
    form.append("model", "gpt-image-2");
    form.append("prompt", prompt);
    form.append("size", "auto");
    form.append("quality", "high");
    form.append("n", "1");
    for (let i = 0; i < refs.length; i++) {
      const r = refs[i];
      const arr = new Uint8Array(r.buffer);
      const blob = new Blob([arr], { type: r.mime });
      form.append("image[]", blob, `ref-${i + 1}.png`);
    }
    res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
  } else {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt,
        size: "auto",
        quality: "high",
        n: 1,
      }),
    });
  }

  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${text.slice(0, 500)}`);
  const json = JSON.parse(text) as { data?: Array<{ b64_json?: string }> };
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`OpenAI response missing data[0].b64_json: ${text.slice(0, 300)}`);
  return Buffer.from(b64, "base64");
}

export async function runProvider(args: GenerateArgs): Promise<Buffer> {
  if (PROVIDER === "xai") return generateWithXai(args);
  return generateWithOpenAi(args);
}
