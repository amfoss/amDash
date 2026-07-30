"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { type Category, type Status } from "../../data/members";
import { CATEGORY_ORDER, categoryConfig } from "../../data/categories";
import { StatusToken, CategoryChip, formatDaysAgo } from "../../components/tokens";

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

interface EmailContribution {
  id: number;
  date: string;
  category: string;
  activity_text: string;
  event_role: string | null;
  confidence: number;
  entity_name: string | null;
  event_name: string | null;
}

interface EmailDetail {
  id: number;
  message_id: string | null;
  from_addr: string;
  report_date: string;
  received_at: string;
  subject: string | null;
  raw_body: string;
  parse_status: string;
  contributions: EmailContribution[];
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

// ── email modal ────────────────────────────────────────────────────────────────

const PARSE_STATUS_COLOR: Record<string, string> = {
  done:    "#4ADE80",
  error:   "#F87171",
  pending: "#FBBF24",
};

function EmailModal({
  emailId,
  onClose,
}: {
  emailId: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setData(null);
    setLoading(true);
    setErr(null);
    fetch(`/api/emails/${emailId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: EmailDetail) => { setData(d); setLoading(false); })
      .catch((e: Error) => { setErr(e.message); setLoading(false); });
  }, [emailId]);

  // close on Escape; lock body scroll; move focus into the dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const statusColor = data ? (PARSE_STATUS_COLOR[data.parse_status] ?? "#6B7A99") : "#6B7A99";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Source email ${emailId}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          width: "100%",
          maxWidth: "760px",
          maxHeight: "calc(100vh - 32px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          outline: "none",
        }}
      >
        {/* ── modal header ── */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
            flexShrink: 0,
          }}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="text-[11px] tracking-[0.1em] uppercase font-bold"
                style={{ color: "var(--accent)" }}
              >
                [ EMAIL #{emailId} ]
              </span>
              {data && (
                <span
                  className="text-[10px] tracking-[0.06em] uppercase px-1.5 py-px rounded-sm"
                  style={{
                    color: statusColor,
                    border: `1px solid ${statusColor}33`,
                    background: `${statusColor}0D`,
                  }}
                >
                  {data.parse_status}
                </span>
              )}
            </div>
            {data && (
              <>
                <span
                  className="text-[13px] font-medium truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {data.from_addr}
                </span>
                <div className="flex items-center gap-3 flex-wrap">
                  {data.subject && (
                    <span
                      className="text-[12px] truncate"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {data.subject}
                    </span>
                  )}
                  <span
                    className="text-[11px] tabular-nums shrink-0"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {data.received_at.slice(0, 16).replace("T", " · ")}
                  </span>
                </div>
              </>
            )}
            {loading && (
              <div className="flex flex-col gap-1.5 mt-1">
                <Skeleton w="180px" h="13px" />
                <Skeleton w="240px" h="11px" />
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[12px] shrink-0 transition-colors duration-75"
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            aria-label="Close email viewer"
          >
            [×]
          </button>
        </div>

        {/* ── body ── */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {err ? (
            <div className="p-5 text-[12px]" style={{ color: "#F87171" }}>
              [ FAIL ] Could not load email #{emailId}: {err}
            </div>
          ) : loading ? (
            <div className="p-5 flex flex-col gap-2">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} w={`${55 + (i % 5) * 8}%`} h="11px" />
              ))}
            </div>
          ) : data ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              {/* raw body */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "16px 20px",
                  borderBottom: data.contributions.length > 0 ? "1px solid var(--border)" : "none",
                }}
              >
                {data.raw_body.trim() ? (
                  <pre
                    style={{
                      fontFamily: "inherit",
                      fontSize: "11px",
                      lineHeight: "1.7",
                      color: "var(--text-secondary)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      margin: 0,
                    }}
                  >
                    {data.raw_body}
                  </pre>
                ) : (
                  <span className="text-[12px]" style={{ color: "#FBBF24" }}>
                    [ WARN ] No body stored for this email.
                  </span>
                )}
              </div>

              {/* extracted contributions */}
              {data.contributions.length > 0 && (
                <div style={{ flexShrink: 0, maxHeight: "240px", overflowY: "auto" }}>
                  <div
                    style={{
                      padding: "8px 20px",
                      borderBottom: "1px solid var(--border-subtle)",
                      position: "sticky",
                      top: 0,
                      background: "var(--surface)",
                    }}
                  >
                    <span
                      className="text-[10px] tracking-[0.12em] uppercase"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {data.contributions.length} contribution{data.contributions.length !== 1 ? "s" : ""} extracted
                    </span>
                  </div>
                  {data.contributions.map((c, i) => (
                    <div
                      key={c.id}
                      style={{
                        padding: "9px 20px",
                        borderBottom: i < data.contributions.length - 1 ? "1px solid var(--border-subtle)" : "none",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px",
                      }}
                    >
                      <span
                        className="text-[11px] tabular-nums shrink-0"
                        style={{ color: "var(--text-muted)", width: "76px", marginTop: "1px" }}
                      >
                        {c.date.slice(0, 10)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <CategoryChip category={c.category as Category} />
                          {c.entity_name && (
                            <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                              {c.entity_name}
                            </span>
                          )}
                          {c.event_name && (
                            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                              · {c.event_name}
                              {c.event_role ? ` (${c.event_role})` : ""}
                            </span>
                          )}
                        </div>
                        <p
                          className="text-[11px] leading-relaxed"
                          style={{ color: "var(--text-secondary)", margin: 0 }}
                        >
                          {c.activity_text}
                        </p>
                      </div>
                      <span
                        className="text-[10px] tabular-nums shrink-0"
                        style={{
                          color: c.confidence >= 0.8 ? "#4ADE80" : c.confidence >= 0.5 ? "#FBBF24" : "#F87171",
                          marginTop: "2px",
                        }}
                        title={`extraction confidence: ${Math.round(c.confidence * 100)}%`}
                      >
                        {Math.round(c.confidence * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────────

function Skeleton({ w, h = "12px" }: { w: string; h?: string }) {
  return <span className="skeleton block rounded-sm" style={{ width: w, height: h }} />;
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
      {/* scroll container — the year grid is wider than a phone; scroll rather than clip */}
      <div className="overflow-x-auto pb-1">
        <div style={{ width: "fit-content" }}>
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
        </div>
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
  const cfg = categoryConfig(category);
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
            <span className="flex-1 text-[13px] min-w-0 break-words" style={{ color: "var(--text-primary)" }}>
              {e.displayName}
            </span>
            <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--text-secondary)" }}>
              {e.contribCount}
            </span>
            <span
              className="text-[11px] tabular-nums w-[80px] text-right shrink-0"
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
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
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
  const [activeEmailId, setActiveEmailId] = useState<number | null>(null);
  const visible = contributions.slice(0, page * PAGE_SIZE);
  const hasMore = contributions.length > visible.length;

  const openEmail = useCallback((id: number) => setActiveEmailId(id), []);
  const closeEmail = useCallback(() => setActiveEmailId(null), []);

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
            onOpenEmail={openEmail}
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
      {activeEmailId !== null && (
        <EmailModal emailId={activeEmailId} onClose={closeEmail} />
      )}
    </section>
  );
}

function ContribRow({
  contrib,
  last,
  onOpenEmail,
}: {
  contrib: Contribution;
  last: boolean;
  onOpenEmail: (id: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const open = () => onOpenEmail(contrib.email_id);

  return (
    <div
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`View source email for ${contrib.date.slice(0, 10)} contribution`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderBottom: last ? "none" : "1px solid var(--border-subtle)",
        background: hovered ? "#0F1420" : "transparent",
        transition: "background 75ms",
        padding: "10px 16px",
        cursor: "pointer",
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
              <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {contrib.entity_name}
              </span>
            )}
            {contrib.event_name && (
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                · {contrib.event_name}
                {contrib.event_role ? ` (${contrib.event_role})` : ""}
              </span>
            )}
          </div>
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {contrib.activity_text}
          </p>
        </div>
        <span
          style={{
            color: "var(--accent)",
            fontSize: "11px",
            flexShrink: 0,
            marginTop: "2px",
            opacity: hovered ? 1 : 0,
            transition: "opacity 75ms",
            userSelect: "none",
          }}
          aria-hidden="true"
        >
          →
        </span>
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
      <div style={{ border: "1px solid var(--border)", borderRadius: "4px", overflow: "hidden" }}>
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
// Derived from the full contribution set (not entity summaries) so it reflects
// every logged contribution — including those with no resolved entity.

function CategoryBar({ contributions }: { contributions: Contribution[] }) {
  const counts = useMemo(() => {
    const m = new Map<Category, number>();
    contributions.forEach((c) => {
      m.set(c.category, (m.get(c.category) ?? 0) + 1);
    });
    return m;
  }, [contributions]);

  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const segments = CATEGORY_ORDER.filter((c) => counts.has(c)).map((c) => ({
    category: c,
    count: counts.get(c)!,
    pct: (counts.get(c)! / total) * 100,
    cfg: categoryConfig(c),
  }));

  return (
    <div>
      {/* bar */}
      <div className="flex w-full overflow-hidden" style={{ height: "6px", borderRadius: "3px", gap: "2px" }}>
        {segments.map(({ category, count, pct, cfg }) => (
          <div
            key={category}
            title={`${cfg.label}: ${count} contribution${count !== 1 ? "s" : ""}`}
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
    return CATEGORY_ORDER.filter((c) => c !== "club-project" && present.has(c));
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

  const noContribs = !isLoading && !error && member && member.contribCount === 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>

      {/* ── top bar ── */}
      <header
        className="flex items-center justify-between px-4 sm:px-6 py-3.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="text-[11px] tracking-[0.04em] transition-colors duration-75"
            style={{ color: "var(--text-muted)", textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            ← roster
          </a>
          <span
            style={{ width: "1px", height: "12px", background: "var(--border)", display: "inline-block" }}
          />
          <span
            className="text-[15px] font-bold tracking-[0.1em] uppercase"
            style={{ color: "var(--text-primary)" }}
          >
            amDash
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-4 sm:px-6 py-6 gap-8 w-full max-w-4xl mx-auto">

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
          <div className="pb-6" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0">
                <h1
                  className="text-[22px] font-medium mb-1 break-words"
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
                    style={{ color: "var(--text-muted)", textDecoration: "none" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  >
                    @{member.githubHandle}
                  </a>
                )}
              </div>
              <div className="shrink-0">
                <StatusToken status={member.status} />
              </div>
            </div>

            <div
              className="flex items-center gap-x-5 gap-y-1 flex-wrap text-[11px] tracking-[0.04em] mb-4"
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
                <span style={{ color: "var(--text-secondary)" }}>{member.activeDays}</span> active days
              </span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>
                <span style={{ color: "var(--text-secondary)" }}>{member.contribCount}</span> contributions
              </span>
            </div>

            <CategoryBar contributions={member.contributions} />
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
