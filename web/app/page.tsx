/*
 * DIRECTION CONTRACT — hawk-eye field. Audited by the finishing review.
 *
 * THESIS: The club's work is a floor drawing redrawn each dawn from its own
 * mail. Refuses the dashboard-of-cards arrangement and its stat tiles, because a
 * tile implies a number worth comparing and this surface must not rank people.
 *
 * OWN-WORLD: Chalky rice-flour hairlines on damp laterite (#14100E), never
 * blue-black; four festival pigments (kaavi, turmeric, indigo, palm) identify
 * category behind a distinct glyph silhouette. Depth is the opacity ladder
 * 1.0/0.55/0.12 — no shadow, glow, or radius above 2px anywhere.
 *
 * STORY: The visitor sees what the club is working on now, believes it because
 * every mark opens the email that produced it, and lifts one thread out of the
 * field to read one member's territory.
 *
 * FIRST VIEWPORT: Hairline toolbar (mark, window, plate toggle) above a
 * full-bleed pannable drawing; visible dot armature, dots sized by count,
 * threads at Ghost. Roster rail right, 300px, names + cadence strips. Day
 * scrubber along the bottom. No primary button — selection is the action.
 *
 * FORM: Kolam field, first on the ordered list, staged as one continuous
 * armature rather than per-category panels. Seed key 08718f0c; chosen over the
 * roll's botanical-plate assignment because the user pinned the inspiration.
 */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import DotGlyph from "./components/DotGlyph";
import Plate from "./components/Plate";
import Fan from "./components/Fan";
import {
  CATEGORY_ORDER,
  CATEGORY_PIGMENT,
  FIELD_H,
  FIELD_W,
  armature,
  dotRadius,
  layoutDots,
  regionLabels,
  threadPaths,
  webSpokes,
  type Placed,
} from "./lib/geometry";
import type { FieldPayload, MetaPayload } from "./lib/types";
import styles from "./page.module.css";

const API = process.env.NEXT_PUBLIC_API ?? "http://localhost:5000";

/**
 * The API base. `?api=` overrides it, which is how the empty and sparse states
 * — the common case on 8 days of data, not an edge case — get exercised against
 * a throwaway database without a second dev server.
 */
function apiBase(): string {
  if (typeof window === "undefined") return API;
  return new URLSearchParams(window.location.search).get("api") ?? API;
}

/*
 * Below 640px the plate is the primary surface: a 20-thread drawing on a phone
 * is illegible and pretending otherwise fails the task. Subscribed rather than
 * read in an effect so it stays correct across a resize and does not desync
 * during hydration.
 */
const NARROW = "(max-width: 640px)";

function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function useIsNarrow(): boolean {
  return useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW).matches,
    () => false, // server render assumes the wide case; the field is the default
  );
}

/** Selection is one of three things, or nothing. Never two at once. */
type Selection =
  | { kind: "member"; id: number }
  | { kind: "dot"; key: string }
  | null;

