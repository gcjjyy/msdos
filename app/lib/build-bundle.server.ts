// Server-side bundle builder
// This module is used by the upload API to rebuild the bundle after file changes

import { join, relative, dirname } from "path";
import { readdir, stat, readFile, writeFile, mkdir, rm, symlink } from "fs/promises";
import { zipSync, type Zippable } from "fflate";

const DOSBOX_CONF = `[sdl]
autolock=false
fullscreen=false
windowresolution=original
output=surface

[dosbox]
machine=svga_s3
memsize=16

[cpu]
core=auto
cputype=auto
cycles=auto

[mixer]
nosound=false
rate=44100

[sblaster]
sbtype=sb16
sbbase=220
irq=7
dma=1
hdma=5

[dos]
xms=true
ems=true
umb=true
keyboardlayout=auto

[autoexec]
@echo off
mount c .
c:
if exist AUTOEXEC.BAT call AUTOEXEC.BAT
`;

async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getAllFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function setNestedPath(obj: Zippable, path: string, value: Uint8Array) {
  const parts = path.split("/");
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Zippable;
  }

  current[parts[parts.length - 1]] = value;
}

export async function buildBundle(): Promise<{ size: number }> {
  const DOS_DIR = join(process.cwd(), "dos");
  const BUNDLE_FILE = join(process.cwd(), "public", "bundle.jsdos");

  console.log("Building bundle.jsdos from dos/ folder...");

  // Ensure public directory exists
  await mkdir(dirname(BUNDLE_FILE), { recursive: true });

  // Remove existing bundle
  await rm(BUNDLE_FILE, { force: true });

  const files = await getAllFiles(DOS_DIR);
  const zipData: Zippable = {};

  // Add DOS files
  for (const file of files) {
    const relativePath = relative(DOS_DIR, file);
    const content = await readFile(file);
    setNestedPath(zipData, relativePath, new Uint8Array(content));
  }

  // Add dosbox.conf
  setNestedPath(
    zipData,
    ".jsdos/dosbox.conf",
    new TextEncoder().encode(DOSBOX_CONF)
  );

  // Create ZIP
  const zipped = zipSync(zipData, { level: 9 });

  await writeFile(BUNDLE_FILE, zipped);

  const stats = await stat(BUNDLE_FILE);
  console.log(`Created: ${BUNDLE_FILE} (${stats.size} bytes)`);

  // build/client/bundle.jsdos 심볼릭 링크 생성 (프로덕션 서버용)
  const BUILD_CLIENT_BUNDLE = join(process.cwd(), "build", "client", "bundle.jsdos");
  try {
    await rm(BUILD_CLIENT_BUNDLE, { force: true });
    await symlink(BUNDLE_FILE, BUILD_CLIENT_BUNDLE);
    console.log(`Symlink created: ${BUILD_CLIENT_BUNDLE} -> ${BUNDLE_FILE}`);
  } catch {
    // build/client 폴더가 없으면 무시 (아직 빌드 안 된 경우)
  }

  return { size: stats.size };
}

export function getDosDir(): string {
  return join(process.cwd(), "dos");
}
