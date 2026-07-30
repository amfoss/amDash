import { type Category, type Status } from "../data/members";
import { categoryConfig, STATUS_CONFIG } from "../data/categories";

// ── status token ─────────────────────────────────────────────────────────────
// INACTIVE reads as a quiet dropout (bare label); ACTIVE/SILENT are live signals
// carried by a bordered token with a phosphor dot. Color is backed by the label,
// never carried by color alone.

export function StatusToken({ status }: { status: Status }) {
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
      style={{ color: cfg.color, border: `1px solid ${cfg.color}44` }}
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

// ── category chip ────────────────────────────────────────────────────────────

export function CategoryChip({ category }: { category: Category }) {
  const cfg = categoryConfig(category);
  return (
    <span
      style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.text}22` }}
      className="inline-flex items-center px-1.5 py-px rounded-sm text-[11px] tracking-[0.01em] whitespace-nowrap"
    >
      {cfg.label}
    </span>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

export function formatDaysAgo(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}
