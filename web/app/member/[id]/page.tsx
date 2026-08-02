"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { type Category, type Status } from "../../data/members";
import { CATEGORY_ORDER, categoryConfig } from "../../data/categories";
import { StatusToken, CategoryChip, AvatarPod, formatDaysAgo } from "../../components/tokens";

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

// ── email modal — the white counter-surface ────────────────────────────────────

const PARSE_STATUS_DOT: Record<string, string> = {
  done:    "#4C9A2A",
  error:   "#D4494B",
  pending: "#C08A1E",
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

  const dotColor = data ? (PARSE_STATUS_DOT[data.parse_status] ?? "#6E7076") : "#6E7076";
  const inkDim = "rgba(18,19,22,0.55)";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.6)",
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
          background: "var(--inverse)",
          color: "var(--text-on-inverse)",
          borderRadius: "24px",
          width: "100%",
          maxWidth: "760px",
          maxHeight: "calc(100vh - 32px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          outline: "none",
        }}
      >
        {/* ── modal header ── */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid rgba(18,19,22,0.08)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
            flexShrink: 0,
          }}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="display text-[16px] font-semibold">
                Email #{emailId}
              </span>
              {data && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                  style={{ background: "rgba(18,19,22,0.06)", color: "var(--text-on-inverse)" }}
                >
                  <span
                    style={{
                      background: dotColor,
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      display: "inline-block",
                    }}
                    aria-hidden="true"
                  />
                  {data.parse_status}
                </span>
              )}
            </div>
            {data && (
              <>
                <span className="text-[13px] font-medium truncate">
                  {data.from_addr}
                </span>
                <div className="flex items-center gap-3 flex-wrap">
                  {data.subject && (
                    <span className="text-[12px] truncate" style={{ color: inkDim }}>
                      {data.subject}
                    </span>
                  )}
                  <span className="text-[11px] tabular-nums shrink-0" style={{ color: inkDim }}>
                    {data.received_at.slice(0, 16).replace("T", " · ")}
                  </span>
                </div>
              </>
            )}
            {loading && (
              <div className="flex flex-col gap-1.5 mt-1">
                <ModalSkeleton w="180px" h="13px" />
                <ModalSkeleton w="240px" h="11px" />
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close email viewer"
            className="shrink-0"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(18,19,22,0.06)",
              color: "var(--text-on-inverse)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 160ms ease-out",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(18,19,22,0.12)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(18,19,22,0.06)")}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── body ── */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {err ? (
            <div className="p-6 text-[13px]" style={{ color: "#D4494B" }}>
              Could not load email #{emailId}: {err}
            </div>
          ) : loading ? (
            <div className="p-6 flex flex-col gap-2">
              {Array.from({ length: 8 }, (_, i) => (
                <ModalSkeleton key={i} w={`${55 + (i % 5) * 8}%`} h="11px" />
              ))}
            </div>
          ) : data ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              {/* raw body */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "18px 24px",
                  borderBottom: data.contributions.length > 0 ? "1px solid rgba(18,19,22,0.08)" : "none",
                }}
              >
                {data.raw_body.trim() ? (
                  <pre
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px",
                      lineHeight: "1.7",
                      color: "rgba(18,19,22,0.8)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      margin: 0,
                    }}
                  >
                    {data.raw_body}
                  </pre>
                ) : (
                  <span className="text-[13px]" style={{ color: "#C08A1E" }}>
                    No body stored for this email.
                  </span>
                )}
              </div>

              {/* extracted contributions */}
              {data.contributions.length > 0 && (
                <div style={{ flexShrink: 0, maxHeight: "240px", overflowY: "auto" }}>
                  <div
                    style={{
                      padding: "10px 24px",
                      borderBottom: "1px solid rgba(18,19,22,0.06)",
                      position: "sticky",
                      top: 0,
                      background: "var(--inverse)",
                    }}
                  >
                    <span className="text-[12px] font-medium" style={{ color: inkDim }}>
                      {data.contributions.length} contribution{data.contributions.length !== 1 ? "s" : ""} extracted
                    </span>
                  </div>
                  {data.contributions.map((c, i) => (
                    <div
                      key={c.id}
                      style={{
                        padding: "10px 24px",
                        borderBottom: i < data.contributions.length - 1 ? "1px solid rgba(18,19,22,0.06)" : "none",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px",
                      }}
                    >
                      <span
                        className="text-[11px] tabular-nums shrink-0"
                        style={{ color: inkDim, width: "76px", marginTop: "3px" }}
                      >
                        {c.date.slice(0, 10)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
                            style={{ background: "rgba(18,19,22,0.06)", color: "var(--text-on-inverse)" }}
                          >
                            <span
                              style={{
                                background: categoryConfig(c.category as Category).text,
                                width: "5px",
                                height: "5px",
                                borderRadius: "50%",
                                display: "inline-block",
                              }}
                              aria-hidden="true"
                            />
                            {categoryConfig(c.category as Category).label}
                          </span>
                          {c.entity_name && (
                            <span className="text-[11px] font-medium">{c.entity_name}</span>
                          )}
                          {c.event_name && (
                            <span className="text-[11px]" style={{ color: inkDim }}>
                              · {c.event_name}
                              {c.event_role ? ` (${c.event_role})` : ""}
                            </span>
                          )}
                        </div>
                        <p
                          className="text-[12px] leading-relaxed"
                          style={{ color: "rgba(18,19,22,0.75)", margin: 0 }}
                        >
                          {c.activity_text}
                        </p>
                      </div>
                      <span
                        className="text-[11px] tabular-nums shrink-0 inline-flex items-center gap-1.5"
                        style={{ color: inkDim, marginTop: "3px" }}
                        title={`extraction confidence: ${Math.round(c.confidence * 100)}%`}
                      >
                        <span
                          style={{
                            background: c.confidence >= 0.8 ? "#4C9A2A" : c.confidence >= 0.5 ? "#C08A1E" : "#D4494B",
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            display: "inline-block",
                          }}
                          aria-hidden="true"
                        />
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
  return <span className="skeleton block" style={{ width: w, height: h }} />;
}

function ModalSkeleton({ w, h = "12px" }: { w: string; h?: string }) {
  return (
    <span
      className="skeleton block"
      style={{ width: w, height: h, background: "rgba(18,19,22,0.08)" }}
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
      {/* scroll container — the year grid is wider than a phone; scroll rather than clip */}
      <div className="overflow-x-auto pb-1">
        <div style={{ width: "fit-content" }}>
          {/* month labels */}
          <div className="relative mb-1.5" style={{ height: "14px" }}>
            {monthLabels.map(({ label, colIndex }) => (
              <span
                key={`${label}-${colIndex}`}
                style={{
                  position: "absolute",
                  left: `${colIndex * 12}px`,
                  color: "var(--text-muted)",
                  fontSize: "10px",
                  letterSpacing: "0.04em",
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
                      borderRadius: "3px",
                      background: active ? "var(--accent)" : "var(--surface-2)",
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        each cell = one calendar day ·{" "}
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "2px",
            background: "var(--accent)",
            verticalAlign: "baseline",
          }}
        />{" "}
        email sent · measures{" "}
        <span style={{ color: "var(--text-secondary)" }}>reporting discipline</span>, not work
      </p>
    </div>
  );
}

// ── section card shell ─────────────────────────────────────────────────────────

function SectionCard({
  title,
  dotColor,
  children,
}: {
  title: string;
  dotColor?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-card)",
        padding: "20px 24px 22px",
      }}
    >
      <div className="flex items-center gap-2.5 mb-4">
        {dotColor && (
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: dotColor,
              flexShrink: 0,
              display: "inline-block",
            }}
            aria-hidden="true"
          />
        )}
        <h2 className="display text-[18px] font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

// ── club projects section ──────────────────────────────────────────────────────

function ClubProjectsSection({ entities }: { entities: EntitySummary[] }) {
  const projects = entities.filter((e) => e.category === "club-project");

  return (
    <SectionCard title="Club Projects" dotColor={categoryConfig("club-project").text}>
      {projects.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
          No club project contributions indexed.
        </p>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {projects.map((p) => (
            <div
              key={p.entityId}
              style={{
                background: "var(--surface-2)",
                borderRadius: "16px",
                padding: "14px 16px",
              }}
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[14px] font-medium break-words" style={{ color: "var(--text-primary)" }}>
                  {p.displayName}
                </span>
                <span className="text-[12px] tabular-nums shrink-0" style={{ color: "var(--text-secondary)" }}>
                  {p.contribCount}
                </span>
              </div>
              {p.lastActive && (
                <span className="mt-1 block text-[11px]" style={{ color: "var(--text-muted)" }}>
                  last active {p.lastActive}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
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
    <SectionCard title={cfg.label} dotColor={cfg.text}>
      <div>
        {visible.map((e, i) => (
          <div
            key={e.entityId}
            className="flex items-center gap-3 py-2.5"
            style={{
              borderBottom: i < visible.length - 1 ? "1px solid var(--border-subtle)" : "none",
            }}
          >
            <span className="flex-1 text-[13px] min-w-0 break-words" style={{ color: "var(--text-primary)" }}>
              {e.displayName}
            </span>
            <span className="text-[12px] tabular-nums shrink-0" style={{ color: "var(--text-secondary)" }}>
              {e.contribCount}
            </span>
            <span
              className="text-[12px] tabular-nums w-[80px] text-right shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              {e.lastActive ?? "—"}
            </span>
          </div>
        ))}
        {!expanded && overflow > 0 && (
          <button onClick={() => setExpanded(true)} className="pill mt-3">
            + {overflow} more
          </button>
        )}
      </div>
    </SectionCard>
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
    <SectionCard title="Contribution Log">
      <div className="flex flex-col">
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
        <button onClick={() => setPage((p) => p + 1)} className="pill mt-4">
          Load more · {contributions.length - visible.length} remaining
        </button>
      )}
      {activeEmailId !== null && (
        <EmailModal emailId={activeEmailId} onClose={closeEmail} />
      )}
    </SectionCard>
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
        background: hovered ? "var(--surface-2)" : "transparent",
        transition: "background 160ms ease-out",
        padding: "12px 12px",
        margin: "0 -12px",
        borderRadius: "14px",
        cursor: "pointer",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="text-[12px] tabular-nums shrink-0 mt-0.5"
          style={{ color: "var(--text-muted)", width: "80px" }}
        >
          {contrib.date.slice(0, 10)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <CategoryChip category={contrib.category as Category} />
            {contrib.entity_name && (
              <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                {contrib.entity_name}
              </span>
            )}
            {contrib.event_name && (
              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                · {contrib.event_name}
                {contrib.event_role ? ` (${contrib.event_role})` : ""}
              </span>
            )}
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {contrib.activity_text}
          </p>
        </div>
        <span
          style={{
            color: "var(--accent)",
            fontSize: "12px",
            flexShrink: 0,
            marginTop: "2px",
            opacity: hovered ? 1 : 0,
            transition: "opacity 160ms ease-out",
            userSelect: "none",
          }}
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M4 10L10 4M10 4H5.2M10 4V8.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </div>
  );
}

// ── skeleton sections ──────────────────────────────────────────────────────────

function HeroSkeleton() {
  return (
    <div
      className="flex flex-col gap-4"
      style={{ background: "var(--surface)", borderRadius: "var(--radius-card)", padding: "24px" }}
    >
      <span className="skeleton block" style={{ width: "56px", height: "56px", borderRadius: "50%" }} />
      <Skeleton w="200px" h="24px" />
      <div className="flex items-center gap-4">
        <Skeleton w="80px" h="28px" />
        <Skeleton w="64px" h="28px" />
        <Skeleton w="56px" h="28px" />
      </div>
    </div>
  );
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <section
      style={{ background: "var(--surface)", borderRadius: "var(--radius-card)", padding: "20px 24px" }}
    >
      <div className="mb-4">
        <Skeleton w="120px" h="16px" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 py-3"
          style={{ borderBottom: i < rows - 1 ? "1px solid var(--border-subtle)" : "none" }}
        >
          <Skeleton w={`${120 + (i % 3) * 40}px`} />
          <span className="flex-1" />
          <Skeleton w="32px" />
        </div>
      ))}
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
      <div className="flex w-full overflow-hidden" style={{ height: "8px", borderRadius: "999px", gap: "3px" }}>
        {segments.map(({ category, count, pct, cfg }) => (
          <div
            key={category}
            title={`${cfg.label}: ${count} contribution${count !== 1 ? "s" : ""}`}
            style={{
              width: `${pct}%`,
              background: cfg.text,
              opacity: 0.8,
              borderRadius: "999px",
              flexShrink: 0,
            }}
          />
        ))}
      </div>
      {/* legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
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
                opacity: 0.8,
                flexShrink: 0,
                display: "inline-block",
              }}
            />
            <span style={{ color: "var(--text-secondary)" }}>{cfg.label}</span>
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
      <header className="flex items-center gap-4 px-5 sm:px-8 py-5 w-full max-w-[960px] mx-auto">
        <a href="/" className="pill" style={{ textDecoration: "none" }} aria-label="Back to roster">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 3L4 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          roster
        </a>
        <span
          className="display text-[20px] font-bold tracking-[0.06em] uppercase"
          style={{ color: "var(--text-primary)" }}
        >
          amDash
        </span>
      </header>

      <main className="flex-1 flex flex-col px-5 sm:px-8 pb-10 pt-1 gap-5 w-full max-w-[960px] mx-auto">

        {/* ── hero ── */}
        {isLoading ? (
          <HeroSkeleton />
        ) : error === "not-found" ? (
          <div style={{ background: "var(--surface)", borderRadius: "var(--radius-card)", padding: "24px" }}>
            <p className="text-[14px]" style={{ color: "var(--danger)" }}>
              Member not found.
            </p>
          </div>
        ) : error ? (
          <div style={{ background: "var(--surface)", borderRadius: "var(--radius-card)", padding: "24px" }}>
            <p className="text-[14px]" style={{ color: "var(--danger)" }}>
              Could not reach the API: {error}
            </p>
          </div>
        ) : member ? (
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-card)",
              padding: "24px",
            }}
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-4 min-w-0">
                <AvatarPod name={member.name} githubHandle={member.githubHandle} size={56} />
                <div className="min-w-0">
                  <h1
                    className="display text-[26px] font-semibold break-words leading-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {member.name}
                  </h1>
                  {member.githubHandle && (
                    <a
                      href={`https://github.com/${member.githubHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] transition-colors duration-150"
                      style={{ color: "var(--text-muted)", textDecoration: "none" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                    >
                      @{member.githubHandle}
                    </a>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                <StatusToken status={member.status} />
              </div>
            </div>

            {/* hero numerals */}
            <div className="flex items-end gap-x-8 gap-y-3 flex-wrap mb-6">
              <div className="flex items-baseline gap-2">
                <span className="display font-bold tabular-nums text-[32px] leading-none" style={{ color: "var(--text-primary)" }}>
                  {formatDaysAgo(member.lastUpdateDaysAgo)}
                </span>
                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>last update</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="display font-bold tabular-nums text-[32px] leading-none" style={{ color: "var(--text-primary)" }}>
                  {member.activeDays}
                </span>
                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>active days</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="display font-bold tabular-nums text-[32px] leading-none" style={{ color: "var(--text-primary)" }}>
                  {member.contribCount}
                </span>
                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>contributions</span>
              </div>
            </div>

            <CategoryBar contributions={member.contributions} />
          </div>
        ) : null}

        {/* ── no data warning ── */}
        {noContribs && (
          <div style={{ background: "var(--surface)", borderRadius: "var(--radius-card)", padding: "24px" }}>
            <p className="text-[14px]" style={{ color: "var(--warning)" }}>
              No contributions indexed for this member — the pipeline may not have run.
            </p>
          </div>
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
            <SectionCard title="Reporting Cadence">
              <ActivityHeatmap contributions={member.contributions} />
            </SectionCard>

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
