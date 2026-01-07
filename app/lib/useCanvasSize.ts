import { useState, useEffect } from "react";

export type CanvasSize = "640x480" | "800x600" | "1024x768" | "fullscreen";

const STORAGE_KEY = "dosbox-canvas-size";
const DEFAULT_SIZE: CanvasSize = "640x480";

export function useCanvasSize() {
  const [size, setSize] = useState<CanvasSize>(DEFAULT_SIZE);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const stored = localStorage.getItem(STORAGE_KEY) as CanvasSize | null;
    if (stored && isValidSize(stored)) {
      setSize(stored);
    }
  }, []);

  const updateSize = (newSize: CanvasSize) => {
    setSize(newSize);
    if (isClient) {
      localStorage.setItem(STORAGE_KEY, newSize);
    }
  };

  return { size, setSize: updateSize, isClient };
}

function isValidSize(size: string): size is CanvasSize {
  return ["640x480", "800x600", "1024x768", "fullscreen"].includes(size);
}