export default function HawkEye() {
  const [field, setField] = useState<FieldPayload | null>(null);
  const [meta, setMeta] = useState<MetaPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Selection>(null);
  // null = follow the viewport; a boolean is the user overriding it.
  const [plateOverride, setPlateOverride] = useState<boolean | null>(null);
  const [fanKey, setFanKey] = useState<string | null>(null);
  const [dayCut, setDayCut] = useState<number | null>(null);
  // Only consulted below 1024px, where the rail is a drawer.
  const [railOpen, setRailOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Resolved once, on the client, during the first render.
  const [api] = useState(apiBase);

  useEffect(() => {
    const base = api;
    let live = true;
    (async () => {
      try {
        const [f, m] = await Promise.all([
          fetch(`${base}/api/field`).then((r) => {
            if (!r.ok) throw new Error(`field: ${r.status}`);
            return r.json();
          }),
          fetch(`${base}/api/meta`).then((r) => {
            if (!r.ok) throw new Error(`meta: ${r.status}`);
            return r.json();
          }),
        ]);
        if (!live) return;
        setField(f);
        setMeta(m);
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [api]);

  const narrow = useIsNarrow();
  const plate = plateOverride ?? narrow;

  const seats = useMemo(() => {
    if (!field) return new Map<string, Placed>();
    return new Map(layoutDots(field.dots).map((d) => [d.key, d]));
  }, [field]);

  const placed = useMemo(() => [...seats.values()], [seats]);
  // The scale's ceiling stays the full window's busiest dot, so scrubbing
  // shrinks dots rather than renormalising and making a quiet day look busy.
  const maxDotCount = useMemo(
    () => placed.reduce((m, d) => Math.max(m, d.count), 1),
    [placed],
  );
  const grid = useMemo(() => armature(), []);
  const regions = useMemo(() => regionLabels(), []);

  /** The visible window, narrowed by the scrubber if the user has scrubbed. */
  const days = useMemo(() => {
    if (!field) return [];
    return dayCut === null ? field.window.days : field.window.days.slice(0, dayCut + 1);
  }, [field, dayCut]);

  const threads = useMemo(() => {
    if (!field) return [];
    const inWindow = new Set(days);
    return field.members
      .map((m) => {
        const stops = (field.threads[String(m.id)] ?? []).filter((s) =>
          inWindow.has(s.date),
        );
        if (!stops.length) return null;
        return {
          member: m,
          stops,
          paths: threadPaths(stops, seats, m, days),
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
  }, [field, seats, days]);

  /** Dot counts recomputed for the scrubbed window, so sizes stay honest. */
  const liveCounts = useMemo(() => {
    if (!field) return null;
    if (dayCut === null) return null;
    const inWindow = new Set(days);
    const counts = new Map<string, number>();
    for (const c of field.contributions) {
      if (inWindow.has(c.date)) counts.set(c.dot, (counts.get(c.dot) ?? 0) + 1);
    }
    return counts;
  }, [field, days, dayCut]);

  const selectedMember = sel?.kind === "member" ? sel.id : null;
  const selectedDot = sel?.kind === "dot" ? sel.key : null;

  /** Members touching the selected dot — the radial web's spokes. */
  const webMembers = useMemo(() => {
    if (!selectedDot) return [];
    return seats.get(selectedDot)?.member_ids ?? [];
  }, [selectedDot, seats]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !field) return null;
    return {
      members: new Set(
        field.members.filter((m) => m.name.toLowerCase().includes(q)).map((m) => m.id),
      ),
      dots: new Set(placed.filter((d) => d.label.includes(q)).map((d) => d.key)),
    };
  }, [query, field, placed]);

  const onKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setSel(null);
      setFanKey(null);
    }
  }, []);

  if (error) {
    return (
      <main className={styles.shell}>
        <div className={styles.centered}>
          <h1 className="t-headline">The field can&apos;t be drawn</h1>
          <p className={styles.muted}>
            The API at <span className="t-data">{api}</span> did not answer:{" "}
            <span className="t-data">{error}</span>
          </p>
          <p className={styles.muted}>
            The drawing is derived; the mail underneath is untouched. Start the API and
            reload.
          </p>
        </div>
      </main>
    );
  }

  if (!field || !meta) {
    // The armature draws first and threads arrive after — no spinner over the
    // field, because the grid is real structure and a spinner is not.
    return (
      <main className={styles.shell}>
        <Armature grid={grid} regions={regions} />
        <p className={`${styles.loadingNote} t-data`}>drawing the armature…</p>
      </main>
    );
  }

  const anyWork = field.contributions.length > 0;

  return (
    <div
      className={`${styles.shell} ${plate ? styles.shellPlate : ""}`}
      onKeyDown={onKey}
    >
      <a href="#plate" className="skip-link">
        Skip to the text plate
      </a>

      <header className={styles.toolbar}>
        <h1 className={styles.mark}>
          amFOSS <span className={styles.markThin}>· amDash</span>
        </h1>

        <p className={`${styles.window} t-data`}>
          {field.window.from} → {days[days.length - 1] ?? field.window.to}
        </p>

        <label className={styles.search}>
          <span className="visually-hidden">Search members and work</span>
          <input
            type="search"
            value={query}
            placeholder="find a name or a project"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        {!plate && (
          <button
            type="button"
            className={styles.railToggle}
            onClick={() => setRailOpen((o) => !o)}
            aria-expanded={railOpen}
            aria-controls="roster"
          >
            Roster
          </button>
        )}

        <button
          type="button"
          className={styles.toggle}
          onClick={() => setPlateOverride(!plate)}
          aria-pressed={plate}
        >
          {plate ? "Field" : "Plate"}
        </button>
      </header>

      {plate ? (
        <div className={styles.plateWrap}>
          <Plate
            field={field}
            meta={meta}
            seats={seats}
            onPickMember={(id) => setSel({ kind: "member", id })}
            onPickDot={(key) => {
              setSel({ kind: "dot", key });
              setFanKey(key);
            }}
            api={api}
          />
          {fanKey && (
            <Fan
              key={fanKey}
              dotKey={fanKey}
              dot={seats.get(fanKey)}
              api={api}
              onClose={() => setFanKey(null)}
            />
          )}
        </div>
      ) : (
        <section className={styles.fieldWrap} aria-label="The field">
          <svg
            className={styles.field}
            viewBox={`0 0 ${FIELD_W} ${FIELD_H}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`${placed.length} pieces of work touched by ${threads.length} members between ${field.window.from} and ${field.window.to}. The text plate carries the same facts.`}
          >
            <ArmatureLayer grid={grid} regions={regions} />

            {/* Threads under dots: the line loops around a dot, so the dot
                must read as sitting on top of it. */}
            <g>
              {threads.map(({ member, paths }) => {
                const lifted = selectedMember === member.id;
                const inWeb = selectedDot !== null && webMembers.includes(member.id);
                const hit = matches?.members.has(member.id) ?? false;
                // The Three-Lift Rule: Lifted is reserved for what the user
                // actually selected. A search match — of which a one-letter
                // query produces dozens — resolves to Present, which is enough
                // to separate it from the ghost layer without flooding the
                // field with bright marks and making the lift meaningless.
                const op = lifted
                  ? "var(--op-lifted)"
                  : hit || inWeb
                    ? "var(--op-present)"
                    : selectedMember !== null || selectedDot !== null || matches
                      ? "var(--op-ghost)"
                      : "var(--op-present)";
                return (
                  <g
                    key={member.id}
                    className={styles.thread}
                    style={{ opacity: op }}
                    onMouseEnter={() => !sel && setSel({ kind: "member", id: member.id })}
                  >
                    {paths.map((d, i) => (
                      <path
                        key={i}
                        d={d}
                        fill="none"
                        stroke="var(--rice-flour)"
                        strokeWidth={lifted ? "var(--hair-lifted)" : 1}
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </g>
                );
              })}
            </g>

            {/* The radial web: every thread touching the selected dot pulls
                into a burst. Shared-dot adjacency, not co-mention — only 2 of
                66 rows name a collaborator, so co-mention cannot carry it. */}
            {selectedDot && seats.get(selectedDot) && (
              <g className={styles.web}>
                {webSpokes(seats.get(selectedDot)!, webMembers).map((s) => (
                  <line
                    key={s.memberId}
                    x1={s.x1}
                    y1={s.y1}
                    x2={s.x2}
                    y2={s.y2}
                    stroke="var(--rice-flour)"
                    strokeWidth={1}
                    opacity={0.55}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </g>
            )}

            {/* Dots */}
            <g>
              {placed.map((d) => {
                // When scrubbed, a dot absent from the narrowed window counts
                // zero and leaves the drawing. Falling back to the full count
                // here would strand dots on the field for work that has not
                // happened yet at the scrubbed date.
                const count = liveCounts ? (liveCounts.get(d.key) ?? 0) : d.count;
                if (count === 0) return null;
                // Diameter tracks the count actually on screen, on the same
                // bounded scale, so a scrubbed dot shrinks instead of lying.
                const radius =
                  count === d.count ? d.r : dotRadius(count, maxDotCount);
                const isSel = selectedDot === d.key;
                const onSelThread =
                  selectedMember !== null &&
                  (field.threads[String(selectedMember)] ?? []).some(
                    (s) => s.dot === d.key,
                  );
                const hit = matches?.dots.has(d.key) ?? false;
                // The Three-Lift Rule. Only the dot actually chosen is Lifted.
                // Search hits and the dots along a selected member's thread —
                // both of which can run to a dozen — sit at Present: raised out
                // of the ghost layer, but not competing with the one mark the
                // user pointed at. Mirrors the roster branch above.
                const op = isSel
                  ? "var(--op-lifted)"
                  : hit || onSelThread
                    ? "var(--op-present)"
                    : selectedMember !== null || selectedDot !== null || matches
                      ? "var(--op-ghost)"
                      : "var(--op-present)";

                return (
                  <g
                    key={d.key}
                    transform={`translate(${d.x} ${d.y})`}
                    style={{ opacity: op }}
                    className={styles.dot}
                    tabIndex={0}
                    role="button"
                    aria-label={`${d.label}, ${count} contribution${count === 1 ? "" : "s"}, ${d.member_ids.length} member${d.member_ids.length === 1 ? "" : "s"}`}
                    onClick={() => {
                      setSel({ kind: "dot", key: d.key });
                      setFanKey(d.key);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSel({ kind: "dot", key: d.key });
                        setFanKey(d.key);
                      }
                    }}
                  >
                    {/* Hit target. Most glyphs are hollow (fill: none), so
                        without this only their 1px stroke is clickable — a
                        hairline ring is not a pointer target, and the minimum
                        stays comfortable for the smallest dots. */}
                    <circle
                      r={Math.max(d.r + 6, 14)}
                      fill="transparent"
                      stroke="none"
                    />
                    <DotGlyph
                      category={d.category}
                      r={radius}
                      stroke={CATEGORY_PIGMENT[d.category]}
                      w={isSel ? 1.75 : 1}
                    />
                    {/* Slug rendered exactly as stored, lowercase. An
                        unattached dot's label is its category, which the region
                        heading already states — it reads as "unattached" here
                        so the mark says what it is rather than repeating the
                        region. */}
                    <text
                      className={styles.dotLabel}
                      y={d.r + 14}
                      textAnchor="middle"
                      fill="var(--rice-flour)"
                    >
                      {d.kind === "unattached" ? "unattached" : d.label}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Smudges: emails that failed extraction, in the kolam's own
                vocabulary for a mark that went wrong. */}
            <g>
              {field.smudges.map((s, i) => {
                const x = 60 + ((i * 97) % (FIELD_W - 120));
                const y = FIELD_H - 40;
                return (
                  <g key={s.id} opacity={0.55}>
                    <path
                      d={`M ${x} ${y} l 14 -6`}
                      stroke="var(--kaavi)"
                      strokeWidth={1.75}
                      vectorEffect="non-scaling-stroke"
                    />
                    <path
                      d={`M ${x + 3} ${y + 4} l 14 -6`}
                      stroke="var(--kaavi)"
                      strokeWidth={1.75}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })}
            </g>
          </svg>

          {!anyWork && (
            <div className={styles.emptyTeach}>
              <h2 className="t-title">The armature is drawn; nothing is on it yet</h2>
              <p className={styles.muted}>
                Dots appear for each project and event the club mentions. One thread
                per member loops through the dots they touched. Both are extracted from
                the daily update mail at 06:00 — nothing here is entered by hand.
              </p>
            </div>
          )}

          <Scrubber
            days={field.window.days}
            cut={dayCut}
            runs={meta.pipeline_runs}
            onCut={setDayCut}
          />

          {/* The fan sits on the drawing, inside the field region, so it never
              covers the roster rail. */}
          {fanKey && (
            <Fan
              key={fanKey}
              dotKey={fanKey}
              dot={seats.get(fanKey)}
              api={api}
              onClose={() => setFanKey(null)}
            />
          )}
        </section>
      )}

      {!plate && (
        <Roster
          field={field}
          open={railOpen}
          selectedMember={selectedMember}
          query={query}
          onPick={(id) =>
            setSel((s) =>
              s?.kind === "member" && s.id === id ? null : { kind: "member", id },
            )
          }
        />
      )}

      <footer className={styles.consent}>
        <p>
          Your daily update mail is parsed by an automated pipeline and the extracted
          work is surfaced here to every club member. The mail itself is never edited —
          every mark on this page opens the message it came from.
        </p>
      </footer>
    </div>
  );
}

/* ── the armature ─────────────────────────────────────────────────────────── */

function ArmatureLayer({
  grid,
  regions,
}: {
  grid: { x: number; y: number }[];
  regions: ReturnType<typeof regionLabels>;
}) {
  return (
    <g aria-hidden="true">
      {grid.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={1.1} fill="var(--faint-pulli)" />
      ))}
      {regions.map((r) => (
        <text
          key={r.category}
          x={r.x}
          y={r.y}
          fill="var(--faint-pulli)"
          fontSize={13}
          letterSpacing="0.08em"
          style={{ textTransform: "uppercase" }}
        >
          {r.category}
        </text>
      ))}
    </g>
  );
}

/** Standalone armature for the loading state. */
function Armature({
  grid,
  regions,
}: {
  grid: { x: number; y: number }[];
  regions: ReturnType<typeof regionLabels>;
}) {
  return (
    <svg
      className={styles.field}
      viewBox={`0 0 ${FIELD_W} ${FIELD_H}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <ArmatureLayer grid={grid} regions={regions} />
    </svg>
  );
}

/* ── roster rail ──────────────────────────────────────────────────────────── */

function Roster({
  field,
  open,
  selectedMember,
  query,
  onPick,
}: {
  field: FieldPayload;
  open: boolean;
  selectedMember: number | null;
  query: string;
  onPick: (id: number) => void;
}) {
  const q = query.trim().toLowerCase();
  // Alphabetical, always. Never by contribution count: the roster is a way in
  // to a named person, not a ranking, and sorting it by volume would build the
  // leaderboard the whole product refuses.
  const rows = field.members.filter((m) => !q || m.name.toLowerCase().includes(q));

  return (
    <aside
      id="roster"
      className={`${styles.rail} ${open ? styles.railOpen : ""}`}
      aria-label="Roster"
    >
      <h2 className="t-label">Roster · {field.members.length}</h2>
      <p className={`${styles.railNote}`}>
        Cadence strips show whether someone <em>wrote</em> an update, not whether they
        worked.
      </p>
      <ul className={styles.rosterList}>
        {rows.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className={`${styles.rosterRow} ${
                selectedMember === m.id ? styles.rosterRowOn : ""
              }`}
              onClick={() => onPick(m.id)}
              aria-pressed={selectedMember === m.id}
            >
              <span className={styles.rosterName}>{m.name}</span>
              <span className={styles.cadence} aria-hidden="true">
                {m.cadence.map((on, i) => (
                  <i key={i} className={on ? styles.cadOn : styles.cadOff} />
                ))}
              </span>
              <span className="visually-hidden">
                reported on {m.reported_days.length} of {m.cadence.length} days in this
                window
              </span>
              {m.contribution_count === 0 && (
                <span className={`${styles.silent} t-label`}>silent</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <h2 className="t-label">Legend</h2>
      <ul className={styles.legend}>
        {CATEGORY_ORDER.map((c) => (
          <li key={c}>
            <svg width={22} height={22} viewBox="-11 -11 22 22" aria-hidden="true">
              <DotGlyph category={c} r={7} stroke={CATEGORY_PIGMENT[c]} />
            </svg>
            <span>{c}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/* ── day scrubber ─────────────────────────────────────────────────────────── */

function Scrubber({
  days,
  cut,
  runs,
  onCut,
}: {
  days: string[];
  cut: number | null;
  runs: MetaPayload["pipeline_runs"];
  onCut: (n: number | null) => void;
}) {
  const failed = new Set(
    runs.filter((r) => r.status === "error").map((r) => r.run_date),
  );
  const ran = new Set(runs.map((r) => r.run_date));

  // A single-day window has nothing to scrub. The control is disabled rather
  // than hidden, so the surface doesn't appear to lose a feature.
  const scrubbable = days.length > 1;

  return (
    <div className={styles.scrubber}>
      <label className={`${styles.scrubLabel} t-label`} htmlFor="scrub">
        Window
      </label>
      <input
        id="scrub"
        type="range"
        min={0}
        max={Math.max(1, days.length - 1)}
        value={cut ?? Math.max(1, days.length - 1)}
        disabled={!scrubbable}
        aria-label={`Show work up to a day within ${days[0] ?? ""} to ${days[days.length - 1] ?? ""}`}
        onChange={(e) => {
          const v = Number(e.target.value);
          onCut(v === days.length - 1 ? null : v);
        }}
        className={styles.scrubRange}
      />
      <ol className={styles.scrubDays} aria-hidden="true">
        {days.map((d, i) => (
          <li
            key={d}
            className={[
              styles.scrubDay,
              cut !== null && i > cut ? styles.scrubDayOut : "",
              failed.has(d) ? styles.scrubDayFailed : "",
              !ran.has(d) ? styles.scrubDayNoRun : "",
            ].join(" ")}
            title={
              failed.has(d)
                ? `${d} — pipeline run failed`
                : ran.has(d)
                  ? d
                  : `${d} — no recorded pipeline run`
            }
          />
        ))}
      </ol>
      <p className={`${styles.scrubEnd} t-data`}>{days[cut ?? days.length - 1]}</p>
    </div>
  );
}
