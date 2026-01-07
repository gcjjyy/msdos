import { useEffect, useRef, useState } from "react";
import { useIsClient } from "~/lib/useIsClient";

declare global {
  interface Window {
    Dos: (
      element: HTMLElement,
      options?: Record<string, unknown>
    ) => { run: (bundleUrl: string) => Promise<unknown> };
    emulators: {
      pathPrefix: string;
    };
  }
}

interface DosEmulatorProps {
  bundleUrl: string;
  width?: number;
  height?: number;
  fullscreen?: boolean;
}

export default function DosEmulator({
  bundleUrl,
  width = 640,
  height = 480,
  fullscreen = false,
}: DosEmulatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const isClient = useIsClient();

  useEffect(() => {
    if (!isClient) return;
    const container = containerRef.current;
    if (!container) return;

    if (
      typeof window.Dos === "undefined" ||
      typeof window.emulators === "undefined"
    ) {
      setStatus("error");
      setErrorMsg("js-dos 라이브러리가 로드되지 않았습니다.");
      return;
    }

    window.emulators.pathPrefix = "/js-dos/";

    const initEmulator = async () => {
      try {
        await window.Dos(container, {}).run(bundleUrl);
        setStatus("ready");
      } catch (err) {
        console.error("Failed to initialize DOS emulator:", err);
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "에뮬레이터 로드 실패");
      }
    };

    initEmulator();

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [bundleUrl, isClient]);

  if (!isClient) return null;

  const style = fullscreen
    ? { width: "100%", height: "100%" }
    : { width: `${width}px`, height: `${height}px` };

  if (status === "error") {
    return (
      <div style={style} className="flex items-center justify-center bg-surface-elevated">
        <p className="text-error-light p-6">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div style={style} className="bg-black">
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
