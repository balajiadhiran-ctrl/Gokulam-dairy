import { useCountUp, useInView } from "../lib/motion";

/** Splits "4,000+" into { prefix: "", number: 4000, suffix: "+" }. */
function parse(value: string) {
  const match = value.match(/^(\D*)([\d,.]+)(.*)$/);
  if (!match) return null;
  const digits = Number(match[2].replace(/,/g, ""));
  if (!Number.isFinite(digits)) return null;
  return { prefix: match[1], number: digits, suffix: match[3], grouped: match[2].includes(",") };
}

/**
 * Animates a stat value up from zero the first time it scrolls into view.
 * Values it cannot parse (or when motion is reduced) render unchanged.
 */
export function CountUp({ value, className = "" }: { value: string; className?: string }) {
  const parsed = parse(value);
  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.4 });
  const current = useCountUp(parsed?.number ?? 0, inView);

  if (!parsed) return <span className={className}>{value}</span>;

  const shown = parsed.grouped ? current.toLocaleString("en-IN") : String(current);

  return (
    <span ref={ref} className={className}>
      {parsed.prefix}
      {shown}
      {parsed.suffix}
    </span>
  );
}
