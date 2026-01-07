import type { FolderItem } from "./FolderTree";

interface DirectoryTreeProps {
  items: FolderItem[];
  selectedPath: string | null;
  onSelectPath: (path: string | null) => void;
  basePath?: string;
  parentLines?: boolean[];
}

export default function DirectoryTree({
  items,
  selectedPath,
  onSelectPath,
  basePath = "",
  parentLines = [],
}: DirectoryTreeProps) {
  const folders = items.filter((item) => item.type === "folder");

  return (
    <div className="font-mono text-sm leading-tight">
      {basePath === "" && (
        <div
          className="flex items-center cursor-pointer"
          onClick={() => onSelectPath(null)}
        >
          <span
            className={`px-1 transition-colors ${
              selectedPath === null
                ? "bg-primary/20 text-primary font-medium"
                : "hover:bg-surface-hover text-content-secondary"
            }`}
          >
            /
          </span>
        </div>
      )}
      {folders.map((item, index) => {
        const itemPath = basePath ? `${basePath}/${item.name}` : item.name;
        const isSelected = selectedPath === itemPath;
        const hasChildren = item.children?.some((c) => c.type === "folder");
        const isLast = index === folders.length - 1;

        return (
          <div key={item.name}>
            <div
              className="flex items-center cursor-pointer whitespace-nowrap"
              onClick={() => onSelectPath(itemPath)}
            >
              <span className="text-content-muted select-none whitespace-pre">
                {" "}
                {parentLines.map((showLine, i) => (
                  <span key={i}>{showLine ? "│   " : "    "}</span>
                ))}
                {isLast ? "└───" : "├───"}
              </span>
              <span
                className={`transition-colors ${
                  isSelected
                    ? "bg-primary/20 text-primary font-medium"
                    : "hover:bg-surface-hover text-content-secondary"
                }`}
              >
                {item.name}
              </span>
            </div>
            {hasChildren && item.children && (
              <DirectoryTree
                items={item.children}
                selectedPath={selectedPath}
                onSelectPath={onSelectPath}
                basePath={itemPath}
                parentLines={[...parentLines, !isLast]}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
