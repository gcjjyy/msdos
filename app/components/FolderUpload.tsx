import { useState, useRef } from "react";
import { validateFolder, type ValidationError } from "~/lib/validation";

interface FolderInfo {
  name: string;
  files: File[];
  valid: boolean;
  errors: ValidationError[];
}

interface FolderUploadProps {
  onBundleRebuilt?: () => void;
}

type UploadStatus =
  | "idle"
  | "uploading"
  | "rebuilding"
  | "success"
  | "error";

export default function FolderUpload({ onBundleRebuilt }: FolderUploadProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasErrors = folders.some((f) => !f.valid);
  const canUpload = folders.length > 0 && !hasErrors && status === "idle";

  const handleAddFolder = () => {
    fileInputRef.current?.click();
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const firstPath = files[0].webkitRelativePath;
    const folderName = firstPath.split("/")[0];

    if (folders.some((f) => f.name.toUpperCase() === folderName.toUpperCase())) {
      alert(`Folder "${folderName}" is already added.`);
      e.target.value = "";
      return;
    }

    const validation = validateFolder(folderName, files);

    const newFolder: FolderInfo = {
      name: folderName,
      files,
      valid: validation.valid,
      errors: validation.errors,
    };

    setFolders((prev) => [...prev, newFolder]);
    e.target.value = "";
  };

  const handleRemoveFolder = (index: number) => {
    setFolders((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!canUpload) return;

    // Step 1: Upload files
    setStatus("uploading");
    setStatusMessage("Uploading files...");

    try {
      const formData = new FormData();

      for (const folder of folders) {
        for (const file of folder.files) {
          formData.append(`file:${file.webkitRelativePath}`, file);
        }
      }

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (!uploadResult.success) {
        setStatus("error");
        setStatusMessage(
          `Upload failed: ${uploadResult.errors?.join(", ") || "Unknown error"}`
        );
        return;
      }

      // Step 2: Show upload complete
      const folderNames = uploadResult.folders
        .map(
          (f: { originalName: string; finalName: string }) =>
            f.originalName !== f.finalName
              ? `${f.originalName} -> ${f.finalName}`
              : f.originalName
        )
        .join(", ");
      setStatusMessage(`Upload complete: ${folderNames}. Building bundle...`);

      // Step 3: Rebuild bundle
      setStatus("rebuilding");

      const bundleResponse = await fetch("/api/bundle", {
        method: "POST",
      });

      const bundleResult = await bundleResponse.json();

      if (!bundleResult.success) {
        setStatus("error");
        setStatusMessage(
          `Bundle failed: ${bundleResult.error || "Unknown error"}`
        );
        return;
      }

      // Step 4: Success
      setStatus("success");
      setStatusMessage(
        `Complete: ${folderNames}. Bundle size: ${formatSize(bundleResult.bundleSize)}`
      );

      setFolders([]);
      onBundleRebuilt?.();

      setTimeout(() => {
        setStatus("idle");
        setStatusMessage("");
      }, 3000);
    } catch (error) {
      setStatus("error");
      setStatusMessage(
        `Failed: ${error instanceof Error ? error.message : "Network error"}`
      );
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTotalFiles = (): number => {
    return folders.reduce((sum, f) => sum + f.files.length, 0);
  };

  return (
    <div className="bg-dos-header border-b border-dos-border">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer select-none hover:bg-[#1a2744]"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 text-sm text-dos-accent">
          <span>{isExpanded ? "▼" : "▶"}</span>
          <span>Add Folders</span>
          {folders.length > 0 && (
            <span className="text-dos-muted text-xs">
              ({folders.length} folders, {getTotalFiles()} files)
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 border-t border-dos-border">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            // @ts-expect-error webkitdirectory is not in standard types
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleFolderSelect}
            className="hidden"
          />

          {/* Folder list */}
          {folders.length > 0 && (
            <div className="mb-4 space-y-2">
              {folders.map((folder, index) => (
                <div
                  key={`${folder.name}-${index}`}
                  className={`flex items-start justify-between p-3 rounded bg-white/5 border-l-3 ${
                    folder.valid ? "border-l-dos-accent" : "border-l-dos-error"
                  }`}
                >
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center gap-2 font-bold text-dos-text">
                      <span
                        className={
                          folder.valid ? "text-dos-accent" : "text-dos-error"
                        }
                      >
                        {folder.valid ? "✓" : "✗"}
                      </span>
                      {folder.name}
                    </div>
                    <div className="text-xs text-dos-muted">
                      {folder.files.length} files
                    </div>
                    {folder.errors.length > 0 && (
                      <div className="text-xs text-dos-error mt-1">
                        {folder.errors.slice(0, 3).map((err, i) => (
                          <div key={i}>{err.message}</div>
                        ))}
                        {folder.errors.length > 3 && (
                          <div>...and {folder.errors.length - 3} more errors</div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    className="px-2 py-1 text-xs border border-dos-error text-dos-error rounded hover:bg-dos-error/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => handleRemoveFolder(index)}
                    disabled={status !== "idle"}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Status message */}
          {statusMessage && (
            <div
              className={`mt-3 p-2 rounded text-sm ${
                status === "error"
                  ? "bg-dos-error/10 text-dos-error"
                  : "bg-dos-accent/10 text-dos-accent"
              }`}
            >
              {statusMessage}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              className="px-4 py-2 text-sm bg-[#333] text-dos-text border border-[#555] rounded hover:bg-[#444] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleAddFolder}
              disabled={status !== "idle"}
            >
              + Add Folder
            </button>
            <button
              className="px-4 py-2 text-sm font-bold bg-dos-accent text-dos-bg rounded hover:bg-dos-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleUpload}
              disabled={!canUpload}
            >
              {status === "uploading"
                ? "Uploading..."
                : status === "rebuilding"
                  ? "Bundling..."
                  : "Upload"}
            </button>
          </div>

          {/* Validation hint */}
          {hasErrors && (
            <div className="mt-3 p-2 rounded text-xs bg-dos-warning/10 text-dos-warning">
              Fix validation errors before uploading. All file and folder names
              must follow MS-DOS 8.3 naming convention.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
