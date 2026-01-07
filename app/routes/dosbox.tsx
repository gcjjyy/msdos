import { useState } from "react";
import DosEmulator from "~/components/DosEmulator";
import Navbar from "~/components/Navbar";
import CanvasSizeSelector from "~/components/CanvasSizeSelector";
import AdminPanel from "~/components/AdminPanel";
import { useCanvasSize } from "~/lib/useCanvasSize";
import { useIsClient } from "~/lib/useIsClient";

export function meta() {
  return [
    { title: "DOSBox - MS-DOS Emulator" },
    { name: "description", content: "브라우저 기반 MS-DOS 에뮬레이터" },
  ];
}

const SIZE_MAP: Record<string, { width: number; height: number }> = {
  "640x480": { width: 640, height: 480 },
  "800x600": { width: 800, height: 600 },
  "1024x768": { width: 1024, height: 768 },
};

type Tab = "dosbox" | "admin";

export default function DosboxPage() {
  const { size, setSize, isClient } = useCanvasSize();
  const isClientReady = useIsClient();
  const [activeTab, setActiveTab] = useState<Tab>("dosbox");
  const isFullscreen = size === "fullscreen";
  const dimensions = SIZE_MAP[size];

  if (!isClientReady) return null;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        rightContent={
          activeTab === "dosbox" && isClient && (
            <CanvasSizeSelector size={size} onChange={setSize} />
          )
        }
      />

      {/* DOSBox Tab - always mounted, hidden when not active */}
      <div className={`flex-1 flex flex-col overflow-hidden ${activeTab !== "dosbox" ? "hidden" : ""}`}>
        <div className="flex-1 bg-surface">
          <DosEmulator
            bundleUrl="/bundle.jsdos"
            canvasWidth={isFullscreen ? undefined : dimensions?.width}
            canvasHeight={isFullscreen ? undefined : dimensions?.height}
          />
        </div>
      </div>

      {/* Admin Tab - always mounted, hidden when not active */}
      <div className={`flex-1 flex flex-col overflow-hidden ${activeTab !== "admin" ? "hidden" : ""}`}>
        <AdminPanel />
      </div>
    </div>
  );
}
