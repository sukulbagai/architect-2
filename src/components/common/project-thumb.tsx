import { cn } from "@/lib/utils";
import { seededRandom } from "@/lib/seeded";
import type { ThumbLayout } from "@/lib/templates";

const LAYOUTS: ThumbLayout[] = ["sidebar", "landing", "chat", "dashboard"];

/**
 * A generated wireframe of an app, drawn like a blueprint sketch. Until a project has a real
 * screenshot, this gives every card a distinct, recognisable face. Templates pass the layout
 * that matches what they build; everything else is derived from the seed.
 */
export function ProjectThumb({ seed, layout, className }: { seed: string; layout?: ThumbLayout; className?: string }) {
  const rnd = seededRandom(seed);
  const pick = LAYOUTS[Math.floor(rnd() * LAYOUTS.length)];
  const kind = layout ?? pick;
  const box = "fill-card stroke-border-strong";
  const line = "fill-border-strong";
  const accent = "fill-brand/80";
  const between = (min: number, max: number) => min + rnd() * (max - min);
  const int = (min: number, max: number) => Math.floor(between(min, max + 1));

  const lines = (x: number, y: number, w: number, n: number) =>
    Array.from({ length: n }, (_, i) => (
      <rect key={i} x={x} y={y + i * 5} width={w * between(0.5, 1)} height={2} rx={1} className={line} />
    ));

  return (
    <svg
      viewBox="0 0 160 100"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
      className={cn("block h-full w-full bg-sunken", className)}
    >
      <defs>
        <pattern id={`g-${seed}`} width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M8 0H0V8" fill="none" className="stroke-border" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="160" height="100" fill={`url(#g-${seed})`} />
      <g strokeWidth="0.75">
        <rect x="14" y="12" width="132" height="80" rx="4" className={box} />
        <rect x="14" y="12" width="132" height="9" rx="4" className="fill-muted stroke-border-strong" />
        <circle cx="20" cy="16.5" r="1.4" className={line} />
        <circle cx="24.5" cy="16.5" r="1.4" className={line} />
        <circle cx="29" cy="16.5" r="1.4" className={line} />

        {kind === "sidebar" && drawSidebar()}
        {kind === "landing" && drawLanding()}
        {kind === "chat" && drawChat()}
        {kind === "dashboard" && drawDashboard()}
      </g>
    </svg>
  );

  function drawSidebar() {
    const cards = int(2, 3);
    const accentIndex = int(0, cards - 1);
    const cardW = (89 - (cards - 1) * 4) / cards;
    return (
      <>
        <rect x="14" y="21" width="30" height="71" className="fill-muted/60 stroke-border-strong" />
        <rect x="18" y={25 + int(0, 3) * 7} width="22" height="5" rx="1.5" className="fill-brand/20" />
        {lines(19, 26, 20, 7)}
        {Array.from({ length: cards }, (_, i) => (
          <rect key={i} x={50 + i * (cardW + 4)} y="27" width={cardW} height="20" rx="2" className={i === accentIndex ? accent : box} />
        ))}
        <rect x="50" y="53" width="89" height="32" rx="2" className={box} />
        {lines(55, 58, 70, int(3, 5))}
      </>
    );
  }

  function drawLanding() {
    const cards = int(2, 4);
    const cardW = (116 - (cards - 1) * 4) / cards;
    const headW = between(52, 84);
    return (
      <>
        <rect x={80 - headW / 2 + 8} y="29" width={headW - 16} height="2" rx="1" className={line} />
        <rect x={80 - headW / 2} y="35" width={headW} height="4.5" rx="2" className="fill-foreground/70" />
        <rect x={80 - between(12, 18)} y="45" width={between(24, 36)} height="7" rx="3.5" className={accent} />
        {Array.from({ length: cards }, (_, i) => (
          <rect key={i} x={22 + i * (cardW + 4)} y="60" width={cardW} height="25" rx="2" className={box} />
        ))}
      </>
    );
  }

  function drawChat() {
    const bubbles = int(3, 4);
    let y = 27;
    const items = Array.from({ length: bubbles }, (_, i) => {
      const mine = i % 2 === 1;
      const h = int(8, 13);
      const w = between(46, 84);
      const el = (
        <rect
          key={i}
          x={mine ? 138 - w : 22}
          y={y}
          width={w}
          height={h}
          rx="4"
          className={mine ? "fill-brand/15 stroke-brand/40" : "fill-muted stroke-border-strong"}
        />
      );
      y += h + 4;
      return el;
    });
    return (
      <>
        {items}
        <rect x="22" y="80" width="116" height="7" rx="3.5" className={box} />
        <circle cx="133" cy="83.5" r="2" className={accent} />
      </>
    );
  }

  function drawDashboard() {
    const tiles = int(3, 4);
    const tileW = (119 - (tiles - 1) * 4) / tiles;
    const split = between(56, 84);
    return (
      <>
        {Array.from({ length: tiles }, (_, i) => (
          <rect key={i} x={20 + i * (tileW + 4)} y="27" width={tileW} height="14" rx="2" className={box} />
        ))}
        <rect x="20" y="46" width={split} height="40" rx="2" className={box} />
        {rnd() > 0.5 ? (
          <polyline
            points={Array.from({ length: 7 }, (_, i) => `${25 + i * ((split - 10) / 6)},${78 - rnd() * 24}`).join(" ")}
            fill="none"
            className="stroke-brand"
            strokeWidth="1.25"
          />
        ) : (
          Array.from({ length: 6 }, (_, i) => {
            const h = between(6, 30);
            return (
              <rect
                key={i}
                x={26 + i * ((split - 12) / 6)}
                y={82 - h}
                width={(split - 12) / 6 - 3}
                height={h}
                rx="1"
                className={i === 3 ? accent : "fill-border-strong"}
              />
            );
          })
        )}
        <rect x={24 + split} y="46" width={115 - split} height="40" rx="2" className={box} />
        {lines(28 + split, 52, 107 - split, 6)}
      </>
    );
  }
}
