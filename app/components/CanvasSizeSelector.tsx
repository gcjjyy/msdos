import type { CanvasSize } from "~/lib/useCanvasSize";

interface CanvasSizeSelectorProps {
  size: CanvasSize;
  onChange: (size: CanvasSize) => void;
}

const SIZE_OPTIONS: { value: CanvasSize; label: string }[] = [
  { value: "640x480", label: "640×480" },
  { value: "800x600", label: "800×600" },
  { value: "1024x768", label: "1024×768" },
  { value: "fullscreen", label: "전체 화면" },
];

export default function CanvasSizeSelector({ size, onChange }: CanvasSizeSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-content-muted">화면 크기</span>
      <select
        value={size}
        onChange={(e) => onChange(e.target.value as CanvasSize)}
        className="px-3 py-2 bg-surface-hover border border-edge rounded-lg text-sm text-content cursor-pointer outline-none focus:border-primary"
      >
        {SIZE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
