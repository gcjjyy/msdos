import { useState, useEffect, useRef } from "react";
import Navbar from "~/components/Navbar";
import FolderTree, { type FolderItem } from "~/components/FolderTree";
import { validateFolder } from "~/lib/validation";
import { useIsClient } from "~/lib/useIsClient";

export function meta() {
  return [
    { title: "관리 - MS-DOS Emulator" },
    { name: "description", content: "DOS 파일 시스템 관리" },
  ];
}

interface PendingFolder {
  name: string;
  files: File[];
  valid: boolean;
  errorCount: number;
}

type ApplyStatus = "idle" | "applying" | "success" | "error";

export default function AdminPage() {
  const isClient = useIsClient();
  const [tree, setTree] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set());
  const [pendingAdditions, setPendingAdditions] = useState<PendingFolder[]>([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [applyStatus, setApplyStatus] = useState<ApplyStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (isClient) fetchTree();
  }, [isClient]);

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

  const handleUndoDeletion = (path: string) => {
    setPendingDeletions((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  };

  const handleAddFolder = () => fileInputRef.current?.click();

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const firstPath = files[0].webkitRelativePath;
    const folderName = firstPath.split("/")[0];

    if (
      pendingAdditions.some((f) => f.name.toUpperCase() === folderName.toUpperCase()) ||
      tree.some((f) => f.name.toUpperCase() === folderName.toUpperCase())
    ) {
      alert(`폴더 "${folderName}"이(가) 이미 존재합니다.`);
      e.target.value = "";
      return;
    }

    const validation = validateFolder(folderName, files);
    setPendingAdditions((prev) => [
      ...prev,
      { name: folderName, files, valid: validation.valid, errorCount: validation.errors.length },
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
          formData.append(`file:${file.webkitRelativePath}`, file);
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

  if (!isClient) return null;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-content">파일 관리</h1>
            <p className="text-sm text-content-muted mt-1">DOS 파일 시스템을 관리합니다</p>
          </div>

          {statusMessage && (
            <div className={`px-4 py-3 rounded-lg text-sm ${
              applyStatus === "error"
                ? "bg-error/10 text-error-light border border-error/20"
                : "bg-primary/10 text-emerald-400 border border-primary/20"
            }`}>
              {statusMessage}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
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
            >
              + 폴더 추가
            </button>
            {hasSelection && (
              <button
                onClick={handleDeleteSelected}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-error/10 text-error-light border border-error/20 hover:bg-error/20 transition-colors"
              >
                선택 삭제 ({selectedPaths.size})
              </button>
            )}
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
            <div className="text-xs text-content-muted">
              대기 중: 삭제 {pendingDeletions.size}개, 추가 {pendingAdditions.length}개
            </div>
          )}

          {pendingDeletions.size > 0 && (
            <div className="bg-surface-elevated border border-edge rounded-xl overflow-hidden">
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
            <div className="bg-surface-elevated border border-edge rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
                <span className="text-sm font-medium text-primary">추가 예정</span>
              </div>
              <div className="p-4 space-y-2">
                {pendingAdditions.map((folder, index) => (
                  <div
                    key={folder.name}
                    className={`flex items-center justify-between p-3 rounded-lg bg-surface-hover ${
                      !folder.valid ? "border border-error" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span>📁</span>
                      <span className="font-medium text-content">{folder.name}</span>
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
                ))}
              </div>
            </div>
          )}

          <div className="bg-surface-elevated border border-edge rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
              <span className="text-sm font-medium text-content-secondary">파일 시스템</span>
              {hasSelection && <span className="text-xs text-primary">{selectedPaths.size}개 선택됨</span>}
            </div>
            <div className="p-4">
              {loading ? (
                <div className="flex items-center justify-center p-6 text-content-muted">
                  <div className="spinner mr-2" />
                  로딩 중...
                </div>
              ) : filteredTree.length === 0 ? (
                <div className="text-center p-6 text-content-muted">폴더가 없습니다</div>
              ) : (
                <FolderTree
                  items={filteredTree}
                  selectedPaths={selectedPaths}
                  onSelectionChange={setSelectedPaths}
                />
              )}
            </div>
          </div>
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
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-surface-hover text-content border border-edge hover:bg-zinc-700 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleApply}
                disabled={!password || applyStatus === "applying"}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {applyStatus === "applying" ? "적용 중..." : "적용"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
