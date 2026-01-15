import { useState, useEffect, useRef } from "react";
import { type FolderItem } from "~/components/FolderTree";
import DirectoryTree from "~/components/DirectoryTree";
import FileList from "~/components/FileList";
import { validateFolder } from "~/lib/validation";
import { useIsMobile } from "~/lib/useIsMobile";

interface PendingFolder {
  name: string;
  files: File[];
  valid: boolean;
  errorCount: number;
  targetPath: string | null; // 업로드 대상 경로 (null이면 루트)
}

type ApplyStatus = "idle" | "applying" | "success" | "error";
type SyncStatus = "idle" | "syncing" | "success" | "error";

export default function AdminPanel() {
  const [tree, setTree] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set());
  const [pendingAdditions, setPendingAdditions] = useState<PendingFolder[]>([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [password, setPassword] = useState("");
  const [applyStatus, setApplyStatus] = useState<ApplyStatus>("idle");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const hasChanges = pendingDeletions.size > 0 || pendingAdditions.length > 0;
  const hasInvalidAdditions = pendingAdditions.some((f) => !f.valid);
  const hasSelection = selectedPaths.size > 0;

  const fetchTree = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/folders");
      const data = await response.json();
      if (data.success) setTree(data.tree);
    } catch (error) {
      console.error("Failed to fetch folder tree:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, []);

  const getTopLevelPaths = (paths: Set<string>): Set<string> => {
    const result = new Set<string>();
    for (const path of paths) {
      const parts = path.split("/");
      let hasSelectedParent = false;
      for (let i = 1; i < parts.length; i++) {
        const parentPath = parts.slice(0, i).join("/");
        if (paths.has(parentPath)) {
          hasSelectedParent = true;
          break;
        }
      }
      if (!hasSelectedParent) result.add(path);
    }
    return result;
  };

  const handleDeleteSelected = () => {
    const topLevelPaths = getTopLevelPaths(selectedPaths);
    setPendingDeletions((prev) => new Set([...prev, ...topLevelPaths]));
    setSelectedPaths(new Set());
  };

  const handleDeleteFolder = (path: string) => {
    setPendingDeletions((prev) => new Set([...prev, path]));
    setCurrentPath(null);
  };

  const handleUndoDeletion = (path: string) => {
    setPendingDeletions((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  };

  const handleAddFolder = () => fileInputRef.current?.click();

  const handleSyncClick = () => {
    if (!window.dosCI) {
      setStatusMessage("에뮬레이터가 실행 중이 아닙니다. DOSBox 탭으로 이동하여 에뮬레이터를 실행해주세요.");
      setSyncStatus("error");
      setTimeout(() => {
        setSyncStatus("idle");
        setStatusMessage("");
      }, 3000);
      return;
    }
    setShowSyncModal(true);
    setPassword("");
    setSyncStatus("idle");
  };

  const handleSync = async () => {
    if (!window.dosCI) {
      setSyncStatus("error");
      setStatusMessage("에뮬레이터가 실행 중이 아닙니다.");
      return;
    }

    setSyncStatus("syncing");
    setStatusMessage("에뮬레이터에서 파일시스템 추출 중...");

    try {
      // Request filesystem pack first (triggers internal save)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ci = window.dosCI as any;
      if (ci.transport?.sendMessageToServer) {
        ci.transport.sendMessageToServer("wc-pack-fs-to-bundle", {});
      }

      // Wait for pack to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Now get the packed filesystem
      const bundleData = await window.dosCI.persist();

      if (!bundleData) {
        setSyncStatus("error");
        setStatusMessage("파일시스템을 추출할 수 없습니다.");
        return;
      }

      setStatusMessage("서버에 동기화 중...");

      // Send to server
      const formData = new FormData();
      formData.append("password", password);
      formData.append("bundle", new Blob([new Uint8Array(bundleData)], { type: "application/zip" }), "bundle.zip");

      const response = await fetch("/api/sync", { method: "POST", body: formData });
      const result = await response.json();

      if (result.success) {
        setSyncStatus("success");
        setStatusMessage(`동기화 완료! ${result.fileCount}개 파일 동기화됨`);
        setShowSyncModal(false);
        fetchTree();
        setTimeout(() => {
          setSyncStatus("idle");
          setStatusMessage("");
        }, 3000);
      } else {
        setSyncStatus("error");
        setStatusMessage(result.error || "동기화 실패");
      }
    } catch (error) {
      setSyncStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "네트워크 오류");
    }
  };

  const handleCancelSyncModal = () => {
    setShowSyncModal(false);
    setPassword("");
    setSyncStatus("idle");
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const firstPath = files[0].webkitRelativePath;
    const folderName = firstPath.split("/")[0];

    // 대상 경로 (현재 선택된 폴더 또는 루트)
    const targetPath = currentPath;
    const fullTargetPath = targetPath ? `${targetPath}/${folderName}` : folderName;

    // 중복 확인: 대상 경로 내에서 같은 이름의 폴더가 있는지 확인
    const checkDuplicateInTree = (items: FolderItem[], pathParts: string[]): boolean => {
      if (pathParts.length === 0) {
        return items.some((f) => f.name.toUpperCase() === folderName.toUpperCase());
      }
      const [first, ...rest] = pathParts;
      const folder = items.find((f) => f.name.toUpperCase() === first.toUpperCase() && f.type === "folder");
      if (!folder || !folder.children) return false;
      return checkDuplicateInTree(folder.children, rest);
    };

    const pathParts = targetPath ? targetPath.split("/") : [];
    const existsInTree = checkDuplicateInTree(tree, pathParts);
    const existsInPending = pendingAdditions.some(
      (f) => {
        const pendingFullPath = f.targetPath ? `${f.targetPath}/${f.name}` : f.name;
        return pendingFullPath.toUpperCase() === fullTargetPath.toUpperCase();
      }
    );

    if (existsInTree || existsInPending) {
      alert(`폴더 "${fullTargetPath}"이(가) 이미 존재합니다.`);
      e.target.value = "";
      return;
    }

    const validation = validateFolder(folderName, files);
    setPendingAdditions((prev) => [
      ...prev,
      { name: folderName, files, valid: validation.valid, errorCount: validation.errors.length, targetPath },
    ]);
    e.target.value = "";
  };

  const handleRemoveAddition = (index: number) => {
    setPendingAdditions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleApplyClick = () => {
    if (hasInvalidAdditions) {
      alert("8.3 규칙을 위반하는 폴더가 있습니다. 해당 폴더를 제거해주세요.");
      return;
    }
    setShowPasswordModal(true);
    setPassword("");
  };

  const handleApply = async () => {
    setApplyStatus("applying");
    setStatusMessage("변경사항 적용 중...");

    try {
      const formData = new FormData();
      formData.append("password", password);
      formData.append("deletions", JSON.stringify([...pendingDeletions]));

      for (const folder of pendingAdditions) {
        for (const file of folder.files) {
          // targetPath가 있으면 경로 앞에 추가
          const filePath = folder.targetPath
            ? `${folder.targetPath}/${file.webkitRelativePath}`
            : file.webkitRelativePath;
          formData.append(`file:${filePath}`, file);
        }
      }

      const response = await fetch("/api/apply", { method: "POST", body: formData });
      const result = await response.json();

      if (result.success) {
        setApplyStatus("success");
        setStatusMessage(`완료! 삭제: ${result.deleted?.length || 0}, 추가: ${result.added?.length || 0}`);
        setPendingDeletions(new Set());
        setPendingAdditions([]);
        setShowPasswordModal(false);
        fetchTree();
        setTimeout(() => {
          setApplyStatus("idle");
          setStatusMessage("");
        }, 3000);
      } else {
        setApplyStatus("error");
        setStatusMessage(result.error || "적용 실패");
      }
    } catch (error) {
      setApplyStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "네트워크 오류");
    }
  };

  const handleCancelModal = () => {
    setShowPasswordModal(false);
    setPassword("");
    setApplyStatus("idle");
    setStatusMessage("");
  };

  const filterDeletedItems = (items: FolderItem[], basePath = ""): FolderItem[] => {
    return items
      .filter((item) => {
        const path = basePath ? `${basePath}/${item.name}` : item.name;
        return !pendingDeletions.has(path);
      })
      .map((item) => {
        if (item.type === "folder" && item.children) {
          const path = basePath ? `${basePath}/${item.name}` : item.name;
          return { ...item, children: filterDeletedItems(item.children, path) };
        }
        return item;
      });
  };

  const filteredTree = filterDeletedItems(tree);

  const getSelectionCounts = () => {
    let folders = 0;
    let files = 0;

    const topLevelPaths = getTopLevelPaths(selectedPaths);

    const findItem = (items: FolderItem[], path: string): FolderItem | null => {
      const parts = path.split("/");
      let current = items;
      for (let i = 0; i < parts.length; i++) {
        const item = current.find((it) => it.name === parts[i]);
        if (!item) return null;
        if (i === parts.length - 1) return item;
        if (item.type === "folder" && item.children) {
          current = item.children;
        } else {
          return null;
        }
      }
      return null;
    };

    for (const path of topLevelPaths) {
      const item = findItem(filteredTree, path);
      if (item) {
        if (item.type === "folder") folders++;
        else files++;
      }
    }
    return { folders, files };
  };

  const selectionCounts = getSelectionCounts();

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${isMobile ? "p-4" : "p-6"}`}>
      <div className="max-w-4xl w-full mx-auto flex flex-col flex-1 overflow-hidden space-y-4">
        <div className="flex-shrink-0">
          <h1 className="text-2xl font-semibold text-content">파일 관리</h1>
          <p className="text-sm text-content-muted mt-1">DOS 파일 시스템을 관리합니다</p>
        </div>

        {statusMessage && (
          <div className={`flex-shrink-0 px-4 py-3 rounded-lg text-sm ${
            applyStatus === "error" || syncStatus === "error"
              ? "bg-error/10 text-error-light border border-error/20"
              : "bg-primary/10 text-emerald-400 border border-primary/20"
          }`}>
            {statusMessage}
          </div>
        )}

        <div className="flex-shrink-0 flex items-center gap-3 flex-wrap">
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
          <button
            onClick={handleAddFolder}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-surface-hover text-content border border-edge hover:bg-zinc-700 transition-colors"
            title={currentPath ? `${currentPath}/ 하위에 추가` : "루트에 추가"}
          >
            + 폴더 추가
            {currentPath && (
              <span className="text-xs text-primary">→ {currentPath}/</span>
            )}
          </button>
          {hasSelection && (
            <button
              onClick={handleDeleteSelected}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-error/10 text-error-light border border-error/20 hover:bg-error/20 transition-colors"
            >
              선택 삭제 ({selectionCounts.folders > 0 && `폴더 ${selectionCounts.folders}`}
              {selectionCounts.folders > 0 && selectionCounts.files > 0 && ", "}
              {selectionCounts.files > 0 && `파일 ${selectionCounts.files}`})
            </button>
          )}
          <button
            onClick={handleSyncClick}
            disabled={syncStatus === "syncing"}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600/20 text-blue-400 border border-blue-600/30 hover:bg-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {syncStatus === "syncing" ? "동기화 중..." : "에뮬레이터 동기화"}
          </button>
          <div className="flex-1" />
          <button
            onClick={handleApplyClick}
            disabled={!hasChanges || applyStatus === "applying"}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {applyStatus === "applying" ? "적용 중..." : "변경사항 적용"}
          </button>
        </div>

        {hasChanges && (
          <div className="flex-shrink-0 text-xs text-content-muted">
            대기 중: 삭제 {pendingDeletions.size}개, 추가 {pendingAdditions.length}개
          </div>
        )}

        {pendingDeletions.size > 0 && (
          <div className="flex-shrink-0 bg-surface-elevated border border-edge rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
              <span className="text-sm font-medium text-error-light">삭제 예정</span>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {[...pendingDeletions].map((path) => (
                <div key={path} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-error/10 text-error-light">
                  <span>{path}</span>
                  <button onClick={() => handleUndoDeletion(path)} className="text-primary text-xs hover:underline">
                    취소
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingAdditions.length > 0 && (
          <div className="flex-shrink-0 bg-surface-elevated border border-edge rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
              <span className="text-sm font-medium text-primary">추가 예정</span>
            </div>
            <div className="p-4 space-y-2">
              {pendingAdditions.map((folder, index) => {
                const displayPath = folder.targetPath
                  ? `${folder.targetPath}/${folder.name}`
                  : folder.name;
                return (
                  <div
                    key={`${folder.targetPath || "root"}-${folder.name}`}
                    className={`flex items-center justify-between p-3 rounded-lg bg-surface-hover ${
                      !folder.valid ? "border border-error" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-content">{displayPath}</span>
                      <span className="text-xs text-content-muted">{folder.files.length} 파일</span>
                      {!folder.valid && (
                        <span className="text-xs text-error-light">{folder.errorCount}개 오류</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveAddition(index)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-surface-elevated text-content border border-edge hover:bg-zinc-700 transition-colors"
                    >
                      제거
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 bg-surface-elevated border border-edge rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
            <span className="text-sm font-medium text-content-secondary">파일 시스템</span>
            {hasSelection && (
              <span className="text-xs text-primary">
                {selectionCounts.folders > 0 && `폴더 ${selectionCounts.folders}`}
                {selectionCounts.folders > 0 && selectionCounts.files > 0 && ", "}
                {selectionCounts.files > 0 && `파일 ${selectionCounts.files}`}
                {" 선택됨"}
              </span>
            )}
          </div>
          {loading ? (
            <div className="flex items-center justify-center p-6 text-content-muted">
              <div className="spinner mr-2" />
              로딩 중...
            </div>
          ) : filteredTree.length === 0 ? (
            <div className="text-center p-6 text-content-muted">폴더가 없습니다</div>
          ) : (
            <div className={`flex flex-1 min-h-0 ${isMobile ? "flex-col" : ""}`}>
              <div className={`${isMobile ? "h-48 border-b" : "w-72 border-r"} border-edge p-3 bg-surface/50 overflow-auto`}>
                <DirectoryTree
                  items={filteredTree}
                  selectedPath={currentPath}
                  onSelectPath={setCurrentPath}
                />
              </div>
              <div className="flex-1 overflow-auto">
                <FileList
                  items={filteredTree}
                  currentPath={currentPath}
                  selectedPaths={selectedPaths}
                  onSelectionChange={setSelectedPaths}
                  onDeleteFolder={handleDeleteFolder}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-elevated border border-edge rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-content mb-1">비밀번호 확인</h2>
            <p className="text-sm text-content-muted mb-4">변경사항을 적용하려면 관리자 비밀번호를 입력하세요</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              className="w-full px-3.5 py-2.5 bg-surface-hover border border-edge rounded-lg text-content text-sm outline-none focus:border-primary placeholder:text-content-muted"
              onKeyDown={(e) => e.key === "Enter" && handleApply()}
              autoFocus
            />
            {applyStatus === "error" && (
              <div className="mt-4 px-4 py-3 rounded-lg text-sm bg-error/10 text-error-light border border-error/20">
                {statusMessage}
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleCancelModal}
                disabled={applyStatus === "applying"}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-surface-hover text-content border border-edge hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleApply}
                disabled={!password || applyStatus === "applying"}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {applyStatus === "applying" ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    적용 중...
                  </span>
                ) : "적용"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSyncModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-elevated border border-edge rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-content mb-1">에뮬레이터 동기화</h2>
            <p className="text-sm text-content-muted mb-4">
              에뮬레이터에서 추가/수정된 파일을 서버에 동기화합니다.
              <br />
              <span className="text-amber-400">참고: 삭제는 반영되지 않습니다. 삭제는 관리 패널에서 하세요.</span>
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="관리자 비밀번호"
              className="w-full px-3.5 py-2.5 bg-surface-hover border border-edge rounded-lg text-content text-sm outline-none focus:border-primary placeholder:text-content-muted"
              onKeyDown={(e) => e.key === "Enter" && handleSync()}
              autoFocus
            />
            {syncStatus === "error" && (
              <div className="mt-4 px-4 py-3 rounded-lg text-sm bg-error/10 text-error-light border border-error/20">
                {statusMessage}
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleCancelSyncModal}
                disabled={syncStatus === "syncing"}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-surface-hover text-content border border-edge hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSync}
                disabled={!password || syncStatus === "syncing"}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {syncStatus === "syncing" ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    동기화 중...
                  </span>
                ) : "동기화"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
