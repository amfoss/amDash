"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { type Member, type Category, type Status } from "./data/members";
import { ALL_STATUSES, STATUS_CONFIG } from "./data/categories";
import { StatusToken, CategoryChip, formatDaysAgo } from "./components/tokens";

// ── sub-components ─────────────────────────────────────────────────────────────

function CategoryChips({ categories }: { categories: Category[] }) {
  const visible = categories.slice(0, 3);
  const overflow = categories.length - 3;
  return (
    <span className="flex flex-wrap gap-1.5 items-center">
      {visible.map((c) => (
        <CategoryChip key={c} category={c} />
      ))}
      {overflow > 0 && (
        <span className="chip" style={{ color: "var(--text-muted)" }}>
          +{overflow}
        </span>
      )}
    </span>
  );
}

function FilterPill({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} aria-pressed={active} className="pill">
      {color && (
        <span
          style={{
            background: color,
            opacity: active ? 1 : 0.5,
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            flexShrink: 0,
            display: "inline-block",
          }}
        />
      )}
      {label}
    </button>
  );
}

// ── member card ────────────────────────────────────────────────────────────────

function MemberCard({ member }: { member: Member }) {
  const router = useRouter();
  const navigate = useCallback(() => router.push(`/member/${member.id}`), [router, member.id]);

  return (
    <div
      onClick={navigate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate();
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={`Open ${member.name}'s activity — ${member.status.toLowerCase()}, last update ${formatDaysAgo(member.lastUpdateDaysAgo)}`}
      className={`notch-card member-card cursor-pointer ${
        member.status === "ACTIVE" ? "member-card--active" : ""
      }`}
    >
      <span className="notch-card__bg" aria-hidden="true" />
      <span className="notch-btn" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M4 10L10 4M10 4H5.2M10 4V8.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>

      <div className="relative flex flex-col gap-3 p-5">

        {/* row 1: status badge + last update */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusToken status={member.status} />
          <span className="text-[12px] tabular-nums" style={{ color: "var(--card-dim)" }}>
            {formatDaysAgo(member.lastUpdateDaysAgo)}
          </span>
        </div>

        {/* row 2: name + github */}
        <div className="min-w-0">
          <span
            className="display block text-[18px] font-semibold truncate"
            style={{ color: "var(--card-ink)" }}
          >
            {member.name}
          </span>
          <span className="block text-[12px] mt-0.5 truncate" style={{ color: "var(--card-dim)" }}>
            {member.githubHandle ? `@${member.githubHandle}` : "no github handle"}
          </span>
        </div>

        {/* row 3: year badge + contribs — the two secondary signals */}
        <div className="flex items-center gap-2 flex-wrap">
          {member.year !== null && (
            <span
              className="display font-semibold tabular-nums"
              style={{
                fontSize: "13px",
                background: "var(--pod-bg)",
                border: "1px solid var(--border)",
                borderRadius: "999px",
                padding: "4px 10px",
                color: "var(--card-ink)",
              }}
            >
              Year {member.year}
            </span>
          )}
          {member.contribCount > 0 && (
            <span
              className="display font-bold tabular-nums"
              style={{
                fontSize: "13px",
                background: "var(--pod-bg)",
                border: "1px solid var(--border)",
                borderRadius: "999px",
                padding: "4px 10px",
                color: "var(--card-ink)",
              }}
            >
              {member.contribCount}
              <span className="font-normal" style={{ color: "var(--card-dim)", marginLeft: "4px" }}>
                contribs
              </span>
            </span>
          )}
          {member.contribCount === 0 && (
            <span className="text-[12px] tabular-nums" style={{ color: "var(--card-dim)" }}>—</span>
          )}
        </div>

        {member.activeCategories.length > 0 && (
          <CategoryChips categories={member.activeCategories} />
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="notch-card">
      <span className="notch-card__bg" aria-hidden="true" />
      <div className="relative flex flex-col gap-3 p-5">
        <span className="skeleton block h-6" style={{ width: "56px", borderRadius: "999px" }} />
        <span className="skeleton block h-4" style={{ width: "60%" }} />
        <span className="skeleton block h-3" style={{ width: "40%" }} />
        <span className="skeleton block h-6" style={{ width: "80%" }} />
      </div>
    </div>
  );
}

// ── hero numerals ──────────────────────────────────────────────────────────────

function StatBlock({
  count,
  label,
  dotColor,
}: {
  count: number;
  label: string;
  dotColor?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className="display font-bold tabular-nums text-[40px] sm:text-[52px] leading-none"
        style={{ color: "var(--text-primary)" }}
      >
        {count}
      </span>
      <span className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
        {dotColor && (
          <span
            style={{
              background: dotColor,
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              display: "inline-block",
            }}
          />
        )}
        {label}
      </span>
    </div>
  );
}

function SummaryStrip({ members }: { members: Member[] }) {
  const roster = members.filter((m) => m.active);
  const active   = roster.filter((m) => m.status === "ACTIVE").length;
  const silent   = roster.filter((m) => m.status === "SILENT").length;
  const inactive = roster.filter((m) => m.status === "INACTIVE").length;
  const total    = roster.length;

  return (
    <div className="flex items-end gap-x-8 gap-y-4 flex-wrap">
      <StatBlock count={active}   label="active"   dotColor={STATUS_CONFIG.ACTIVE.color} />
      <StatBlock count={silent}   label="silent"   dotColor={STATUS_CONFIG.SILENT.color} />
      <StatBlock count={inactive} label="inactive" dotColor={STATUS_CONFIG.INACTIVE.color} />
      <StatBlock count={total}    label="members" />
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────────

export default function RosterPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<string | null>(null);

  const [statusFilters, setStatusFilters] = useState<Set<Status>>(new Set());
  const [yearSort, setYearSort] = useState<"asc" | "desc" | null>(null);

  useEffect(() => {
    fetch("/api/members")
      .then((r) => {
        if (!r.ok) throw new Error(`API error ${r.status}`);
        return r.json();
      })
      .then((data: Member[]) => {
        setMembers(data);
        setIsLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setIsLoading(false);
      });

    fetch("/api/pipeline/latest")
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          const ts = data.finished_at ?? data.started_at;
          setPipelineStatus(`last run ${ts?.slice(0, 10) ?? "unknown"} · ${data.status}`);
        }
      })
      .catch(() => {});
  }, []);

  const toggleStatus = (s: Status) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const activeMembers = members.filter((m) => {
      if (!m.active) return false;
      if (statusFilters.size > 0 && !statusFilters.has(m.status)) return false;
      return true;
    });

    if (!yearSort) return activeMembers;

    return [...activeMembers].sort((a, b) => {
      if (a.year === null) return 1;
      if (b.year === null) return -1;
      return yearSort === "asc" ? a.year - b.year : b.year - a.year;
    });
  }, [members, statusFilters, yearSort]);

  const dbEmpty = !isLoading && !error && members.length === 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>

      {/* ── top bar ── */}
      <header className="flex items-center justify-between gap-3 px-5 sm:px-8 py-5 w-full max-w-[1360px] mx-auto">
        <div className="flex items-center gap-4 min-w-0">
          <span
            className="display text-[22px] font-bold tracking-[0.06em] uppercase shrink-0"
            style={{ color: "var(--text-primary)" }}
          >
            amDash
          </span>
          <span
            className="text-[13px] truncate hidden sm:inline"
            style={{ color: "var(--text-muted)" }}
          >
            amFOSS · member activity
          </span>
        </div>

        {/* pipeline strip — the white counter-surface */}
        <div className="flex items-center gap-3 shrink-0">
          <span
            className="hidden sm:inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium"
            style={{ background: "var(--inverse)", color: "var(--text-on-inverse)" }}
          >
            <span
              style={{
                background: pipelineStatus ? "var(--accent)" : "var(--surface-3)",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                display: "inline-block",
              }}
              aria-hidden="true"
            />
            pipeline · {pipelineStatus ?? "not yet run"}
          </span>
          {error && (
            <span
              className="chip text-[12px]"
              style={{ color: "var(--danger)" }}
            >
              api unreachable
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col px-5 sm:px-8 pb-10 pt-2 gap-8 w-full max-w-[1360px] mx-auto">

        {/* ── hero numerals ── */}
        <SummaryStrip members={members} />

        {/* ── filter rows ── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] mr-1" style={{ color: "var(--text-muted)" }}>
              Status
            </span>
            {ALL_STATUSES.map((s) => (
              <FilterPill
                key={s}
                label={s.toLowerCase()}
                active={statusFilters.has(s)}
                color={STATUS_CONFIG[s].color}
                onClick={() => toggleStatus(s)}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] mr-1" style={{ color: "var(--text-muted)" }}>
              Sort
            </span>
            <FilterPill
              label={`year${yearSort === "asc" ? " ↑" : yearSort === "desc" ? " ↓" : ""}`}
              active={yearSort !== null}
              onClick={() => setYearSort((current) => (current === "asc" ? "desc" : "asc"))}
            />
          </div>
        </div>

        {/* ── member grid ── */}
        {isLoading ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
            {Array.from({ length: 8 }, (_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="notch-card">
            <span className="notch-card__bg" aria-hidden="true" />
            <p className="relative p-6 text-[14px]" style={{ color: "var(--danger)" }}>
              Could not reach the API: {error}
            </p>
          </div>
        ) : dbEmpty ? (
          <div className="notch-card">
            <span className="notch-card__bg" aria-hidden="true" />
            <p className="relative p-6 text-[14px]" style={{ color: "var(--warning)" }}>
              No status updates indexed yet — the pipeline has not run.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="notch-card">
            <span className="notch-card__bg" aria-hidden="true" />
            <p className="relative p-6 text-[14px]" style={{ color: "var(--text-muted)" }}>
              No members match the active filters.
            </p>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
            {filtered.map((m) => (
              <MemberCard key={m.id} member={m} />
            ))}
          </div>
        )}

        {/* ── cadence note ── */}
        <p className="text-[12px] leading-relaxed max-w-[68ch]" style={{ color: "var(--text-muted)" }}>
          Status is derived from{" "}
          <span style={{ color: "var(--text-secondary)" }}>emails.received_at</span>{" "}
          — it measures reporting discipline, not work. Thresholds: active
          &lt;3 days · silent at 3 days · inactive &gt;3 days (on probation).
        </p>
      </main>
    </div>
  );
}
