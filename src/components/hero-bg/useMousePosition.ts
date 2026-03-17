import { useEffect } from "react";
import { useMotionValue, useSpring, type MotionValue } from "framer-motion";

interface MousePosition {
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  smoothMouseX: MotionValue<number>;
  smoothMouseY: MotionValue<number>;
}

/**
 * Tracks mouse position as MotionValues with spring smoothing.
 * Returns normalized coordinates (0–1) relative to viewport.
 * Skips entirely on touch devices.
 */
export function useMousePosition(
  springConfig = { stiffness: 80, damping: 20, mass: 1.5 }
): MousePosition {
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
    if (isTouchDevice) return;

    function onMouseMove(e: MouseEvent) {
      mouseX.set(e.clientX / window.innerWidth);
      mouseY.set(e.clientY / window.innerHeight);
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, [mouseX, mouseY]);

  return { mouseX, mouseY, smoothMouseX, smoothMouseY };
}
