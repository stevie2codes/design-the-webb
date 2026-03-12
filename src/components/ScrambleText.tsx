import { useEffect, useState } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*+~<>?";

interface ScrambleTextProps {
  text: string;
  delay?: number;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

export default function ScrambleText({
  text,
  delay = 0,
  speed = 60,
  className,
  onComplete,
}: ScrambleTextProps) {
  const [display, setDisplay] = useState(() =>
    text.replace(
      /[^ ]/g,
      () => CHARS[Math.floor(Math.random() * CHARS.length)]
    )
  );

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const timeout = setTimeout(() => {
      const start = Date.now();

      interval = setInterval(() => {
        const locked = Math.min(
          text.length,
          Math.floor((Date.now() - start) / speed)
        );

        if (locked >= text.length) {
          setDisplay(text);
          if (interval) clearInterval(interval);
          onComplete?.();
          return;
        }

        setDisplay(
          text
            .split("")
            .map((c, i) => {
              if (c === " ") return " ";
              if (i < locked) return c;
              return CHARS[Math.floor(Math.random() * CHARS.length)];
            })
            .join("")
        );
      }, 40);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [text, delay, speed]);

  return (
    <span className={className} aria-label={text}>
      {display}
    </span>
  );
}
