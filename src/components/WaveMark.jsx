import React, { useId } from 'react';

// Brand mark: three waves in currentColor, so each surface picks the theme colour.
export function WaveMark({ className = '', title }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : 'true'}
    >
      {title && <title>{title}</title>}
      <path d="M2.5 8.5c1.9-2.4 3.8-2.4 5.7 0s3.8 2.4 5.7 0 3.8-2.4 5.7 0" opacity="0.45" />
      <path d="M2.5 13c1.9-2.4 3.8-2.4 5.7 0s3.8 2.4 5.7 0 3.8-2.4 5.7 0" opacity="0.75" />
      <path d="M2.5 17.5c1.9-2.4 3.8-2.4 5.7 0s3.8 2.4 5.7 0 3.8-2.4 5.7 0" />
    </svg>
  );
}

// One wave period is two humps (11.4 units), so a row drawn a period wider than
// the viewBox can slide by exactly that and loop without a seam.
const HUMP = 5.7;
const LOADER_WIDTH = 40;
const LOADER_HEIGHT = 18;

function flowingWave(y) {
  // Start a period to the left and run a period past the right edge, so the row
  // stays covered through the whole slide.
  let d = `M${-HUMP * 2} ${y}c1.9-2.4 3.8-2.4 ${HUMP} 0`;
  const humps = Math.ceil((LOADER_WIDTH + HUMP * 4) / HUMP);
  for (let hump = 1; hump < humps; hump += 1) {
    d += `s3.8 ${hump % 2 === 0 ? '-' : ''}2.4 ${HUMP} 0`;
  }
  return d;
}

const ROWS = [
  { y: 5.4, opacity: 0.4, duration: '2.4s' },
  { y: 9, opacity: 0.7, duration: '1.8s' },
  { y: 12.6, opacity: 1, duration: '1.4s' },
];

/**
 * The mark with its waves flowing — used while the app boots. Wide rather than
 * square, and masked so the strokes dissolve at both edges instead of being cut
 * off against an invisible box.
 */
export function WaveLoader({ className = '', label = 'Loading' }) {
  const maskId = useId();

  return (
    <svg
      viewBox={`0 0 ${LOADER_WIDTH} ${LOADER_HEIGHT}`}
      className={className}
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <defs>
        <linearGradient id={`${maskId}-fade`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.18" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.82" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${maskId}-mask`}>
          <rect
            width={LOADER_WIDTH}
            height={LOADER_HEIGHT}
            fill={`url(#${maskId}-fade)`}
          />
        </mask>
      </defs>
      <g mask={`url(#${maskId}-mask)`}>
        {ROWS.map((row) => (
          <path
            key={row.y}
            d={flowingWave(row.y)}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            opacity={row.opacity}
            className="wave-flow"
            style={{ animationDuration: row.duration }}
          />
        ))}
      </g>
    </svg>
  );
}
