/**
 * The farm's emblem — the Gokulam medallion, cut out to a transparent circle
 * so it sits on any background.
 *
 * Two files back it: a 128px version for the sizes we actually render at, and
 * the 512px original for anywhere it appears large. `size` picks between them,
 * so a navbar logo never downloads half a megabyte.
 */
export function Logo({
  size = 32,
  className = "",
  decorative = true,
}: {
  /** Rendered width and height in pixels. */
  size?: number;
  className?: string;
  /** Hidden from screen readers when the farm name sits beside it. */
  decorative?: boolean;
}) {
  const src = size > 128 ? "/images/gokulam-emblem.png" : "/images/gokulam-emblem-sm.png";

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={decorative ? "" : "Gokulam Dairy Farm"}
      aria-hidden={decorative || undefined}
      loading="eager"
      decoding="async"
      className={`shrink-0 select-none object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
