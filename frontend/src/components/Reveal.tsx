import type { CSSProperties, ElementType, ReactNode } from "react";
import { useInView } from "../lib/motion";

type Direction = "up" | "left" | "right" | "zoom" | "fade";

interface RevealProps {
  children: ReactNode;
  /** Which way the element travels in from. */
  from?: Direction;
  /** Stagger in milliseconds — use the item index to cascade a grid. */
  delay?: number;
  className?: string;
  style?: CSSProperties;
  /** Render as something other than a div (e.g. "section", "li"). */
  as?: ElementType;
}

/**
 * Fades/slides its children in the first time they scroll into view.
 * The transition itself lives in index.css (`.reveal` / `.is-visible`), so
 * prefers-reduced-motion neutralises it without any JS branch here.
 */
export function Reveal({
  children,
  from = "up",
  delay = 0,
  className = "",
  style,
  as: Tag = "div",
}: RevealProps) {
  const { ref, inView } = useInView<HTMLElement>();

  return (
    <Tag
      ref={ref}
      className={`reveal reveal-${from} ${inView ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms`, ...style }}
    >
      {children}
    </Tag>
  );
}
