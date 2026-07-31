"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { type Member, type Category, type Status } from "./data/members";
import { STATUS_CONFIG, ALL_STATUSES } from "./data/categories";
import { StatusToken, CategoryChip, formatDaysAgo } from "./components/tokens";

// ── sub-components ─────────────────────────────────────────────────────────────

function CategoryChips({ categories }: { categories: Category[] }) {
  const visible = categories.slice(0, 4);
  const overflow = categories.length - 4;
  return (
    <span className="flex flex-wrap gap-1 items-center">
      {visible.map((c) => (
        <CategoryChip key={c} category={c} />
      ))}
      {overflow > 0 && (
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          +{overflow}
        </span>
      )}
    </span>
  );
}

function FilterChip({
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
    <button
      onClick={onClick}
      aria-pressed={active}
      style={
        active
          ? {
              borderColor: color ?? "var(--accent)",
              color: color ?? "var(--accent)",
              background: color ? `${color}15` : "rgba(59,130,246,0.08)",
            }
          : {
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
              background: "transparent",
            }
      }
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 border rounded-sm text-[11px] tracking-[0.05em] uppercase cursor-pointer transition-colors duration-100 hover:border-current"
    >
      {color && (
        <span
          style={{
            background: color,
            opacity: active ? 1 : 0.35,
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

function MemberRow({ member }: { member: Member }) {
  const [hovered, setHovered] = useState(false);
  const router = useRouter();
  const navigate = useCallback(() => router.push(`/member/${member.id}`), [router, member.id]);

  return (
    <tr
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? "#0F1420" : "transparent" }}
      className="border-b border-[var(--border-subtle)] transition-colors duration-75 cursor-pointer"
    >
      {/* name */}
      <td className="py-3 pl-5 pr-6" style={{ minWidth: "160px" }}>
        <span className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
          {member.name}
        </span>
        {member.githubHandle && (
          <span className="block text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            @{member.githubHandle}
          </span>
        )}
      </td>

      {/* status */}
      <td className="py-3 pr-6" style={{ width: "110px" }}>
        <StatusToken status={member.status} />
      </td>

      {/* year */}
      <td
        className="py-3 pr-6 text-[12px] tabular-nums whitespace-nowrap"
        style={{ width: "64px", color: "var(--text-secondary)" }}
      >
        {member.year ?? "—"}
      </td>

      {/* last update */}
      <td
        className="py-3 pr-6 text-[12px] tabular-nums whitespace-nowrap"
        style={{
          width: "96px",
          color:
            member.lastUpdateDaysAgo !== null && member.lastUpdateDaysAgo <= 7
              ? "var(--text-secondary)"
              : "var(--text-muted)",
        }}
      >
        {formatDaysAgo(member.lastUpdateDaysAgo)}
      </td>

      {/* categories */}
      <td className="py-3 pr-6">
        <CategoryChips categories={member.activeCategories} />
      </td>

      {/* contrib count */}
      <td
        className="py-3 pr-4 text-[12px] tabular-nums text-right"
        style={{ width: "64px", color: "var(--text-secondary)" }}
      >
        {member.contribCount > 0 ? member.contribCount : "—"}
      </td>

      {/* arrow */}
      <td className="py-3 pr-4 text-right" style={{ width: "24px" }}>
        <span
          style={{
            opacity: hovered ? 1 : 0,
            color: "var(--text-muted)",
            transition: "opacity 120ms ease-out",
            fontSize: "12px",
          }}
          aria-hidden="true"
        >
          →
        </span>
      </td>
    </tr>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-[var(--border-subtle)]">
      <td className="py-3 pl-5 pr-6">
        <span className="skeleton block h-3 rounded-sm" style={{ width: "120px" }} />
        <span className="skeleton block h-2.5 rounded-sm mt-1.5" style={{ width: "80px" }} />
      </td>
      <td className="py-3 pr-6">
        <span className="skeleton block h-5 rounded-sm" style={{ width: "72px" }} />
      </td>
      <td className="py-3 pr-6">
        <span className="skeleton block h-3 rounded-sm" style={{ width: "24px" }} />
      </td>
      <td className="py-3 pr-6">
        <span className="skeleton block h-3 rounded-sm" style={{ width: "48px" }} />
      </td>
      <td className="py-3 pr-6">
        <span className="skeleton block h-5 rounded-sm" style={{ width: "144px" }} />
      </td>
      <td className="py-3 pr-4">
        <span className="skeleton block h-3 rounded-sm ml-auto" style={{ width: "24px" }} />
      </td>
      <td className="py-3 pr-4" />
    </tr>
  );
}

// ── summary strip ──────────────────────────────────────────────────────────────

function SummaryStrip({ members }: { members: Member[] }) {
  const roster = members.filter((m) => m.active);
  const active   = roster.filter((m) => m.status === "ACTIVE").length;
  const silent   = roster.filter((m) => m.status === "SILENT").length;
  const inactive = roster.filter((m) => m.status === "INACTIVE").length;
  const total    = roster.length;

  const Signal = ({ color, count, label }: { color: string; count: number; label: string }) => (
    <span className="flex items-center gap-1.5">
      <span
        style={{
          background: color,
          boxShadow: `0 0 5px ${color}`,
          width: "5px",
          height: "5px",
          borderRadius: "1px",
          display: "inline-block",
        }}
      />
      <span style={{ color }} className="font-bold">{count}</span>
      <span>{label}</span>
    </span>
  );

  return (
    <div
      className="flex items-center gap-x-5 gap-y-1.5 flex-wrap text-[11px] tracking-[0.06em] uppercase"
      style={{ color: "var(--text-muted)" }}
    >
      <Signal color={STATUS_CONFIG.ACTIVE.color}   count={active}   label="active" />
      <Signal color={STATUS_CONFIG.SILENT.color}   count={silent}   label="silent" />
      <Signal color={STATUS_CONFIG.INACTIVE.color} count={inactive} label="inactive" />
      <span style={{ opacity: 0.3 }}>|</span>
      <span>{total} members</span>
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
      <header
        className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="text-[15px] font-bold tracking-[0.1em] uppercase shrink-0"
            style={{ color: "var(--text-primary)" }}
          >
            amDash
          </span>
          <span
            className="text-[11px] tracking-[0.04em] truncate hidden sm:inline"
            style={{
              color: "var(--text-muted)",
              borderLeft: "1px solid var(--border)",
              paddingLeft: "12px",
            }}
          >
            amFOSS · member activity
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            pipeline:{" "}
            <span style={{ color: "var(--text-secondary)" }}>
              {pipelineStatus ?? "not yet run"}
            </span>
          </span>
          {error && (
            <span
              className="text-[11px] tracking-[0.04em] px-2.5 py-0.5 rounded-sm"
              style={{
                background: "#2A0A0A",
                color: "#F87171",
                border: "1px solid #F8717122",
              }}
            >
              api unreachable
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col px-4 sm:px-6 py-5 gap-4 w-full max-w-6xl mx-auto">

        {/* ── summary ── */}
        <SummaryStrip members={members} />

        {/* ── filter bar ── */}
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          {/* status */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[10px] tracking-[0.08em] uppercase mr-1"
              style={{ color: "var(--text-muted)" }}
            >
              status
            </span>
            {ALL_STATUSES.map((s) => (
              <FilterChip
                key={s}
                label={s}
                active={statusFilters.has(s)}
                color={STATUS_CONFIG[s].color}
                onClick={() => toggleStatus(s)}
              />
            ))}
          </div>

        </div>

        {/* ── table ── */}
        <div
          className="overflow-x-auto"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "4px",
          }}
        >
          <table className="w-full border-collapse text-left" style={{ minWidth: "640px" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border)",
                  background: "var(--surface)",
                }}
              >
                <th
                  className="py-2.5 pl-5 pr-6 text-[10px] tracking-[0.12em] uppercase font-normal"
                  style={{ color: "var(--text-muted)" }}
                >
                  name
                </th>
                <th
                  className="py-2.5 pr-6 text-[10px] tracking-[0.12em] uppercase font-normal"
                  style={{ color: "var(--text-muted)", width: "110px" }}
                >
                  status
                </th>
                <th
                  className="py-2.5 pr-6 text-[10px] tracking-[0.12em] uppercase font-normal"
                  style={{ color: "var(--text-muted)", width: "64px" }}
                >
                  <button
                    type="button"
                    onClick={() => setYearSort((current) => current === "asc" ? "desc" : "asc")}
                    className="cursor-pointer hover:text-[var(--text-primary)] transition-colors"
                    aria-label={`Sort by year ${yearSort === "asc" ? "descending" : "ascending"}`}
                  >
                    year{yearSort === "asc" ? " ↑" : yearSort === "desc" ? " ↓" : ""}
                  </button>
                </th>
                <th
                  className="py-2.5 pr-6 text-[10px] tracking-[0.12em] uppercase font-normal"
                  style={{ color: "var(--text-muted)", width: "96px" }}
                >
                  last update
                </th>
                <th
                  className="py-2.5 pr-6 text-[10px] tracking-[0.12em] uppercase font-normal"
                  style={{ color: "var(--text-muted)" }}
                >
                  categories
                </th>
                <th
                  className="py-2.5 pr-4 text-[10px] tracking-[0.12em] uppercase font-normal text-right"
                  style={{ color: "var(--text-muted)", width: "64px" }}
                >
                  contributions
                </th>
                <th style={{ width: "24px" }} />
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                Array.from({ length: 10 }, (_, i) => <SkeletonRow key={i} />)
              ) : error ? (
                <tr>
                  <td colSpan={7} className="py-10 pl-5 text-[13px]" style={{ color: "#F87171" }}>
                    [ ERROR ] Could not reach API: {error}
                  </td>
                </tr>
              ) : dbEmpty ? (
                <tr>
                  <td colSpan={7} className="py-10 pl-5 text-[13px]" style={{ color: "#FBBF24" }}>
                    [ WARN ] No status updates indexed yet. Pipeline has not run.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 pl-5 text-[12px]" style={{ color: "var(--text-muted)" }}>
                    [ INFO ] No members match the active filters.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <MemberRow key={m.id} member={m} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── cadence note ── */}
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          status is derived from{" "}
          <em style={{ color: "var(--text-secondary)", fontStyle: "normal" }}>
            emails.received_at
          </em>{" "}
          — it measures reporting discipline, not work.&nbsp; thresholds: active
          &lt;3 days · silent at 3 days · inactive &gt;3 days (on probation).
        </p>
      </main>
    </div>
  );
}
