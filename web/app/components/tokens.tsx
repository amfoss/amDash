import { type Category, type Status } from "../data/members";
import { categoryConfig, STATUS_CONFIG } from "../data/categories";

// ── status token ─────────────────────────────────────────────────────────────
// Pill with a colored dot; the label always backs the color, never color alone.
// ACTIVE lime · SILENT amber · INACTIVE red. On lime surfaces the surrounding
// card overrides the chip/dot colors via CSS variables (see .member-card).

export function StatusToken({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className="chip font-medium uppercase tracking-[0.05em] text-[11px]">
      <span
        className="status-dot"
        style={{
          background: cfg.color,
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

// ── category chip ────────────────────────────────────────────────────────────
// Muted pill with a small hue dot; label always rendered.

export function CategoryChip({ category }: { category: Category }) {
  const cfg = categoryConfig(category);
  return (
    <span className="chip">
      <span
        style={{
          background: cfg.text,
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          flexShrink: 0,
          display: "inline-block",
        }}
      />
      {cfg.label}
    </span>
  );
}

// ── avatar pod ───────────────────────────────────────────────────────────────
// No member photos exist; initials in a circular pod stand in. Colors read
// from --pod-bg/--pod-ink so accent cards restyle the pod via CSS.

export function AvatarPod({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      className="display font-semibold"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: "var(--pod-bg, var(--surface-2))",
        color: "var(--pod-ink, var(--text-secondary))",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: `${Math.round(size * 0.36)}px`,
        flexShrink: 0,
      }}
    >
      {initials || "?"}
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
