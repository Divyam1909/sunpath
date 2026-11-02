import { STAGES } from "@/domain/project";

const WIDTH = 320;
const HEIGHT = 136;
const RX = 148;
const RY = 112;
const CX = WIDTH / 2;
const BASE = 122;

function pointAt(fraction: number) {
  const angle = Math.PI * (1 - fraction);
  return { x: CX + RX * Math.cos(angle), y: BASE - RY * Math.sin(angle) };
}

/** The project as a sun crossing the sky: sunrise at the advance, sunset at the subsidy credit. */
export function SunArc({ stageIndex, label }: { stageIndex: number; label: string }) {
  const last = STAGES.length - 1;
  const fraction = stageIndex / last;
  const start = pointAt(0);
  const end = pointAt(1);
  const sun = pointAt(fraction);
  const fullArc = `M ${start.x} ${start.y} A ${RX} ${RY} 0 0 1 ${end.x} ${end.y}`;
  const doneArc = `M ${start.x} ${start.y} A ${RX} ${RY} 0 0 1 ${sun.x} ${sun.y}`;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} className="w-full">
      <line x1="0" x2={WIDTH} y1={BASE} y2={BASE} stroke="var(--border)" />
      <path d={fullArc} fill="none" stroke="var(--border)" strokeWidth="2" />
      {stageIndex > 0 ? (
        <path d={doneArc} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" pathLength={1} className="sun-arc-draw" />
      ) : null}
      {STAGES.map((stage, i) => {
        const p = pointAt(i / last);
        return <circle key={stage} cx={p.x} cy={p.y} r="2.5" fill={i <= stageIndex ? "var(--primary)" : "var(--input)"} />;
      })}
      <circle cx={sun.x} cy={sun.y} r="9" fill="var(--primary)" stroke="var(--background)" strokeWidth="3" />
    </svg>
  );
}
