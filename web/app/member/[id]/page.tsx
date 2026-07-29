"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { type Category, type Status } from "../../data/members";

// ── types ──────────────────────────────────────────────────────────────────────

interface EntitySummary {
  entityId: number;
  displayName: string;
  category: Category;
  contribCount: number;
  lastActive: string | null;
}

interface Contribution {
  id: number;
  date: string;
  category: Category;
  activity_text: string;
  event_role: string | null;
  confidence: number;
  email_id: number;
  entity_name: string | null;
  event_name: string | null;
}

interface MemberDetail {
  id: number;
  name: string;
  githubHandle: string | null;
  active: boolean;
  status: Status;
  lastUpdateDate: string | null;
  lastUpdateDaysAgo: number | null;
  activeDays: number;
  contribCount: number;
  entitySummaries: EntitySummary[];
  contributions: Contribution[];
}

// ── category config ────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<Category, { label: string; bg: string; text: string }> = {
  "club-project":            { label: "club-project",            bg: "#1E3A5F", text: "#93C5FD" },
  "open-source":             { label: "open-source",             bg: "#1A3A2A", text: "#86EFAC" },
  "learning":                { label: "learning",                bg: "#2D2A1A", text: "#FDE68A" },
  "competitive-programming": { label: "competitive-programming", bg: "#2A1A3A", text: "#C4B5FD" },
  "academic":                { label: "academic",                bg: "#2A2020", text: "#FCA5A5" },
  "hackathon":               { label: "hackathon",               bg: "#1A2A2A", text: "#67E8F9" },
  "event":                   { label: "event",                   bg: "#2A1F10", text: "#FCD34D" },
  "non-technical":           { label: "non-technical",           bg: "#252525", text: "#D1D5DB" },
  "other":                   { label: "other",                   bg: "#1E1E1E", text: "#6B7280" },
};

const CATEGORY_ORDER: Category[] = [
  "club-project",
  "open-source",
  "event",
  "hackathon",
  "non-technical",
  "learning",
  "competitive-programming",
  "academic",
  "other",
];

const STATUS_CONFIG: Record<Status, { color: string }> = {
  ACTIVE:   { color: "#4ADE80" },
  SILENT:   { color: "#F87171" },
  INACTIVE: { color: "#6B7A99" },
};

// ── helpers ────────────────────────────────────────────────────────────────────

