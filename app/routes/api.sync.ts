// API for syncing emulator filesystem changes to server
import { join, dirname } from "path";
import { mkdir, writeFile, rm, readdir } from "fs/promises";
import { unzipSync } from "fflate";
import { buildBundle, getDosDir } from "~/lib/build-bundle.server";

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return Response.json(
      { success: false, error: "Method not allowed" },
      { status: 405 }
    );
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return Response.json(
      { success: false, error: "서버에 비밀번호가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const password = formData.get("password") as string;
    const bundleFile = formData.get("bundle") as File;

    if (!bundleFile) {
      return Response.json(
        { success: false, error: "번들 파일이 필요합니다." },
        { status: 400 }
      );
    }

    // Verify password
    if (password !== adminPassword) {
      return Response.json(
        { success: false, error: "비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    const dosDir = getDosDir();
    const results = {
      added: [] as string[],
      errors: [] as string[],
    };

    // Read the bundle as Uint8Array
    const bundleBuffer = await bundleFile.arrayBuffer();
    const bundleData = new Uint8Array(bundleBuffer);

    // Unzip the bundle
    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = unzipSync(bundleData);
    } catch (err) {
      return Response.json(
        { success: false, error: "번들 압축 해제 실패" },
        { status: 400 }
      );
    }

    console.log("Received bundle size:", bundleData.length, "bytes");
    console.log("Files in bundle:", Object.keys(unzipped).filter(k => !k.endsWith("/")));

    // NOTE: persist() returns only changed files, so we merge with existing files
    // (don't clear the directory)

    // Extract files from bundle to dos/ directory (merge/overwrite)
    for (const [path, content] of Object.entries(unzipped)) {
      // Skip .jsdos config directory (internal js-dos files)
      if (path.startsWith(".jsdos/")) {
        continue;
      }

      // Skip directory entries (they end with / or have empty content)
      if (path.endsWith("/") || content.length === 0) {
        continue;
      }

      // Sanitize path
      const sanitized = path.replace(/\.\./g, "").replace(/^\//, "");
      if (!sanitized) continue;

      const fullPath = join(dosDir, sanitized);

      // Make sure we're not writing outside dos/
      if (!fullPath.startsWith(dosDir)) {
        results.errors.push(`잘못된 경로: ${path}`);
        continue;
      }

      try {
        await mkdir(dirname(fullPath), { recursive: true });
        await writeFile(fullPath, content);
        results.added.push(path);
      } catch (err) {
        results.errors.push(
          `파일 생성 실패: ${path} - ${err instanceof Error ? err.message : "Unknown error"}`
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

    console.log("Sync results:", {
      addedCount: results.added.length,
      errorsCount: results.errors.length,
      errors: results.errors,
      bundleSize,
    });

    return Response.json({
      success: results.errors.length === 0,
      added: results.added,
      fileCount: results.added.length,
      errors: results.errors.length > 0 ? results.errors : undefined,
      bundleSize,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "동기화 실패",
      },
      { status: 500 }
    );
  }
}
