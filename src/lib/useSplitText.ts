import { useRef, useCallback, type RefObject } from "react";

interface SplitTextResult {
  chars: HTMLElement[];
  words: HTMLElement[];
  revert: () => void;
}

/**
 * Custom SplitText hook — wraps characters/words in <span> elements
 * for GSAP to animate. Walks childNodes recursively to preserve
 * inline elements like <span className="text-orange">.
 */
export function useSplitText(
  ref: RefObject<HTMLElement | null>,
  options: { type: "chars" | "words" | "both" } = { type: "chars" }
): { split: () => SplitTextResult | null } {
  const originalClone = useRef<Node | null>(null);

  const split = useCallback(() => {
    const el = ref.current;
    if (!el) return null;

    // Deep clone original DOM for revert
    originalClone.current = el.cloneNode(true);

    const chars: HTMLElement[] = [];
    const words: HTMLElement[] = [];

    function processNode(node: Node): void {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        if (!text.trim()) return;

        const fragment = document.createDocumentFragment();
        const textWords = text.split(/(\s+)/);

        textWords.forEach((segment) => {
          if (/^\s+$/.test(segment)) {
            fragment.appendChild(document.createTextNode(segment));
            return;
          }

          if (options.type === "words") {
            const wordSpan = document.createElement("span");
            wordSpan.style.display = "inline-block";
            wordSpan.textContent = segment;
            words.push(wordSpan);
            fragment.appendChild(wordSpan);
          } else {
            // chars or both
            const wordSpan = document.createElement("span");
            wordSpan.style.display = "inline-block";

            segment.split("").forEach((char) => {
              const charSpan = document.createElement("span");
              charSpan.style.display = "inline-block";
              charSpan.textContent = char;
              chars.push(charSpan);
              wordSpan.appendChild(charSpan);
            });

            words.push(wordSpan);
            fragment.appendChild(wordSpan);
          }
        });

        node.parentNode?.replaceChild(fragment, node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Process children of element nodes (preserves styled spans)
        const childNodes = Array.from(node.childNodes);
        childNodes.forEach(processNode);
      }
    }

    const childNodes = Array.from(el.childNodes);
    childNodes.forEach(processNode);

    return {
      chars,
      words,
      revert: () => {
        if (el && originalClone.current) {
          // Restore original DOM by replacing all children
          while (el.firstChild) {
            el.removeChild(el.firstChild);
          }
          const clone = originalClone.current as HTMLElement;
          while (clone.firstChild) {
            el.appendChild(clone.firstChild);
          }
        }
      },
    };
  }, [ref, options.type]);

  return { split };
}