function formatDaysAgo(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

// ── sub-components ─────────────────────────────────────────────────────────────

function StatusToken({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status];
  if (status === "INACTIVE") {
    return (
      <span
        style={{ color: cfg.color }}
        className="text-[11px] font-bold tracking-[0.06em] uppercase"
      >
        inactive
      </span>
    );
  }
  return (
    <span
      style={{
        color: cfg.color,
        border: `1px solid ${cfg.color}44`,
      }}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-bold tracking-[0.06em] uppercase"
    >
      <span
        style={{
          background: cfg.color,
          width: "5px",
          height: "5px",
          borderRadius: "1px",
          flexShrink: 0,
          display: "inline-block",
        }}
      />
      {status}
    </span>
  );
}

function CategoryChip({ category }: { category: Category }) {
  const cfg = CATEGORY_CONFIG[category] ?? { label: category, bg: "#1E1E1E", text: "#6B7280" };
  return (
    <span
      style={{
        background: cfg.bg,
        color: cfg.text,
        border: `1px solid ${cfg.text}22`,
      }}
      className="inline-flex items-center px-1.5 py-px rounded-sm text-[11px] tracking-[0.01em]"
    >
      {cfg.label}
    </span>
  );
}

function Skeleton({ w, h = "12px" }: { w: string; h?: string }) {
  return (
    <span
      className="skeleton block rounded-sm"
      style={{ width: w, height: h }}
    />
  );
}

// ── heatmap ────────────────────────────────────────────────────────────────────

function ActivityHeatmap({ contributions }: { contributions: Contribution[] }) {
  const activeDates = useMemo(() => {
    const s = new Set<string>();
    contributions.forEach((c) => s.add(c.date.slice(0, 10)));
    return s;
  }, [contributions]);

  const weeks = useMemo(() => {
    const today = new Date();
    const end = new Date(today);
    const start = new Date(today);
    start.setDate(start.getDate() - 363); // 52 weeks back
    // align start to Sunday
    start.setDate(start.getDate() - start.getDay());

    const result: Array<Array<{ date: string; active: boolean }>> = [];
    const cur = new Date(start);
    while (cur <= end) {
      const week: Array<{ date: string; active: boolean }> = [];
      for (let d = 0; d < 7; d++) {
        const iso = cur.toISOString().slice(0, 10);
        week.push({ date: iso, active: activeDates.has(iso) });
        cur.setDate(cur.getDate() + 1);
      }
      result.push(week);
    }
    return result;
  }, [activeDates]);

  const monthLabels = useMemo(() => {
    const labels: Array<{ label: string; colIndex: number }> = [];
    let lastMonth = -1;
    weeks.forEach((week, i) => {
      const m = new Date(week[0].date).getMonth();
      if (m !== lastMonth) {
        labels.push({
          label: new Date(week[0].date).toLocaleDateString("en", { month: "short" }),
          colIndex: i,
        });
        lastMonth = m;
      }
    });
    return labels;
  }, [weeks]);

  return (
    <div>
      {/* month labels */}
      <div className="relative mb-1" style={{ height: "14px" }}>
        {monthLabels.map(({ label, colIndex }) => (
          <span
            key={`${label}-${colIndex}`}
            style={{
              position: "absolute",
              left: `${colIndex * 12}px`,
              color: "var(--text-muted)",
              fontSize: "10px",
              letterSpacing: "0.06em",
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* grid */}
      <div className="flex gap-[3px]">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map(({ date, active }) => (
              <div
                key={date}
                title={`${date} · ${active ? "email sent" : "no update"}`}
                style={{
                  width: "9px",
                  height: "9px",
                  borderRadius: "2px",
                  background: active ? "#4ADE80" : "var(--border)",
                  opacity: active ? 0.85 : 1,
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      <p className="mt-2 text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        each cell = one calendar day ·{" "}
        <span style={{ color: "#4ADE80" }}>■</span> email sent ·{" "}
        measures <em style={{ fontStyle: "normal", color: "var(--text-secondary)" }}>reporting discipline</em>,
        not work
      </p>
    </div>
  );
}

// ── club projects section ──────────────────────────────────────────────────────

function ClubProjectsSection({ entities }: { entities: EntitySummary[] }) {
  const projects = entities.filter((e) => e.category === "club-project");

  return (
    <section>
      <SectionHeader label="Club Projects" />
      {projects.length === 0 ? (
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          [ — ] No club project contributions indexed.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((p) => (
            <div
              key={p.entityId}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                padding: "14px 16px",
              }}
            >
              <div className="flex items-baseline justify-between gap-4">
                <span
                  className="text-[14px] font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {p.displayName}
                </span>
                <span
                  className="text-[11px] tabular-nums shrink-0"
                  style={{ color: "var(--text-muted)" }}
                >
                  {p.contribCount} contrib{p.contribCount !== 1 ? "s" : ""}
                </span>
              </div>
              {p.lastActive && (
                <span
                  className="mt-1 block text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  last active {p.lastActive}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── entity section (per category) ─────────────────────────────────────────────

function EntitySection({
  category,
  entities,
}: {
  category: Category;
  entities: EntitySummary[];
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = CATEGORY_CONFIG[category];
  const visible = expanded ? entities : entities.slice(0, 10);
  const overflow = entities.length - 10;

  return (
    <section>
      <SectionHeader label={cfg.label} color={cfg.text} />
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        {visible.map((e, i) => (
          <div
            key={e.entityId}
            className="flex items-center gap-3 px-4 py-2.5"
            style={{
              borderBottom: i < visible.length - 1 ? "1px solid var(--border-subtle)" : "none",
              background: "transparent",
            }}
          >
            <span
              className="flex-1 text-[13px]"
              style={{ color: "var(--text-primary)" }}
            >
              {e.displayName}
            </span>
            <span
              className="text-[11px] tabular-nums"
              style={{ color: "var(--text-secondary)" }}
            >
              {e.contribCount}
            </span>
            <span
              className="text-[11px] tabular-nums w-[80px] text-right"
              style={{ color: "var(--text-muted)" }}
            >
              {e.lastActive ?? "—"}
            </span>
          </div>
        ))}
        {!expanded && overflow > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full px-4 py-2 text-[11px] text-left transition-colors duration-75"
            style={{
              color: "var(--text-muted)",
              borderTop: "1px solid var(--border-subtle)",
              background: "transparent",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-secondary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-muted)")
            }
          >
            + {overflow} more
          </button>
        )}
      </div>
    </section>
  );
}

// ── contribution log ───────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

function ContributionLog({ contributions }: { contributions: Contribution[] }) {
  const [page, setPage] = useState(1);
  const visible = contributions.slice(0, page * PAGE_SIZE);
  const hasMore = contributions.length > visible.length;

  return (
    <section>
      <SectionHeader label="Contribution Log" />
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        {visible.map((c, i) => (
          <ContribRow
            key={c.id}
            contrib={c}
            last={i === visible.length - 1 && !hasMore}
          />
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setPage((p) => p + 1)}
          className="mt-2 w-full py-2 text-[11px] tracking-[0.06em] uppercase transition-colors duration-75"
          style={{
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text-secondary)";
            e.currentTarget.style.borderColor = "var(--text-muted)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-muted)";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          [ load more · {contributions.length - visible.length} remaining ]
        </button>
      )}
    </section>
  );
}

function ContribRow({
  contrib,
  last,
}: {
  contrib: Contribution;
  last: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderBottom: last ? "none" : "1px solid var(--border-subtle)",
        background: hovered ? "#0F1420" : "transparent",
        transition: "background 75ms",
        padding: "10px 16px",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="text-[11px] tabular-nums shrink-0 mt-0.5"
          style={{ color: "var(--text-muted)", width: "80px" }}
        >
          {contrib.date.slice(0, 10)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <CategoryChip category={contrib.category as Category} />
            {contrib.entity_name && (
              <span
                className="text-[11px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {contrib.entity_name}
              </span>
            )}
            {contrib.event_name && (
              <span
                className="text-[11px]"
                style={{ color: "var(--text-muted)" }}
              >
                · {contrib.event_name}
                {contrib.event_role ? ` (${contrib.event_role})` : ""}
              </span>
            )}
          </div>
          <p
            className="text-[12px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {contrib.activity_text}
          </p>
        </div>
        <a
          href={`/api/emails/${contrib.email_id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: hovered ? "var(--accent)" : "var(--text-muted)",
            fontSize: "11px",
            transition: "color 75ms",
            textDecoration: "none",
            flexShrink: 0,
            marginTop: "2px",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--accent)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = hovered
              ? "var(--accent)"
              : "var(--text-muted)")
          }
        >
          [source →]
        </a>
      </div>
    </div>
  );
}

// ── section header ─────────────────────────────────────────────────────────────

function SectionHeader({ label, color }: { label: string; color?: string }) {
  return (
    <div
      className="flex items-center gap-2 mb-3"
      style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "8px" }}
    >
      {color && (
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: color,
            flexShrink: 0,
            display: "inline-block",
          }}
        />
      )}
      <span
        className="text-[10px] tracking-[0.12em] uppercase"
        style={{ color: color ?? "var(--text-muted)" }}
      >
        {label}
      </span>
    </div>
  );
}

// ── skeleton sections ──────────────────────────────────────────────────────────

function HeroSkeleton() {
  return (
    <div className="flex flex-col gap-3 pb-6" style={{ borderBottom: "1px solid var(--border)" }}>
      <Skeleton w="160px" h="20px" />
      <div className="flex items-center gap-4">
        <Skeleton w="72px" h="22px" />
        <Skeleton w="56px" h="14px" />
        <Skeleton w="48px" h="14px" />
      </div>
    </div>
  );
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <section>
      <div className="mb-3 pb-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <Skeleton w="100px" h="10px" />
      </div>
      <div
        style={{ border: "1px solid var(--border)", borderRadius: "4px", overflow: "hidden" }}
      >
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: i < rows - 1 ? "1px solid var(--border-subtle)" : "none" }}
          >
            <Skeleton w={`${120 + (i % 3) * 40}px`} />
            <span className="flex-1" />
            <Skeleton w="32px" />
          </div>
        ))}
      </div>
    </section>
  );
}

// ── category bar ───────────────────────────────────────────────────────────────

function CategoryBar({ entitySummaries }: { entitySummaries: EntitySummary[] }) {
  const counts = useMemo(() => {
    const m = new Map<Category, number>();
    entitySummaries.forEach((e) => {
      m.set(e.category, (m.get(e.category) ?? 0) + e.contribCount);
    });
    return m;
  }, [entitySummaries]);

  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const segments = CATEGORY_ORDER.filter((c) => counts.has(c)).map((c) => ({
    category: c,
    count: counts.get(c)!,
    pct: (counts.get(c)! / total) * 100,
    cfg: CATEGORY_CONFIG[c],
  }));

  return (
    <div>
      {/* bar */}
      <div
        className="flex w-full overflow-hidden"
        style={{ height: "6px", borderRadius: "3px", gap: "2px" }}
      >
        {segments.map(({ category, pct, cfg }) => (
          <div
            key={category}
            title={`${cfg.label}: ${counts.get(category)} contribs`}
            style={{
              width: `${pct}%`,
              background: cfg.text,
              opacity: 0.7,
              borderRadius: "2px",
              flexShrink: 0,
            }}
          />
        ))}
      </div>
      {/* legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {segments.map(({ category, count, cfg }) => (
          <span
            key={category}
            className="flex items-center gap-1.5 text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: cfg.text,
                opacity: 0.7,
                flexShrink: 0,
                display: "inline-block",
              }}
            />
            <span style={{ color: cfg.text, opacity: 0.9 }}>{cfg.label}</span>
            <span>{count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────────

export default function MemberPage() {
  const params = useParams();
  const id = params?.id as string;

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/members/${id}`)
      .then((r) => {
        if (r.status === 404) throw new Error("not-found");
        if (!r.ok) throw new Error(`API error ${r.status}`);
        return r.json();
      })
      .then((data: MemberDetail) => {
        setMember(data);
        setIsLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setIsLoading(false);
      });
  }, [id]);

  const orderedCategories = useMemo(() => {
    if (!member) return [];
    const present = new Set(member.entitySummaries.map((e) => e.category));
    return CATEGORY_ORDER.filter(
      (c) => c !== "club-project" && present.has(c)
    );
  }, [member]);

  const entitiesByCategory = useMemo(() => {
    if (!member) return {} as Record<Category, EntitySummary[]>;
    const m: Partial<Record<Category, EntitySummary[]>> = {};
    member.entitySummaries.forEach((e) => {
      if (!m[e.category]) m[e.category] = [];
      m[e.category]!.push(e);
    });
    return m as Record<Category, EntitySummary[]>;
  }, [member]);

  const noContribs =
    !isLoading && !error && member && member.contribCount === 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>

      {/* ── top bar ── */}
      <header
        className="flex items-center justify-between px-6 py-3.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="text-[11px] tracking-[0.04em] transition-colors duration-75"
            style={{ color: "var(--text-muted)", textDecoration: "none" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-secondary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-muted)")
            }
          >
            ← roster
          </a>
          <span
            style={{
              width: "1px",
              height: "12px",
              background: "var(--border)",
              display: "inline-block",
            }}
          />
          <span
            className="text-[15px] font-bold tracking-[0.1em] uppercase"
            style={{ color: "var(--text-primary)" }}
          >
            amDash
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-6 py-6 gap-8 w-full max-w-4xl mx-auto">

        {/* ── hero ── */}
        {isLoading ? (
          <HeroSkeleton />
        ) : error === "not-found" ? (
          <p className="text-[13px]" style={{ color: "#F87171" }}>
            [ ERROR ] Member not found.
          </p>
        ) : error ? (
          <p className="text-[13px]" style={{ color: "#F87171" }}>
            [ ERROR ] Could not reach API: {error}
          </p>
        ) : member ? (
          <div
            className="pb-6"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h1
                  className="text-[22px] font-medium mb-1"
                  style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}
                >
                  {member.name}
                </h1>
                {member.githubHandle && (
                  <a
                    href={`https://github.com/${member.githubHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] transition-colors duration-75"
                    style={{
                      color: "var(--text-muted)",
                      textDecoration: "none",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "var(--accent)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "var(--text-muted)")
                    }
                  >
                    @{member.githubHandle}
                  </a>
                )}
              </div>
              <StatusToken status={member.status} />
            </div>

            <div
              className="flex items-center gap-5 text-[11px] tracking-[0.04em] mb-4"
              style={{ color: "var(--text-muted)" }}
            >
              <span>
                last update{" "}
                <span style={{ color: "var(--text-secondary)" }}>
                  {formatDaysAgo(member.lastUpdateDaysAgo)}
                </span>
              </span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {member.activeDays}
                </span>{" "}
                active days
              </span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {member.contribCount}
                </span>{" "}
                contributions
              </span>
            </div>

            <CategoryBar entitySummaries={member.entitySummaries} />
          </div>
        ) : null}

        {/* ── no data warning ── */}
        {noContribs && (
          <p className="text-[13px]" style={{ color: "#FBBF24" }}>
            [ WARN ] No contributions indexed for this member. Pipeline may not have run.
          </p>
        )}

        {/* ── content sections ── */}
        {!isLoading && !error && member && member.contribCount > 0 && (
          <>
            {/* club projects — always first */}
            <ClubProjectsSection entities={member.entitySummaries} />

            {/* ordered non-club-project categories */}
            {orderedCategories.map((cat) => (
              <EntitySection
                key={cat}
                category={cat}
                entities={entitiesByCategory[cat] ?? []}
              />
            ))}

            {/* heatmap */}
            <section>
              <SectionHeader label="Reporting Cadence" />
              <ActivityHeatmap contributions={member.contributions} />
            </section>

            {/* contribution log */}
            <ContributionLog contributions={member.contributions} />
          </>
        )}

        {/* ── loading skeletons ── */}
        {isLoading && (
          <>
            <SectionSkeleton rows={2} />
            <SectionSkeleton rows={4} />
            <SectionSkeleton rows={3} />
          </>
        )}
      </main>
    </div>
  );
}
