interface ComitLogoProps {
  size?: number;
  color?: string;
  className?: string;
}

/**
 * Comit symbol mark
 * Latin "Comes" (accusative): companion, guide — one who walks beside you
 *
 * An open arc (300°, gap on the right) with a guide dot inside the gap.
 * The arc never closes — always making space for the companion.
 */
export function ComitLogo({ size = 24, color = "currentColor", className }: ComitLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      {/* Open arc: 300° clockwise, gap on the right (30° → 330°) */}
      <path
        d="M 38.72 32.50 A 17 17 0 1 1 38.72 15.50"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Guide dot: sits inside the gap */}
      <circle cx="35" cy="24" r="3" fill={color} />
    </svg>
  );
}
