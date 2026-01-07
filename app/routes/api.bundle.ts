// Resource route for bundle rebuild API
import { buildBundle } from "~/lib/build-bundle.server";

interface BundleResult {
  success: boolean;
  bundleSize?: number;
  error?: string;
}

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return Response.json(
      { success: false, error: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const result = await buildBundle();

    return Response.json({
      success: true,
      bundleSize: result.size,
    } satisfies BundleResult);
  } catch (error) {
    console.error("Bundle error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Bundle failed",
      } satisfies BundleResult,
      { status: 500 }
    );
  }
}
