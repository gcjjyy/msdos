import type { FolderItem } from "./FolderTree";

interface FileListProps {
  items: FolderItem[];
  currentPath: string | null;
  selectedPaths: Set<string>;
  onSelectionChange: (paths: Set<string>) => void;
  onDeleteFolder?: (path: string) => void;
}

export default function FileList({
  items,
  currentPath,
  selectedPaths,
  onSelectionChange,
  onDeleteFolder,
}: FileListProps) {
  const currentItems = getCurrentItems(items, currentPath);

  const toggleSelection = (itemName: string, item: FolderItem) => {
    const itemPath = currentPath ? `${currentPath}/${itemName}` : itemName;
    const next = new Set(selectedPaths);

    if (next.has(itemPath)) {
      next.delete(itemPath);
      if (item.type === "folder" && item.children) {
        removeDescendants(item.children, itemPath, next);
      }
    } else {
      next.add(itemPath);
      if (item.type === "folder" && item.children) {
        addDescendants(item.children, itemPath, next);
      }
    }
    onSelectionChange(next);
  };

  const toggleAll = () => {
    const allPaths = currentItems.map((item) =>
      currentPath ? `${currentPath}/${item.name}` : item.name
    );
    const allSelected = allPaths.every((p) => selectedPaths.has(p));

    const next = new Set(selectedPaths);
    if (allSelected) {
      for (const item of currentItems) {
        const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;
        next.delete(itemPath);
        if (item.type === "folder" && item.children) {
          removeDescendants(item.children, itemPath, next);
        }
      }
    } else {
      for (const item of currentItems) {
        const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;
        next.add(itemPath);
        if (item.type === "folder" && item.children) {
          addDescendants(item.children, itemPath, next);
        }
      }
    }
    onSelectionChange(next);
  };

  const allSelected =
    currentItems.length > 0 &&
    currentItems.every((item) => {
      const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;
      return selectedPaths.has(itemPath);
    });

  const someSelected = currentItems.some((item) => {
    const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;
    return selectedPaths.has(itemPath);
  });

  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-edge bg-surface-elevated/50 text-sm text-content-muted">
        <span className="font-mono">{currentPath ? `/${currentPath}` : "/"}</span>
        <span className="text-xs">({currentItems.length})</span>
        <div className="flex-1" />
        {currentPath && onDeleteFolder && (
          <button
            onClick={() => onDeleteFolder(currentPath)}
            className="px-2 py-1 text-xs rounded bg-error/10 text-error-light border border-error/20 hover:bg-error/20 transition-colors"
          >
            폴더 삭제
          </button>
        )}
      </div>

      {currentItems.length === 0 ? (
        <div className="p-6 text-center text-content-muted text-sm">
          빈 디렉토리
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated border-b border-edge">
            <tr className="text-left text-content-muted">
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary cursor-pointer"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-3 py-2 font-medium">이름</th>
              <th className="w-20 px-3 py-2 font-medium">유형</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((item) => {
              const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;
              const isSelected = selectedPaths.has(itemPath);

              return (
                <tr
                  key={item.name}
                  className={`border-b border-edge/50 cursor-pointer transition-colors
                    ${isSelected ? "bg-primary/10" : "hover:bg-surface-hover"}`}
                  onClick={() => toggleSelection(item.name, item)}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-primary cursor-pointer"
                      checked={isSelected}
                      onChange={() => toggleSelection(item.name, item)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-content-muted">{item.type === "folder" ? "[DIR]" : ""}</span>
                      <span className={isSelected ? "text-content" : "text-content-secondary"}>
                        {item.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-content-muted">
                    {item.type === "folder" ? "폴더" : "파일"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function getCurrentItems(items: FolderItem[], path: string | null): FolderItem[] {
  if (path === null) return items;

  const parts = path.split("/");
  let current = items;

  for (const part of parts) {
    const folder = current.find((item) => item.name === part && item.type === "folder");
    if (!folder || !folder.children) return [];
    current = folder.children;
  }

  return current;
}

function addDescendants(children: FolderItem[], basePath: string, paths: Set<string>) {
  for (const child of children) {
    const childPath = `${basePath}/${child.name}`;
    paths.add(childPath);
    if (child.type === "folder" && child.children) {
      addDescendants(child.children, childPath, paths);
    }
  }
}

function removeDescendants(children: FolderItem[], basePath: string, paths: Set<string>) {
  for (const child of children) {
    const childPath = `${basePath}/${child.name}`;
    paths.delete(childPath);
    if (child.type === "folder" && child.children) {
      removeDescendants(child.children, childPath, paths);
    }
  }
}
