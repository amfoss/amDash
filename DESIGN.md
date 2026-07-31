# amDash — Design System

<!-- impeccable:design-authority — replaces the previous terminal/dmesg world. Derived from two user-pinned reference dashboards (dark CRM workspace, notched cards, single vivid accent). Accent committed: lime/chartreuse. -->

## Thesis

A dark operations workspace where **exactly one thing glows**. The canvas is near-black and calm; every card, chip, and control is a soft dark shape with generous radius; the single lime accent is spent only on the one item that needs attention right now (the priority member, the current task, the live pipeline run). Everything else earns hierarchy through scale, weight, and whitespace — never through extra color.

This replaces the former terminal/boot-log aesthetic entirely. No `[ INFO ]`/`[ WARN ]` log framing, no phosphor-terminal styling, no mono-everything.

## Color

Strategy: **Restrained** — deep neutrals + one accent, with an inverted white surface as a secondary material.

| Token | Value | Role |
|---|---|---|
| `--bg` | `#0C0C0E` | Page canvas (near-black, slightly warm) |
| `--surface` | `#1A1B1E` | Cards, panels |
| `--surface-2` | `#242528` | Nested chips, inputs, tag pills on cards |
| `--surface-3` | `#2E2F33` | Hover states, pressed chips |
| `--border` | `#2A2B2F` | Hairline card/chip borders (1px, low contrast) |
| `--inverse` | `#FFFFFF` | Inverted surfaces: top schedule bar, active filter pill, floating summary panels |
| `--text` | `#F4F5F7` | Primary text on dark |
| `--text-dim` | `#9A9CA3` | Secondary text, labels |
| `--text-faint` | `#6E7076` | Tertiary/meta text |
| `--text-on-inverse` | `#121316` | Text on white surfaces and on accent |
| `--accent` | `#C9F158` | The lime. Priority card fill, live indicators, count badges |
| `--accent-ink` | `#1A2405` | Text/icons sitting on accent fill |
| `--positive` | `#8FE388` | Small deltas/up badges only |
| `--warning` | `#F5C451` | SILENT status dot, caution badges |
| `--danger` | `#F87171` | INACTIVE status, destructive, "lost" badges |

Rules:
- Accent paints **whole regions** (one full card per section, a badge, a timeline marker) — never scattered tints, glows, or gradients.
- No card is permanently accent-filled. On the roster, ACTIVE member cards flood lime on hover/focus (text, pod, and chips flip to `--accent-ink`); at rest every card is neutral dark.
- Status semantics: ACTIVE = accent lime, SILENT = warning amber, INACTIVE = danger red — shown as dot + label, color never the only signal (keep this existing rule from `web/app/data/categories.ts`).
- Category chips stay muted `--surface-2` pills with dim text; their existing hue dots may remain as small leading dots.
- Dark only. The white `--inverse` material is a deliberate counter-surface (top bar, active pill, overlay panels), not a light mode.

## Typography

Two-face system replacing IBM-Plex-Mono-everywhere:

- **Display / headings**: a wide geometric grotesque with personality (reference uses an extended sans — e.g. self-hosted *Archivo Expanded* or similar wide grotesque). Section titles set large and confident ("New Leads", "Your Days Tasks" scale). The wordmark `amDash` in caps, wide-tracked, with one stylized character permitted (the reference's crossed-W move).
- **UI / body**: a clean grotesque (e.g. self-hosted *Archivo* / comparable). All controls, cards, meta.
- **Numerals as heroes**: KPI numbers (member counts, active/silent/inactive tallies) set at display size (48–64px) with their unit as a small dim word beside them, plus an optional tiny colored delta badge.
- Mono is retired except optionally for timestamps/IDs inside the email-evidence modal.

Scale: 12 (meta) · 13 (chips/labels) · 15 (body) · 18 (card titles) · 24 (section headers) · 40–64 (KPIs, wordmark). Weights: 400 body, 500 UI, 600–700 display.

## Shape & material

- **Radius is the identity**: cards 24px; chips/pills fully rounded; inputs and dropdowns pill-shaped; avatars circular.
- **Notched cards** — the signature move: person/task cards carve a rounded notch out of the top corner(s); circular icon buttons (expand ↗, bell) sit *inside* the notch, visually punched out of the card against the page canvas. Implement via CSS mask/`clip-path` or an SVG path, not fake overlays.
- Avatar sits in its own top-left rounded pod on the card (reference pattern), name below at 18px, role/meta line under it in `--text-dim`.
- Borders are 1px `--border`, or none where surface contrast suffices. **No shadows, no glass, no gradients** — depth comes from surface steps and the notch cutouts.
- Circular icon buttons: 36–40px, `--surface` fill or 1px outline, single-glyph icon.

## Components

- **Top schedule bar** (optional adaptation): full-width white pill strip; in amDash this becomes the *pipeline strip* — last run time, next run, and a lime segment when a run is live.
- **Section header row**: big display title + small count pill (`7 Leads` pattern → `42 Members`), right-aligned control cluster: circular search + sort buttons, then filter pills.
- **Filter pills**: horizontal row; active pill is solid white with dark text; inactive pills are outlined `--border` with `--text-dim`. Status filters may carry a leading dot/emoji-scale glyph. This replaces the current square chips.
- **Member card** (roster): notched dark card — avatar pod, name, "Year 3 · @githubUser" meta, `Source`-style row of category chips, colored status dot row. Priority/most-recent card may be lime-filled with `--accent-ink` text.
- **Task/contribution card**: header strip with avatar + name, body with big icon-led title (contribution summary), date/meta row, footer pill dropdown (`Status: ACTIVE ⌄`) + trailing circular action icons.
- **Stat row**: 2–4 hero numerals with unit words and delta badges (e.g. `34 Active`, `5 Silent`, `3 Inactive` — danger badge).
- **Floating panels** (email-evidence modal): white `--inverse` rounded 24px panel over the dark canvas, document thumbnails as small white cards, timestamps in a slim left rail — reference's "Summary" panel grammar.
- **Left rail**: slim vertical stack of circular icon buttons for primary views, floated on the canvas (no full sidebar).

## Layout

- Canvas max-width ~1280–1440px, 24px gutters; card grids 3–4 across, 16–20px gaps.
- Generous vertical rhythm: 40–56px between sections; section header sits closer to its own cards than to the previous section.
- Density lives inside cards; the canvas between them stays airy.

## Motion

- 150–200ms ease-out on hover (surface step up, subtle −2px lift on cards); pill fill transitions on filter change.
- Lime priority card may pulse its live-dot only — no glowing or animated borders.
- Respect `prefers-reduced-motion` (keep existing handling).

## Accessibility

- Keep: labels always accompany color, `:focus-visible` rings (use `--accent` 2px ring on dark), reduced-motion support.
- Text on accent uses `--accent-ink` (lime fails with white text). `--text-dim` stays ≥ 4.5:1 on `--surface`.
- Notch icon buttons need ≥ 40px hit areas and `aria-label`s.

## What must not change

Product truth and behavior: statuses/thresholds, the 10 categories, routes, API, copy accuracy ("measures reporting, not work" disclaimer stays, restyled as a normal footnote). This document restyles the world; it does not alter data or claims.
