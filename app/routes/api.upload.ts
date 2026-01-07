// Resource route for file upload API (no default export = no component)
import { join, dirname } from "path";
import { mkdir, writeFile, readdir } from "fs/promises";
import { getDosDir } from "~/lib/build-bundle.server";

interface UploadResult {
  success: boolean;
  folders: {
    originalName: string;
    finalName: string;
    fileCount: number;
  }[];
  errors?: string[];
}

// Resolve duplicate directory names by adding numeric suffix
async function resolveDirectoryName(
  dosDir: string,
  name: string
): Promise<string> {
  let existing: string[];
  try {
    existing = await readdir(dosDir);
  } catch {
    // Directory doesn't exist yet
    return name;
  }

  const upperExisting = existing.map((e) => e.toUpperCase());

  if (!upperExisting.includes(name.toUpperCase())) {
    return name;
  }

  // Find available suffix (NAME1, NAME2, etc.)
  // Must still fit in 8 characters
  for (let counter = 1; counter < 100; counter++) {
    const suffix = String(counter);
    const maxBaseLen = 8 - suffix.length;
    const baseName = name.substring(0, maxBaseLen);
    const candidate = `${baseName}${suffix}`;

    if (!upperExisting.includes(candidate.toUpperCase())) {
      return candidate;
    }
  }

  throw new Error(`Cannot find available name for folder: ${name}`);
}

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return Response.json(
      { success: false, errors: ["Method not allowed"] },
      { status: 405 }
    );
  }

  try {
    const formData = await request.formData();
    const result = await processUpload(formData);

    return Response.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json(
      {
        success: false,
        errors: [error instanceof Error ? error.message : "Upload failed"],
      },
      { status: 500 }
    );
  }
}

async function processUpload(formData: FormData): Promise<UploadResult> {
  const DOS_DIR = getDosDir();
  const folders: UploadResult["folders"] = [];
  const errors: string[] = [];

  // Group files by their root folder
  // FormData key format: "file:FOLDERNAME/subdir/file.txt"
  const filesByFolder = new Map<
    string,
    { originalPath: string; file: File }[]
  >();

  for (const [key, value] of formData.entries()) {
    if (value instanceof File && key.startsWith("file:")) {
      const relativePath = key.substring(5); // Remove 'file:' prefix
      const parts = relativePath.split("/");
      const rootFolder = parts[0].toUpperCase();

      if (!filesByFolder.has(rootFolder)) {
        filesByFolder.set(rootFolder, []);
      }

      filesByFolder.get(rootFolder)!.push({
        originalPath: relativePath,
        file: value,
      });
    }
  }

  if (filesByFolder.size === 0) {
    return {
      success: false,
      folders: [],
      errors: ["No files to upload"],
    };
  }

  // Ensure dos directory exists
  await mkdir(DOS_DIR, { recursive: true });

  // Process each folder
  for (const [folderName, files] of filesByFolder) {
    try {
      // Resolve folder name conflicts
      const finalName = await resolveDirectoryName(DOS_DIR, folderName);
      const folderPath = join(DOS_DIR, finalName);

      // Create folder
      await mkdir(folderPath, { recursive: true });

      // Write each file
      for (const { originalPath, file } of files) {
        // Convert path to uppercase
        const upperPath = originalPath.toUpperCase();
        const pathParts = upperPath.split("/");
        pathParts[0] = finalName; // Use resolved name

        const fullPath = join(DOS_DIR, ...pathParts);

        // Ensure parent directory exists
        await mkdir(dirname(fullPath), { recursive: true });

        // Write file
        const buffer = await file.arrayBuffer();
        await writeFile(fullPath, Buffer.from(buffer));
      }

      folders.push({
        originalName: folderName,
        finalName,
        fileCount: files.length,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Failed to process folder ${folderName}: ${errorMsg}`);
    }
  }

  return {
    success: errors.length === 0 && folders.length > 0,
    folders,
    errors: errors.length > 0 ? errors : undefined,
  };
}
