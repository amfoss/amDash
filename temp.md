# amDash — build handoff

Written 2026-07-28. Everything needed to resume the hawk-eye dashboard build from an empty
conversation.

---

## 1. What this project is

`amRoundup` / **amDash** — a dashboard over amFOSS club member activity. Members email a daily
freeform status update to a shared Google Group; a batched LLM pipeline extracts structured
contributions from that mail; the dashboard presents the derived record.

The backend pipeline **already existed and works**. The current work is the **front end**: a
"hawk-eye" club-wide overview view.

Read these two files first — they are the durable authority and were written in this session:

- **`PRODUCT.md`** — product truth (users, purpose, constraints, principles).
- **`DESIGN.md`** — the visual system, "The Threshold Kolam". Normative.
- **`.impeccable/surfaces/web-app-page-tsx.md`** — the surface brief for the hawk-eye route
  specifically (scope, states, anti-goals).
- **`plan.md`** — the original architecture doc (pre-existing). Note its "front end deferred"
  and "front end likely Next.js" lines are now **resolved**, and its collaboration-graph
  assumption is **contradicted by real data** (see §5).

⚠️ **`PRODUCT.md`, `DESIGN.md` and `.impeccable/` are excluded from git** via
`.git/info/exclude` (lines 9, 15, 16). They exist on disk but `git status` will never show
them. Don't assume they're missing; don't try to `git add` them without removing those
exclude lines first.

---

## 2. Decisions already confirmed with the user

Do not re-litigate these; they were answered directly.

| Decision | Answer |
|---|---|
| Audience / access | **Fully transparent to the club** — any member can see any member's page and the roster |
| Front end | **Flask JSON API + separate Next.js (App Router) + TypeScript SPA** |
| Usage scene | **Both** — projected evaluation meetings *and* solo term-long laptop browsing, weighted equally |
| Brand | amFOSS **name and mark binding**; visual world otherwise open |
| Guardrail | **No cross-member ranking or leaderboards, ever.** All extracted data visible, but never ordered by volume/score |
| What the hawk-eye answers first | **"What is the club working on now"** — work leads, roster second |
| Interaction | **Spatial exploration.** User's words: "spatial navigation, a reactive sea of dots (like sound waves), spider webs are all inspirations" |
| Visual direction | **Kolam** — committed by the user after explanation. See §3 |

Still **undecided at product level** (do not silently resolve): auth model, Postgres migration,
batch cadence/size, GitHub enrichment for OSS impact.

---

## 3. The design direction (committed)

**"The Threshold Kolam"** — full spec in `DESIGN.md`.

Kolam = the rice-flour drawing made at a South Indian doorstep each dawn: a grid of dots
(*pulli*) laid first, then a single unbroken line (*sikku*) looped through and around them,
never crossing a dot. Walked away during the day, redrawn next morning from the same armature.

Structurally it is **a route map**: dots are the airports, each member is one continuous thread
through the dots they touched.

Mapping (this is the data model, not decoration):

- **Dots** = entities and events (the work). Dot **shape** = category, dot **diameter** =
  contribution count.
- **Threads** = members. One unbroken line per member through the dots they touched.
- **Spider web** = select a dot, every thread touching it pulls into a radial burst.
- **Cadence** = gaps in the line (a day with no report). Measures *reporting discipline, not
  work* — must be labelled as such wherever shown.
- **Smudge** = `parse_status = 'error'` emails, drawn as broken offset double strokes.
- **The daily 06:00 pipeline run** = the dawn redrawing. The drawing is derived and disposable;
  the mail underneath is canonical.
- No axis to sort on → **structurally incapable of a leaderboard**.

**Palette** (tokens live in `web/app/globals.css`): Laterite ground `#14100E` (warm near-black,
NOT blue-black, NOT neon-on-charcoal), Damp Earth panels `#221A16`, Faint Pulli armature
`#3A2F28`, Rice Flour drawing `#F2EDE4` (the only bright value), Chalk Dust secondary text
`#8C8178`. Category pigments: Kaavi `#A8432A`, Turmeric `#D69A2C`, Indigo `#2E4A7D`, Palm
`#4A7A52`.

**Key named rules from DESIGN.md:** The Chalk Rule (Rice Flour is the only bright value; no
glows), The Shape-First Rule (category legible with all pigment removed), The One Ground Rule
(two ground values only), The No-Float Rule (no `box-shadow` anywhere; depth is opacity only),
The Three-Lift Rule (max 3 elements at full opacity), The Measurement Rule (mono only for
numbers/dates/identifiers).

**Opacity ladder is the entire depth vocabulary:** Lifted 1.0 / Present 0.55 / Ghost 0.12.

**Explicitly rejected:** near-black-plus-neon "futuristic dashboard" (the category default, and
wrong about kolam which is chalk on earth). Also rejected: the Swiss modular poster wall
alternate — offered to the user, they chose kolam.

