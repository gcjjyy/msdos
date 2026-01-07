// API for applying changes (add/delete) with password verification
import { join, dirname } from "path";
import { mkdir, writeFile, rm } from "fs/promises";
import { buildBundle, getDosDir } from "~/lib/build-bundle.server";

interface ApplyRequest {
  password: string;
  deletions: string[]; // Paths to delete (relative to dos/)
}

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return Response.json(
      { success: false, error: "Method not allowed" },
      { status: 405 }
    );
  }

  const contentType = request.headers.get("content-type") || "";
  const dosDir = getDosDir();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return Response.json(
      { success: false, error: "서버에 비밀번호가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  try {
    let password: string;
    let deletions: string[] = [];
    const filesToAdd: { path: string; file: File }[] = [];

    if (contentType.includes("multipart/form-data")) {
      // Handle form data with files
      const formData = await request.formData();
      password = formData.get("password") as string;
      const deletionsJson = formData.get("deletions") as string;
      deletions = deletionsJson ? JSON.parse(deletionsJson) : [];

      // Get files to add
      for (const [key, value] of formData.entries()) {
        if (value instanceof File && key.startsWith("file:")) {
          const path = key.substring(5); // Remove 'file:' prefix
          filesToAdd.push({ path, file: value });
        }
      }
    } else {
      // Handle JSON (deletions only)
      const body: ApplyRequest = await request.json();
      password = body.password;
      deletions = body.deletions || [];
    }

    // Verify password
    if (password !== adminPassword) {
      return Response.json(
        { success: false, error: "비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    const results = {
      deleted: [] as string[],
      added: [] as string[],
      errors: [] as string[],
    };

    // Process deletions
    for (const relativePath of deletions) {
      // Sanitize path to prevent directory traversal
      const sanitized = relativePath.replace(/\.\./g, "").replace(/^\//, "");
      if (!sanitized) continue;

      const fullPath = join(dosDir, sanitized);

      // Make sure we're not deleting outside dos/
      if (!fullPath.startsWith(dosDir)) {
        results.errors.push(`잘못된 경로: ${relativePath}`);
        continue;
      }

      try {
        await rm(fullPath, { recursive: true, force: true });
        results.deleted.push(relativePath);
      } catch (err) {
        results.errors.push(
          `삭제 실패: ${relativePath} - ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }

    // Process additions
    for (const { path, file } of filesToAdd) {
      const upperPath = path.toUpperCase();
      const fullPath = join(dosDir, upperPath);

      // Make sure we're not writing outside dos/
      if (!fullPath.startsWith(dosDir)) {
        results.errors.push(`잘못된 경로: ${path}`);
        continue;
      }

      try {
        await mkdir(dirname(fullPath), { recursive: true });
        const buffer = await file.arrayBuffer();
        await writeFile(fullPath, Buffer.from(buffer));
        results.added.push(path);
      } catch (err) {
        results.errors.push(
          `추가 실패: ${path} - ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }

    // Rebuild bundle
    let bundleSize: number | undefined;
    try {
      const bundleResult = await buildBundle();
      bundleSize = bundleResult.size;
    } catch (err) {
      results.errors.push(
        `번들 생성 실패: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }

    return Response.json({
      success: results.errors.length === 0,
      deleted: results.deleted,
      added: results.added,
      errors: results.errors.length > 0 ? results.errors : undefined,
      bundleSize,
    });
  } catch (error) {
    console.error("Apply error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "적용 실패",
      },
      { status: 500 }
    );
  }
}
