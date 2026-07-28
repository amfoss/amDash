/*
 * The dot glyph set. Shape is category; pigment only reinforces it.
 *
 * The Shape-First Rule (DESIGN.md): every category must be legible with all
 * pigment removed. That is not a preference — the product's two real scenes are
 * a projected room with the lights down and colorblind readers, and a
 * distinction carried by hue alone breaks in both. Each glyph below differs
 * from every other in silhouette, not just fill.
 */
import type { Category } from "../lib/types";

interface Props {
  category: Category;
  r: number;
  stroke: string;
  /** Stroke width; the dot is drawn at hairline weight like everything else. */
  w?: number;
}

export default function DotGlyph({ category, r, stroke, w = 1 }: Props) {
  const common = { stroke, strokeWidth: w, vectorEffect: "non-scaling-stroke" as const };
  const filled = { fill: stroke, ...common };
  const hollow = { fill: "none", ...common };

  switch (category) {
    // Filled circle — the club's own sanctioned work, the heaviest mark.
    case "club-project":
      return <circle r={r} {...filled} />;

    // Diamond — events.
    case "event":
      return <path d={`M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`} {...filled} />;

    // Upward triangle — open source, aimed outward and upward.
    case "open-source":
      return (
        <path
          d={`M 0 ${-r} L ${r * 0.92} ${r * 0.6} L ${-r * 0.92} ${r * 0.6} Z`}
          {...hollow}
        />
      );

    // Hollow ring — competitive programming.
    case "competitive-programming":
      return <circle r={r} {...hollow} />;

    // Half-filled circle — hackathons: a burst, half spent.
    case "hackathon":
      return (
        <g>
          <circle r={r} {...hollow} />
          <path d={`M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} Z`} fill={stroke} stroke="none" />
        </g>
      );

    // Dotted ring — personal projects: present, self-directed, not sanctioned.
    case "personal-project":
      return <circle r={r} strokeDasharray="2 2.5" {...hollow} />;

    // Open cross — learning.
    case "learning":
      return (
        <path d={`M ${-r} 0 L ${r} 0 M 0 ${-r} L 0 ${r}`} {...hollow} />
      );

    // Small square — academic work.
    case "academic":
      return (
        <rect
          x={-r * 0.78}
          y={-r * 0.78}
          width={r * 1.56}
          height={r * 1.56}
          {...hollow}
        />
      );

    // Horizontal bar — non-technical work.
    case "non-technical":
      return (
        <path d={`M ${-r} 0 L ${r} 0`} {...hollow} strokeWidth={Math.max(w, 2)} />
      );

    // Tiny dot — other. Deliberately the smallest silhouette.
    default:
      return <circle r={Math.max(2, r * 0.4)} {...filled} />;
  }
}
