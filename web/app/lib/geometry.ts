/*
 * The kolam's geometry: where dots sit, and how a member's thread loops
 * through them.
 *
 * Everything here is pure and deterministic. DESIGN.md § Layout requires dot
 * position to derive from identity and category, never from render order or a
 * random seed, because a mark that wanders between sessions is a mark you
 * cannot learn. That is why there is no Math.random() in this file and why the
 * layout takes no input beyond the dots themselves.
 */
import type { Category, Dot, Member, ThreadStop } from "./types";

/** Field coordinate space. The SVG scales; the armature spacing does not. */
export const FIELD_W = 1600;
export const FIELD_H = 1000;
export const PULLI = 40; // armature spacing — the system's spatial unit

const COLS = FIELD_W / PULLI; // 40
const ROWS = FIELD_H / PULLI; // 25

/*
 * Category regions. Order is fixed and meaningful: the club's own sanctioned
 * work sits top-left where reading starts, outward-facing work along the top,
 * and personal/learning work below. Five region columns by two rows.
 */
export const CATEGORY_ORDER: Category[] = [
  "club-project",
  "event",
  "open-source",
  "competitive-programming",
  "hackathon",
  "personal-project",
  "learning",
  "academic",
  "non-technical",
  "other",
];

const REGION_COLS = 5;
const REGION_ROWS = 2;
const REGION_W = COLS / REGION_COLS; // 8 armature columns
const REGION_H = ROWS / REGION_ROWS; // 12.5 → floored per region below

/** Category → pigment token. Pigment reinforces; glyph shape carries meaning. */
export const CATEGORY_PIGMENT: Record<Category, string> = {
  "club-project": "var(--kaavi)",
  event: "var(--turmeric)",
  "open-source": "var(--indigo)",
  "competitive-programming": "var(--indigo)",
  hackathon: "var(--kaavi)",
  "personal-project": "var(--turmeric)",
  learning: "var(--palm)",
  academic: "var(--palm)",
  "non-technical": "var(--chalk-dust)",
  other: "var(--chalk-dust)",
};

/** FNV-1a. Any stable hash works; this one is short and has no dependencies. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Seat {
  x: number;
  y: number;
  r: number;
}

export type Placed = Dot & Seat;

/**
 * Bounded dot radius. Diameter encodes contribution count — the only quantity
 * the system draws, because it is the only one objectively countable
 * (DESIGN.md § Shapes). sqrt so a 15-row dot reads as bigger than a 1-row dot
 * without a 15× area lie, and clamped so nothing drops below legibility at
 * projection distance.
 */
export function dotRadius(count: number, maxCount: number): number {
  const MIN = 5;
  const MAX = 17;
  if (maxCount <= 1) return MIN;
  const t = Math.sqrt(count - 1) / Math.sqrt(maxCount - 1);
  return MIN + t * (MAX - MIN);
}

/**
 * Seat every dot on an armature intersection inside its category's region.
 *
 * Seat choice is hash(dot.key) with linear probing, so it depends only on the
 * dot's identity: the same dot lands on the same intersection tomorrow, and a
 * new dot appearing never displaces an existing one it does not collide with.
 * Dots are seated in key order for the same reason — probing must not depend
 * on payload order.
 */
export function layoutDots(dots: Dot[]): Placed[] {
  const maxCount = dots.reduce((m, d) => Math.max(m, d.count), 1);
  const taken = new Set<string>();
  const placed: Placed[] = [];

  for (const dot of [...dots].sort((a, b) => a.key.localeCompare(b.key))) {
    const ci = Math.max(0, CATEGORY_ORDER.indexOf(dot.category));
    const rx = (ci % REGION_COLS) * REGION_W;
    const ry = Math.floor(ci / REGION_COLS) * Math.floor(REGION_H);

    // Inset by one armature step: the outer ring stays empty so region labels
    // and dot labels have somewhere to sit without colliding with a mark.
    const usableW = REGION_W - 2;
    const usableH = Math.floor(REGION_H) - 3;
    const slots = usableW * usableH;

    const h = hash(dot.key);
    let col = 0;
    let row = 0;
    for (let probe = 0; probe < slots; probe++) {
      const idx = (h + probe * 7) % slots; // 7 is coprime with the slot counts
      col = rx + 1 + (idx % usableW);
      row = ry + 2 + Math.floor(idx / usableW);
      if (!taken.has(`${col},${row}`)) break;
    }
    taken.add(`${col},${row}`);

    placed.push({
      ...dot,
      x: col * PULLI,
      y: row * PULLI,
      r: dotRadius(dot.count, maxCount),
    });
  }
  return placed;
}

/** The empty armature: every intersection, drawn whether or not it is used. */
export function armature(): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let c = 1; c < COLS; c++) {
    for (let r = 1; r < ROWS; r++) {
      pts.push({ x: c * PULLI, y: r * PULLI });
    }
  }
  return pts;
}

/** Region label anchors, so the field reads as a considered drawing. */
export function regionLabels(): { category: Category; x: number; y: number }[] {
  return CATEGORY_ORDER.map((category, ci) => ({
    category,
    x: ((ci % REGION_COLS) * REGION_W + 1) * PULLI,
    y: (Math.floor(ci / REGION_COLS) * Math.floor(REGION_H) + 1) * PULLI,
  }));
}

type Pt = { x: number; y: number };

const norm = (a: Pt, b: Pt): Pt => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
};

