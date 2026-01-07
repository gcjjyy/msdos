import { useState } from "react";

export interface FolderItem {
  name: string;
  type: "folder" | "file";
  children?: FolderItem[];
}

interface FolderTreeProps {
  items: FolderItem[];
  selectedPaths: Set<string>;
  onSelectionChange: (paths: Set<string>) => void;
  basePath?: string;
}

function getAllDescendantPaths(item: FolderItem, basePath: string): string[] {
  const paths: string[] = [];
  const itemPath = basePath ? `${basePath}/${item.name}` : item.name;
  paths.push(itemPath);
  if (item.type === "folder" && item.children) {
    for (const child of item.children) {
      paths.push(...getAllDescendantPaths(child, itemPath));
    }
  }
  return paths;
}

function hasSelectedAncestor(path: string, selectedPaths: Set<string>): boolean {
  const parts = path.split("/");
  for (let i = 1; i < parts.length; i++) {
    const ancestorPath = parts.slice(0, i).join("/");
    if (selectedPaths.has(ancestorPath)) return true;
  }
  return false;
}

export default function FolderTree({
  items,
  selectedPaths,
  onSelectionChange,
  basePath = "",
}: FolderTreeProps) {
  const toggleSelection = (path: string, item: FolderItem) => {
    if (hasSelectedAncestor(path, selectedPaths)) return;

    const next = new Set(selectedPaths);
    const itemPath = basePath ? `${basePath}/${item.name}` : item.name;
    const descendantPaths =
      item.type === "folder" && item.children
        ? item.children.flatMap((child) => getAllDescendantPaths(child, itemPath))
        : [];

    if (next.has(path)) {
      next.delete(path);
      for (const p of descendantPaths) next.delete(p);
    } else {
      next.add(path);
      for (const p of descendantPaths) next.add(p);
    }
    onSelectionChange(next);
  };

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <FolderTreeItem
          key={item.name}
          item={item}
          selectedPaths={selectedPaths}
          onToggle={(path) => toggleSelection(path, item)}
          onSelectionChange={onSelectionChange}
          path={basePath ? `${basePath}/${item.name}` : item.name}
          basePath={basePath}
        />
      ))}
    </div>
  );
}

interface FolderTreeItemProps {
  item: FolderItem;
  selectedPaths: Set<string>;
  onToggle: (path: string) => void;
  onSelectionChange: (paths: Set<string>) => void;
  path: string;
  basePath: string;
}

function FolderTreeItem({
  item,
  selectedPaths,
  onToggle,
  onSelectionChange,
  path,
  basePath,
}: FolderTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isSelected = selectedPaths.has(path);
  const isLockedByParent = hasSelectedAncestor(path, selectedPaths);
  const hasChildren = item.type === "folder" && item.children && item.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors
          ${isSelected ? "bg-primary/10 outline outline-1 outline-primary/30" : "hover:bg-surface-hover"}
          ${isLockedByParent ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={() => !isLockedByParent && onToggle(path)}
      >
        <span
          className="w-5 h-5 flex items-center justify-center text-content-muted text-[10px]"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setIsExpanded(!isExpanded);
          }}
        >
          {hasChildren ? (isExpanded ? "▼" : "▶") : ""}
        </span>
        <input
          type="checkbox"
          className="w-4 h-4 accent-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          checked={isSelected || isLockedByParent}
          disabled={isLockedByParent}
          onChange={() => !isLockedByParent && onToggle(path)}
          onClick={(e) => e.stopPropagation()}
        />
        <span className="text-base">{item.type === "folder" ? "📁" : "📄"}</span>
        <span className={`flex-1 text-sm ${isSelected ? "text-content" : "text-content-secondary"}`}>
          {item.name}
        </span>
      </div>
      {hasChildren && isExpanded && (
        <div className="ml-5 pl-3 border-l border-edge">
          <FolderTree
            items={item.children!}
            selectedPaths={selectedPaths}
            onSelectionChange={onSelectionChange}
            basePath={path}
          />
        </div>
      )}
    </div>
  );
}
