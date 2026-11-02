const ARCS = [
  { rx: 1180, ry: 830 },
  { rx: 950, ry: 660 },
  { rx: 730, ry: 500 },
  { rx: 520, ry: 350 },
];
const HORIZON = 900;

/** Behind every public page: the paths the sun takes across the sky, rising from a warm horizon. */
export function SunPathBackdrop() {
  return (
    <div aria-hidden className="sun-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMaxYMid slice" className="size-full">
        {ARCS.map(({ rx, ry }) => (
          <path key={rx} d={`M ${720 - rx} ${HORIZON} A ${rx} ${ry} 0 0 1 ${720 + rx} ${HORIZON}`} fill="none" stroke="var(--primary)" strokeOpacity="0.1" />
        ))}
        <g className="hidden lg:block">
          <circle cx="1310" cy="181" r="20" fill="var(--sun)" fillOpacity="0.4" />
          <circle cx="1310" cy="181" r="44" fill="var(--sun)" fillOpacity="0.1" />
        </g>
      </svg>
      {/* On a narrow screen the arc runs behind the text, so the sun moves to the corner. */}
      <div className="absolute -top-14 -right-14 grid size-32 place-items-center rounded-full bg-sun/10 lg:hidden">
        <div className="size-14 rounded-full bg-sun/40" />
      </div>
    </div>
  );
}
