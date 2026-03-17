import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "../lib/gsap-init";
import { useSplitText } from "../lib/useSplitText";
import { useReducedMotion } from "../lib/useReducedMotion";

interface GSAPTextRevealProps {
  children: React.ReactNode;
  className?: string;
  clipMask?: boolean;
  staggerSpeed?: number;
  delay?: number;
}

/**
 * Cinematic heading reveal with character split + stagger.
 * Each char: translateY(30px) + opacity: 0 → revealed with power3.out.
 * Optional clip-path mask for "unmasking from bottom" effect.
 */
export default function GSAPTextReveal({
  children,
  className,
  clipMask = false,
  staggerSpeed = 0.02,
  delay = 0,
}: GSAPTextRevealProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const { split } = useSplitText(textRef, { type: "chars" });
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      const el = textRef.current;
      if (!el || reduced) return;

      const result = split();
      if (!result || result.chars.length === 0) return;

      if (clipMask) {
        el.style.clipPath = "inset(0 0 100% 0)";
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: "top 80%",
          once: true,
        },
        delay,
      });

      if (clipMask) {
        tl.to(el, {
          clipPath: "inset(0 0 0% 0)",
          duration: 0.5,
          ease: "power2.out",
        }, 0);
      }

      tl.from(
        result.chars,
        {
          y: 30,
          opacity: 0,
          duration: 0.5,
          stagger: staggerSpeed,
          ease: "power3.out",
        },
        clipMask ? 0 : 0
      );
    },
    { scope: textRef, dependencies: [reduced] }
  );

  return (
    <div ref={textRef} className={className}>
      {children}
    </div>
  );
}
