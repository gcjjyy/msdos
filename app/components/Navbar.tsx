import type { ReactNode } from "react";

type Tab = "dosbox" | "admin";

interface NavbarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  rightContent?: ReactNode;
}

export default function Navbar({ activeTab, onTabChange, rightContent }: NavbarProps) {
  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: "dosbox", icon: "🖥️", label: "DOSBox" },
    { id: "admin", icon: "📂", label: "관리" },
  ];

  return (
    <nav className="flex items-center bg-surface-elevated border-b border-edge relative z-50">
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-primary text-content"
                : "border-transparent text-content-muted hover:text-content-secondary hover:bg-surface-hover"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      {rightContent && (
        <>
          <div className="flex-1" />
          <div className="px-4">
            {rightContent}
          </div>
        </>
      )}
    </nav>
  );
}
