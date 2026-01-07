import DosEmulator from "~/components/DosEmulator";
import Navbar from "~/components/Navbar";
import CanvasSizeSelector from "~/components/CanvasSizeSelector";
import { useCanvasSize } from "~/lib/useCanvasSize";

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

export default function DosboxPage() {
  const { size, setSize, isClient } = useCanvasSize();
  const isFullscreen = size === "fullscreen";
  const dimensions = SIZE_MAP[size];

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex items-center justify-between px-6 py-3 bg-surface-elevated border-b border-edge">
        <div className="text-sm text-content-muted">
          {isClient && <span>{size === "fullscreen" ? "전체 화면" : size}</span>}
        </div>
        {isClient && <CanvasSizeSelector size={size} onChange={setSize} />}
      </div>
      <div className={`flex-1 flex items-center justify-center bg-surface ${isFullscreen ? "" : "p-6"}`}>
        <div className={`overflow-hidden ${isFullscreen ? "w-full h-full" : "rounded-xl border border-edge"}`}>
          <DosEmulator
            bundleUrl="/bundle.jsdos"
            width={dimensions?.width}
            height={dimensions?.height}
            fullscreen={isFullscreen}
          />
        </div>
      </div>
    </div>
  );
}
