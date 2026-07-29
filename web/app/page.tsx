"use client";

import { useState, useMemo, useEffect } from "react";
import { type Member, type Category, type Status } from "./data/members";

// ── category display config ────────────────────────────────────────────────────

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

const STATUS_CONFIG: Record<Status, { color: string; glow: string }> = {
  ACTIVE:   { color: "#4ADE80", glow: "rgba(74,222,128,0.12)"  },
  SILENT:   { color: "#F87171", glow: "rgba(248,113,113,0.12)" },
  INACTIVE: { color: "#3A4560", glow: "transparent"            },
};

const ALL_STATUSES: Status[] = ["ACTIVE", "SILENT"];
const ALL_CATEGORIES: Category[] = [
  "club-project", "open-source", "learning", "competitive-programming",
  "academic", "hackathon", "event", "non-technical", "other",
];

// ── helpers ────────────────────────────────────────────────────────────────────

function formatDaysAgo(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
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
        background: cfg.glow,
        border: `1px solid ${cfg.color}33`,
      }}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-bold tracking-[0.06em] uppercase"
    >
      <span
        style={{
          background: cfg.color,
          boxShadow: `0 0 5px ${cfg.color}, 0 0 2px ${cfg.color}`,
          width: "6px",
          height: "6px",
          borderRadius: "50%",
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

function MemberRow({ member, index }: { member: Member; index: number }) {
  const [hovered, setHovered] = useState(false);

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#0F1420" : "transparent",
        animationDelay: `${index * 18}ms`,
        animationFillMode: "both",
      }}
      className="border-b border-[var(--border-subtle)] transition-colors duration-75 cursor-pointer"
    >
      {/* name */}
      <td className="py-3 pl-5 pr-6" style={{ minWidth: "160px" }}>
        <a
          href={`/member/${member.id}`}
          className="text-[14px] font-medium hover:underline underline-offset-4"
          style={{
            color: "var(--text-primary)",
            textDecorationColor: "var(--text-muted)",
          }}
        >
          {member.name}
        </a>
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

      {/* last update */}
      <td
        className="py-3 pr-6 text-[12px] tabular-nums"
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
  const active = members.filter((m) => m.status === "ACTIVE").length;
  const silent = members.filter((m) => m.status === "SILENT").length;
  const total  = members.length;

  return (
    <div
      className="flex items-center gap-5 text-[11px] tracking-[0.06em] uppercase"
      style={{ color: "var(--text-muted)" }}
    >
      <span className="flex items-center gap-1.5">
        <span
          style={{
            background: "#4ADE80",
            boxShadow: "0 0 4px #4ADE80",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            display: "inline-block",
          }}
        />
        <span style={{ color: "#4ADE80" }} className="font-bold">{active}</span>
        <span>active</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span
          style={{
            background: "#F87171",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            display: "inline-block",
          }}
        />
        <span style={{ color: "#F87171" }} className="font-bold">{silent}</span>
        <span>silent</span>
      </span>
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

  const [statusFilters, setCategoryStatus] = useState<Set<Status>>(new Set());
  const [categoryFilters, setCategoryFilters] = useState<Set<Category>>(new Set());
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
    setCategoryStatus((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const toggleCategory = (c: Category) => {
    setCategoryFilters((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  };

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (!m.active) return false;
      if (statusFilters.size > 0 && !statusFilters.has(m.status)) return false;
      if (
        categoryFilters.size > 0 &&
        !m.activeCategories.some((c) => categoryFilters.has(c))
      )
        return false;
      return true;
    });
  }, [members, statusFilters, categoryFilters]);

  const dbEmpty = !isLoading && !error && members.length === 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>

      {/* ── top bar ── */}
      <header
        className="flex items-center justify-between px-6 py-3.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-[15px] font-bold tracking-[0.1em] uppercase"
            style={{ color: "var(--text-primary)" }}
          >
            amDash
          </span>
          <span
            className="text-[11px] tracking-[0.04em]"
            style={{
              color: "var(--text-muted)",
              borderLeft: "1px solid var(--border)",
              paddingLeft: "12px",
            }}
          >
            amFOSS · member activity
          </span>
        </div>

        <div className="flex items-center gap-3">
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

      <main className="flex-1 flex flex-col px-6 py-5 gap-4 w-full max-w-6xl mx-auto">

        {/* ── summary ── */}
        <SummaryStrip members={members} />

        {/* ── filter bar ── */}
        <div className="flex flex-wrap items-start gap-4">
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

          <div
            style={{ width: "1px", background: "var(--border)", alignSelf: "stretch" }}
          />

          {/* category */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[10px] tracking-[0.08em] uppercase mr-1"
              style={{ color: "var(--text-muted)" }}
            >
              category
            </span>
            {ALL_CATEGORIES.map((c) => (
              <FilterChip
                key={c}
                label={CATEGORY_CONFIG[c].label}
                active={categoryFilters.has(c)}
                color={CATEGORY_CONFIG[c].text}
                onClick={() => toggleCategory(c)}
              />
            ))}
          </div>

        </div>

        {/* ── table ── */}
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <table className="w-full border-collapse text-left">
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
                  <td
                    colSpan={6}
                    className="py-10 pl-5 text-[13px]"
                    style={{ color: "#F87171" }}
                  >
                    [ ERROR ] Could not reach API: {error}
                  </td>
                </tr>
              ) : dbEmpty ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 pl-5 text-[13px]"
                    style={{ color: "#FBBF24" }}
                  >
                    [ WARN ] No status updates indexed yet. Pipeline has not run.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 pl-5 text-[12px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    [ INFO ] No members match the active filters.
                  </td>
                </tr>
              ) : (
                filtered.map((m, i) => (
                  <MemberRow key={m.id} member={m} index={i} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── cadence note ── */}
        <p
          className="text-[11px] leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
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
