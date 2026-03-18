import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "../lib/gsap-init";
import { useSplitText } from "../lib/useSplitText";
import { useReducedMotion } from "../lib/useReducedMotion";
import { useIsMobile } from "../lib/useIsMobile";

interface ScrollScrubTextProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Word-by-word scroll-scrubbed opacity animation.
 * Each word starts at opacity: 0.15 and progressively illuminates
 * to opacity: 1 as the user scrolls.
 */
export default function ScrollScrubText({
  children,
  className,
}: ScrollScrubTextProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const { split } = useSplitText(textRef, { type: "words" });
  const reduced = useReducedMotion();
  const { isMobile } = useIsMobile();

  useGSAP(
    () => {
      const el = textRef.current;
      if (!el || reduced) return;

      // On mobile: skip word-by-word scrub entirely (saves a ScrollTrigger).
      // The text is fully visible by default, so no animation needed.
      if (isMobile) return;

      const result = split();
      if (!result || result.words.length === 0) return;

      // Set initial dim state
      gsap.set(result.words, { opacity: 0.5 });

      const isSmall = window.innerWidth < 768;

      gsap.to(result.words, {
        opacity: 1,
        stagger: 0.1,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          end: isSmall ? "top 40%" : "top 35%",
          scrub: 0.5,
        },
      });
    },
    { scope: textRef, dependencies: [reduced, isMobile] }
  );

  return (
    <div ref={textRef} className={className}>
      {children}
    </div>
  );
}
