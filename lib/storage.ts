import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

import { slugify as baseSlugify } from "./slug";

export const PRESETS_DIR = path.join(process.cwd(), "presets");
export const PROJECTS_DIR = path.join(process.cwd(), "projects");

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function slugify(s: string): string {
  return baseSlugify(s, 63);
}

export function validSlug(s: unknown): s is string {
  return typeof s === "string" && SLUG_RE.test(s);
}

// Resolve a safe absolute path under a root directory. Throws on escape attempts.
export function safeJoin(root: string, ...parts: string[]): string {
  for (const p of parts) {
    if (typeof p !== "string" || p.includes("..") || p.includes("/") || p.includes("\\")) {
      throw new Error(`Unsafe path segment: ${p}`);
    }
  }
  const abs = path.join(root, ...parts);
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error(`Path escapes root: ${abs}`);
  }
  return abs;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(filePath: string, obj: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

export async function dirExists(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function listDirs(p: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(p, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

export async function listFiles(p: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(p, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}

// Recursive copy — used when installing a preset into projects/.
export async function copyDir(src: string, dst: string): Promise<void> {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

fsSync.mkdirSync(PROJECTS_DIR, { recursive: true });
