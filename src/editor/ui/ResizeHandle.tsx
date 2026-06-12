import { useRef, useState, type PointerEvent } from "react";
import type { SplitDirection, SplitId } from "../store/workspaceStore";

type ResizeHandleProps = {
  splitId: SplitId;
  direction: SplitDirection;
  onResizeEnd: (splitId: SplitId, ratio: number) => void;
};

function clampRatioForSize(ratio: number, size: number): number {
  if (size <= 0) {
    return 0.5;
  }
  const minByPixels = Math.min(0.5, 280 / size);
  const min = Math.max(0.15, minByPixels);
  const max = Math.min(0.85, 1 - minByPixels);
  if (min > max) {
    return 0.5;
  }
  return Math.min(max, Math.max(min, ratio));
}

export function ResizeHandle({
  splitId,
  direction,
  onResizeEnd,
}: ResizeHandleProps) {
  const [resizing, setResizing] = useState(false);
  const pendingRatioRef = useRef<number | null>(null);

  const ratioFromPointer = (event: PointerEvent<HTMLDivElement>): number => {
    const container = event.currentTarget.parentElement;
    if (!container) {
      return 0.5;
    }
    const rect = container.getBoundingClientRect();
    if (direction === "horizontal") {
      return clampRatioForSize((event.clientX - rect.left) / rect.width, rect.width);
    }
    return clampRatioForSize((event.clientY - rect.top) / rect.height, rect.height);
  };

  return (
    <div
      className={resizing ? "split-handle is-resizing" : "split-handle"}
      role="separator"
      aria-orientation={direction === "horizontal" ? "vertical" : "horizontal"}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        pendingRatioRef.current = ratioFromPointer(event);
        setResizing(true);
      }}
      onPointerMove={(event) => {
        if (!resizing) {
          return;
        }
        pendingRatioRef.current = ratioFromPointer(event);
      }}
      onPointerUp={(event) => {
        if (!resizing) {
          return;
        }
        event.currentTarget.releasePointerCapture(event.pointerId);
        setResizing(false);
        onResizeEnd(splitId, pendingRatioRef.current ?? ratioFromPointer(event));
        pendingRatioRef.current = null;
      }}
      onPointerCancel={(event) => {
        if (resizing) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        pendingRatioRef.current = null;
        setResizing(false);
      }}
    />
  );
}