/**
 * One member's thread, as SVG path strings.
 *
 * Returns one path per unbroken run. A day on which the member sent no report
 * breaks the line: that gap is cadence, and it measures reporting discipline,
 * not work (PRODUCT.md). Breaking the path is how the drawing says so without
 * a number attached to a person.
 *
 * At every dot the line arcs around the dot's perimeter and rejoins — it never
 * touches the centre. In sikku kolam the line loops around the pulli, and that
 * constraint is what produces the characteristic figure. (The free bezier
 * between two dots may still pass near a third dot's region; the invariant this
 * enforces is that a thread never crosses a dot it visits.)
 */
export function threadPaths(
  stops: ThreadStop[],
  seats: Map<string, Placed>,
  member: Member,
  days: string[],
): string[] {
  const reported = new Set(member.reported_days);

  // Group stops into runs, splitting where a day inside the window went
  // unreported. Consecutive stops on the same dot collapse: the thread already
  // loops there once, and a second loop on the spot would draw as a blot.
  const runs: Placed[][] = [];
  let run: Placed[] = [];
  let prevDate: string | null = null;

  for (const stop of stops) {
    const seat = seats.get(stop.dot);
    if (!seat) continue;

    if (prevDate && stop.date !== prevDate) {
      const from = days.indexOf(prevDate);
      const to = days.indexOf(stop.date);
      const silent =
        from >= 0 &&
        to > from &&
        days.slice(from + 1, to).some((d) => !reported.has(d));
      if (silent) {
        if (run.length) runs.push(run);
        run = [];
      }
    }
    if (run[run.length - 1]?.key !== seat.key) run.push(seat);
    prevDate = stop.date;
  }
  if (run.length) runs.push(run);

  return runs.map((r) => runPath(r, member.id)).filter(Boolean);
}

function runPath(dots: Placed[], memberId: number): string {
  // A run touching one dot draws as a closed loop around it: the member worked
  // there, and a zero-length line would render as nothing at all.
  if (dots.length === 1) {
    const d = dots[0];
    const rr = d.r + 5;
    return `M ${(d.x - rr).toFixed(1)} ${d.y.toFixed(1)} a ${rr} ${rr} 0 1 1 ${(rr * 2).toFixed(1)} 0 a ${rr} ${rr} 0 1 1 ${(-rr * 2).toFixed(1)} 0`;
  }

  const f = (n: number) => n.toFixed(1);

  // Per dot: the perimeter point the line arrives at, the one it leaves from,
  // and which way it rides around. Computed up front so the path emitter only
  // has to join consecutive arcs.
  const arcs = dots.map((d, i) => {
    const rr = d.r + 5; // clearance: the line rides outside the dot, not on it
    const inDir = norm(dots[i - 1] ?? dots[i + 1], d);
    const outDir = norm(d, dots[i + 1] ?? dots[i - 1]);
    return {
      rr,
      inDir,
      entry: { x: d.x - inDir.x * rr, y: d.y - inDir.y * rr },
      exit: { x: d.x + outDir.x * rr, y: d.y + outDir.y * rr },
      // Which way around the dot. Alternating by member and position gives a
      // sikku figure its handedness instead of a uniform swirl.
      sweep: (hash(`${memberId}:${d.key}`) + i) % 2,
    };
  });

  const parts = [`M ${f(arcs[0].entry.x)} ${f(arcs[0].entry.y)}`];
  arcs.forEach((a, i) => {
    if (i > 0) {
      // Join the previous dot's exit to this entry with a bow *perpendicular*
      // to the travel direction. Bowing along the travel vector would put the
      // control points colinear with the endpoints and draw a straight line —
      // a straight line between distant dots reads as a network diagram, which
      // is the one thing this drawing must not be.
      const from = arcs[i - 1].exit;
      const span = Math.hypot(a.entry.x - from.x, a.entry.y - from.y);
      const t = norm(from, a.entry);
      const perp = { x: -t.y, y: t.x };
      // Curvature is a fraction of the span, capped so a long traverse arcs
      // generously without ballooning off the field.
      const bow = Math.min(span * 0.28, 190) * (a.sweep ? 1 : -1);
      const c1 = {
        x: from.x + t.x * span * 0.25 + perp.x * bow,
        y: from.y + t.y * span * 0.25 + perp.y * bow,
      };
      const c2 = {
        x: a.entry.x - t.x * span * 0.25 + perp.x * bow,
        y: a.entry.y - t.y * span * 0.25 + perp.y * bow,
      };
      parts.push(
        `C ${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(a.entry.x)} ${f(a.entry.y)}`,
      );
    }
    // Ride around the perimeter from entry to exit. Never through the centre.
    parts.push(`A ${f(a.rr)} ${f(a.rr)} 0 0 ${a.sweep} ${f(a.exit.x)} ${f(a.exit.y)}`);
  });
  return parts.join(" ");
}

/**
 * The radial web: a dot's members pulled into a burst centred on it.
 *
 * Replaces the plan's co-mention collaboration graph, which the real data
 * cannot support — only 2 of 66 contributions name a collaborator. Shared-dot
 * adjacency is both real and richer: 9 members touched `workshop`.
 */
export function webSpokes(
  dot: Placed,
  memberIds: number[],
): { memberId: number; x1: number; y1: number; x2: number; y2: number }[] {
  const n = memberIds.length;
  const reach = 150;
  return memberIds.map((memberId, i) => {
    // Start from a fixed angle so the burst is stable, not render-order noise.
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return {
      memberId,
      x1: dot.x + Math.cos(a) * (dot.r + 6),
      y1: dot.y + Math.sin(a) * (dot.r + 6),
      x2: dot.x + Math.cos(a) * reach,
      y2: dot.y + Math.sin(a) * reach,
    };
  });
}