**Typography:** `Atkinson_Hyperlegible_Next` (variable 200–800) + `Atkinson_Hyperlegible_Mono`,
both via `next/font/google`. Chosen because it's drawn by the Braille Institute for character
distinction — the product's stated a11y need is legibility at projection distance in a dark
room. Note: plain `Atkinson Hyperlegible` only ships 400/700, which is why the "Next" cut is
used (the scale needs 600).

---

## 4. Environment gotchas (important)

- **`.venv/` is broken.** Its interpreter is a dangling nix symlink to a non-existent
  `/nix/store/...` path. Do not use it.
- **Working Python deps are at `.pylibs/`** (installed with `pip install --target`). Run
  everything as:
  ```bash
  PYTHONPATH=$PWD/.pylibs python3 <script>
  ```
  System python3 is 3.11.2. Installed: flask 3.1.3, flask-cors, anthropic, apscheduler,
  python-dotenv, requests.
- `.pylibs/`, `web/node_modules/`, `web/.next/`, `web/out/` were added to `.gitignore`.
- **Next.js 16.2.12** — `web/AGENTS.md` warns its conventions differ from training data. Docs
  are bundled at `web/node_modules/next/dist/docs/`. Turbopack is default; `middleware` is
  renamed `proxy`; request APIs are async. None of these bite the current build since data is
  fetched client-side from Flask.
- `npm audit` reports 12 high-severity transitive vulns (eslint chain, postcss via next,
  sharp/libvips). `npm audit fix` is a no-op; `--force` would downgrade Next itself. Left
  as-is deliberately.
- Real secrets are in `.env` (ROOT_API_KEY, AMD_EMAIL_ID, AMD_APP_PASSWORD,
  ANTHROPIC_API_KEY). Don't print them.

---

## 5. THE REAL DATA — and what it changes

**The database has real data.** An earlier read showed it empty and I wrongly assumed
pre-first-run; the user corrected this. `amdash.db`:

- **51 active members**, but only **20 have any contributions**
- **31 emails**, all `parse_status = 'done'` (→ **zero smudges to draw right now**)
- **66 contributions**, all `extraction_version = '0.2'`
- **17 entities** (5 seed + 12 auto), **6 events**
- **0 pipeline_runs rows** (the scheduler hasn't recorded a run)
- Date span: **2026-07-21 → 2026-07-28** (8 days only, not a term)

Contribution text is **short**: min 17 chars, p50 33, p90 60, max 108. Examples: "Attended
workshop", "Prepared for maths exam", "Made sheet to track juniors".

### Four findings that materially change the design

1. **Collaborators barely exist — 2 of 66 rows.** The plan's collaboration graph (edges =
   co-mentions) **cannot be built from co-mentions**. The fix already decided: the spider web
   becomes *"who touched this dot"*, which is real and richer — e.g. 8 members touched
   `workshop`. Shared-dot adjacency replaces co-mention entirely.

2. **The `unattached` dot is the single biggest dot (24 of 66 rows)** — every contribution with
   no `entity_id` AND no `event_id`. It is real work (exam prep, faction meetings, OSS
   issue-hunting), not junk. **Decided fix, NOT YET IMPLEMENTED:** split it into one dot per
   category (`unattached:academic`, `unattached:non-technical`, …) instead of one junk drawer.
   A single 24-row blob is dishonest. This was the in-flight edit when work stopped.

3. **Entity/event duplication.** `workshop` exists as BOTH an auto-created *entity* (13 rows,
   `category='event'`) and a seeded *event* (2 rows). Same for `praveshan`. The extractor is
   creating entities that duplicate seeded events. This is arguably an **extractor bug** worth
   raising with the user separately — the field will draw them as two separate dots for the
   same real thing.

4. **Only 8 days and 20 of 51 members with data.** The default 14-day window will often show
   the whole archive. Most roster rows are empty. The **empty/sparse state is the common case,
   not an edge case** — it must teach rather than look broken. Density tuning for 35 threads is
   currently untestable.

⚠️ A `seed_synthetic.py` was written earlier and then **deleted** — it was never run, and the
user confirmed real data exists. Do not recreate it.

---

## 6. What is built so far

### Done

- **`PRODUCT.md`** — written, complete.
- **`DESIGN.md`** — written as a SEED (carries the seed marker comment; re-run
  `/impeccable document` after implementation to capture real tokens + write the
  `.impeccable/design.json` sidecar, which does NOT exist yet).
- **`.impeccable/surfaces/web-app-page-tsx.md`** — surface brief written via
  `surface-brief.mjs`.
