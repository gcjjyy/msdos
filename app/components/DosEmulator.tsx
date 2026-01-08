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
  canvasWidth?: number;
  canvasHeight?: number;
}

// DOS 부팅 메시지
const BOOT_MESSAGES = [
  { text: "BIOS ROM checksum OK", delay: 0 },
  { text: "Detecting hardware...", delay: 200 },
  { text: "CPU: 80486DX @ 66MHz", delay: 400, highlight: true },
  { text: "Memory: 16384 KB OK", delay: 600, ok: true },
  { text: "Initializing disk controller...", delay: 800 },
  { text: "C: drive mounted", delay: 1000, ok: true },
  { text: "Loading MS-DOS...", delay: 1200, highlight: true },
  { text: "HIMEM.SYS loaded", delay: 1500 },
  { text: "EMM386.EXE loaded", delay: 1700 },
  { text: "Starting emulator...", delay: 2000, highlight: true },
];

function BootScreen({ progress, fadeOut }: { progress: number; fadeOut: boolean }) {
  const [visibleLines, setVisibleLines] = useState<number>(0);

  useEffect(() => {
    // progress에 따라 표시할 라인 수 계산
    const targetLines = Math.floor((progress / 100) * BOOT_MESSAGES.length);

    if (targetLines > visibleLines) {
      const timer = setTimeout(() => {
        setVisibleLines(targetLines);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [progress, visibleLines]);

  return (
    <div className={`dos-boot-screen ${fadeOut ? "fade-out" : ""}`}>
      <div className="dos-boot-box">
        <div className="dos-boot-messages">
          {BOOT_MESSAGES.slice(0, visibleLines).map((msg, idx) => (
            <div
              key={idx}
              className={`dos-boot-line ${msg.ok ? "ok" : ""} ${msg.highlight ? "highlight" : ""}`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {msg.ok ? "[OK] " : ""}{msg.text}
            </div>
          ))}
        </div>

        <div className="dos-progress-container">
          <div className="dos-progress-label">
            <span>Loading system files...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="dos-progress-bar">
            <div
              className="dos-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DosEmulator({
  bundleUrl,
  canvasWidth,
  canvasHeight,
}: DosEmulatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
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

    // 시뮬레이션된 progress (실제 로딩과 동기화)
    let progressInterval: ReturnType<typeof setInterval>;
    let currentProgress = 0;

    const simulateProgress = () => {
      progressInterval = setInterval(() => {
        // 90%까지만 자동 진행, 나머지는 실제 로딩 완료 시
        if (currentProgress < 90) {
          currentProgress += Math.random() * 8 + 2;
          if (currentProgress > 90) currentProgress = 90;
          setProgress(currentProgress);
        }
      }, 200);
    };

    const initEmulator = async () => {
      try {
        simulateProgress();
        await window.Dos(container, {}).run(bundleUrl);

        // 로딩 완료 시 100%로 설정 후 페이드아웃
        clearInterval(progressInterval);
        setProgress(100);

        setTimeout(() => {
          setFadeOut(true);
          setTimeout(() => {
            setStatus("ready");
          }, 500);
        }, 300);
      } catch (err) {
        clearInterval(progressInterval);
        console.error("Failed to initialize DOS emulator:", err);
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "에뮬레이터 로드 실패");
      }
    };

    initEmulator();

    return () => {
      clearInterval(progressInterval);
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [bundleUrl, isClient]);

  if (!isClient) return null;

  if (status === "error") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-elevated">
        <p className="text-error-light p-6">{errorMsg}</p>
      </div>
    );
  }

  // CSS 변수로 캔버스 크기 전달
  const cssVars = canvasWidth && canvasHeight
    ? { "--dos-canvas-width": `${canvasWidth}px`, "--dos-canvas-height": `${canvasHeight}px` } as React.CSSProperties
    : undefined;

  return (
    <div
      className={`w-full h-full bg-black dos-emulator-wrapper ${canvasWidth ? "dos-fixed-canvas" : ""}`}
      style={cssVars}
    >
      <div ref={containerRef} className="w-full h-full" />
      {status === "loading" && (
        <BootScreen progress={progress} fadeOut={fadeOut} />
      )}
    </div>
  );
}
