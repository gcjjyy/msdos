import { join, relative, dirname } from "path";
import { readdir, stat, readFile, writeFile, mkdir, rm } from "fs/promises";
import { zipSync, type Zippable } from "fflate";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DOS_DIR = join(__dirname, "dos");
const BUNDLE_FILE = join(__dirname, "public", "bundle.jsdos");

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

async function build() {
  console.log("Building bundle.jsdos from dos/ folder...");

  // public 디렉토리 확인
  await mkdir(dirname(BUNDLE_FILE), { recursive: true });

  // 기존 번들 삭제
  await rm(BUNDLE_FILE, { force: true });

  const files = await getAllFiles(DOS_DIR);
  const zipData: Zippable = {};

  // DOS 파일 추가
  for (const file of files) {
    const relativePath = relative(DOS_DIR, file);
    const content = await readFile(file);
    setNestedPath(zipData, relativePath, new Uint8Array(content));
  }

  // dosbox.conf 추가
  setNestedPath(
    zipData,
    ".jsdos/dosbox.conf",
    new TextEncoder().encode(DOSBOX_CONF)
  );

  // ZIP 생성
  const zipped = zipSync(zipData, { level: 9 });

  await writeFile(BUNDLE_FILE, zipped);

  const stats = await stat(BUNDLE_FILE);
  console.log(`Created: ${BUNDLE_FILE} (${stats.size} bytes)`);
  console.log("Done!");
}

build().catch(console.error);