- **`web/`** — Next.js 16 scaffolded (`--ts --app --no-src-dir --no-tailwind --eslint`).
- **`web/app/globals.css`** — REWRITTEN with all kolam design tokens. Done.
- **`web/app/layout.tsx`** — REWRITTEN with Atkinson fonts + metadata. Done.
- **`app.py`** — FULLY REWRITTEN from throwaway inline-Jinja templates into a JSON API.
  Smoke-tested and working:
  - `GET /api/health`
  - `GET /api/meta` → categories, event_roles, spans, pipeline_runs, parse_status, counts
  - `GET /api/field?from=&to=` → the whole drawing in one request: `dots`, `threads`,
    `members` (with `cadence` bool array + `last_report`), `contributions`, `smudges`
  - `GET /api/dot/<entity|event>/<id>` → the fan (full history, newest first)
  - `GET /api/email/<id>` → provenance terminus (raw body + extracted rows)
  - CORS allows `http://localhost:3000` (override via `CORS_ORIGINS`)
  - Window defaults to the last 14 days **of data that exists**, clamped to the archive rather
    than to today — deliberate, so an idle pipeline doesn't render an empty field.

  Verified payload: 18 dots, 20 threads, 51 members, 66 contributions, ~44KB — small enough to
  send whole.

### Not started

- `web/app/page.tsx` and `web/app/page.module.css` are still **the untouched create-next-app
  boilerplate**. The direction contract (required by the playbook: 5 blocks, ≤150 words,
  THESIS / OWN-WORLD / STORY / FIRST VIEWPORT / FORM, seed key `08718f0c`) must be written as
  the opening comment of `page.tsx` before building it.
- The kolam field itself (SVG armature, identity-derived stable dot placement, category glyph
  set, thread path generation, pan/zoom).
- The four interactions (thread lift, radial web, dot fan → raw email, day scrubber).
- The plate view (full-parity sortable text table; keyboard + screen-reader equivalent; primary
  surface under 640px; must NOT offer any quality-measure sort).
- Consent line ("your updates are parsed and surfaced") — required once, plainly, on this route.
- Detector run + finish review.

### Open task list

```
#1 [completed] Write surface brief for hawk-eye field
#2 [completed] Scaffold Next.js front end
#3 [in_progress] Build Flask JSON API endpoints   ← endpoints work; the unattached-split fix from §5.2 is the remaining piece
#5 [pending] Build the kolam field
#6 [pending] Build the four interactions
#7 [pending] Build the plate view
#8 [pending] Run detector and finish review
```
(#4, synthetic data, was deleted as obsolete.)

---

## 7. Git state

Branch `master`, based on `6b57a54`. Uncommitted:

```
 M .gitignore     (added .pylibs/, web/node_modules/, web/.next/, web/out/)
 M app.py         (full rewrite: Jinja templates → JSON API)
?? web/           (entire Next.js app, untracked)
```

Plus `PRODUCT.md`, `DESIGN.md`, `.impeccable/surfaces/` on disk but git-excluded (see §1).

Nothing has been committed. No branch was created (work is directly on master — worth
branching before committing).

---

## 8. How to run

```bash
# API (terminal 1)
cd /home/hridesh/coding/repositories/amRoundup
PYTHONPATH=$PWD/.pylibs python3 app.py            # → :5000

# Front end (terminal 2)
npm --prefix web run dev                           # → :3000
```

Quick API check without a server:

```bash
PYTHONPATH=$PWD/.pylibs python3 -c "
import app as A; c=A.app.test_client()
f=c.get('/api/field').get_json()
print(len(f['dots']),'dots',len(f['threads']),'threads')
"
```

---

## 9. Immediate next steps, in order

1. Apply the **unattached-split fix** (§5.2) in `app.py` — one dot per category instead of one
   24-row junk dot.
2. Decide whether to raise the **entity/event duplication** (§5.3) with the user as an
   extractor bug. It affects what the field draws, so it shouldn't be silently papered over.
3. Write the **direction contract** as the opening comment of `web/app/page.tsx` (seed key
   `08718f0c`, form = kolam, chosen over the roll's botanical-plate assignment because the user
   pinned the inspiration).
4. Build the field, then the interactions, then the plate view.
5. Run `node .claude/skills/impeccable/scripts/detect.mjs --json web/app/page.tsx <other
   changed UI files>` — **once**, after the UI is finished, not during.
6. Spawn `impeccable-finish-reviewer` (never inside the build thread) with: the original
   request, the confirmed answers in §2, the artifact path, its direction contract, DESIGN.md,
   and any detector findings. Its first check is that PRODUCT.md + DESIGN.md exist and
   DESIGN.md matches what was built.
7. Re-run `/impeccable document` to convert the DESIGN.md seed into real extracted tokens and
   generate `.impeccable/design.json`.

### Design constraints that must not be violated while building

- No `box-shadow`, glow, bloom, or decorative blur anywhere.
- No bright backgrounds — Rice Flour is a drawing color, never a surface.
- No sorting/ranking members by volume or any derived quality measure, in the field or the
  plate.
- No effort/impact/quality number for a person.
- Category must be legible with all pigment removed (shape carries it).
- Max 3 elements at Lifted opacity.
- Threads loop *around* dots, never cross them.
- Mono only for numbers, dates, identifiers.
- OSS work is claims + links, never presented as verified impact.
- Cadence surfaces must state they measure reporting discipline, not work.
- Entity slugs render exactly as stored, lowercase.
- `prefers-reduced-motion` gets a static redraw with no propagation; motion is bounded to
  ~600ms and conveys state only.
