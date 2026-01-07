// API for listing folders in the DOS directory
import { readdir, stat } from "fs/promises";
import { join } from "path";
import { getDosDir } from "~/lib/build-bundle.server";

export interface FolderItem {
  name: string;
  type: "folder" | "file";
  children?: FolderItem[];
}

async function getFolderTree(dirPath: string, depth: number = 0): Promise<FolderItem[]> {
  // Limit depth to prevent too deep recursion
  if (depth > 5) return [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const items: FolderItem[] = [];

    for (const entry of entries) {
      // Skip hidden files and .jsdos folder
      if (entry.name.startsWith(".")) continue;

      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const children = await getFolderTree(fullPath, depth + 1);
        items.push({
          name: entry.name,
          type: "folder",
          children,
        });
      } else {
        items.push({
          name: entry.name,
          type: "file",
        });
      }
    }

    // Sort: folders first, then files, alphabetically
    items.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "folder" ? -1 : 1;
    });

    return items;
  } catch {
    return [];
  }
}

export async function loader() {
  const dosDir = getDosDir();

  try {
    const tree = await getFolderTree(dosDir);
    return Response.json({ success: true, tree });
  } catch (error) {
    console.error("Failed to list folders:", error);
    return Response.json(
      { success: false, error: "Failed to list folders" },
      { status: 500 }
    );
  }
}
