import { type Category, type Status } from "./members";

// ── category display config ──────────────────────────────────────────────────
// Single source of truth for chip colors, labels, and ordering. Color is never
// the only distinguisher — the label is always rendered inside the chip.

export const CATEGORY_CONFIG: Record<Category, { label: string; bg: string; text: string }> = {
  "club-project":            { label: "club-project",            bg: "#1E3A5F", text: "#93C5FD" },
  "personal-project":        { label: "personal-project",        bg: "#331E14", text: "#FDBA74" },
  "open-source":             { label: "open-source",             bg: "#1A3A2A", text: "#86EFAC" },
  "learning":                { label: "learning",                bg: "#2D2A1A", text: "#FDE68A" },
  "competitive-programming": { label: "competitive-programming", bg: "#2A1A3A", text: "#C4B5FD" },
  "academic":                { label: "academic",                bg: "#2A2020", text: "#FCA5A5" },
  "hackathon":               { label: "hackathon",               bg: "#1A2A2A", text: "#67E8F9" },
  "event":                   { label: "event",                   bg: "#2A1F10", text: "#FCD34D" },
  "non-technical":           { label: "non-technical",           bg: "#252525", text: "#D1D5DB" },
  "other":                   { label: "other",                   bg: "#1E1E1E", text: "#6B7280" },
};

// Fallback for any category the pipeline emits that predates this config.
export const CATEGORY_FALLBACK = { bg: "#1E1E1E", text: "#6B7280" };

export function categoryConfig(category: Category) {
  return CATEGORY_CONFIG[category] ?? { label: category, ...CATEGORY_FALLBACK };
}

// Display order: projects first, then activity, then study, then catch-alls.
export const CATEGORY_ORDER: Category[] = [
  "club-project",
  "personal-project",
  "open-source",
  "event",
  "hackathon",
  "non-technical",
  "learning",
  "competitive-programming",
  "academic",
  "other",
];

// ── status display config ────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<Status, { color: string; bg: string; border: string }> = {
  ACTIVE:   { color: "#C9F158", bg: "rgba(201, 241, 88, 0.12)",  border: "rgba(201, 241, 88, 0.28)"  },
  SILENT:   { color: "#F5C451", bg: "rgba(245, 196, 81, 0.12)",  border: "rgba(245, 196, 81, 0.28)"  },
  INACTIVE: { color: "#F87171", bg: "rgba(248, 113, 113, 0.12)", border: "rgba(248, 113, 113, 0.28)" },
};

export const ALL_STATUSES: Status[] = ["ACTIVE", "SILENT", "INACTIVE"];
