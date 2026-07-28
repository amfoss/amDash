# amDash — Member Activity Dashboard: Architecture & Approach

## Context

A hawk-eye dashboard over ~30–35 club members, for **leads and faculty** to understand and measure what
each member is working on — used during membership evaluations.

The source of truth is the **daily status-update email** each member sends to a common Google Group.
These updates have **no fixed format**. Mail ingestion is already solved (existing IMAP demo, outside
this repo).

---

## The core model: work as three orthogonal dimensions

Every extracted **contribution** carries three independent dimensions:

1. **Category** — a small *controlled* enum: the stream of effort. Fixed, rarely changes. Primary lens:
   `club-project` · `open-source` · `non-technical` · `academic` · `hackathon` ·
   `learning` · `competitive-programming` · `event` · `other`

2. **Entity** — the specific thing within the category. Some categories map onto **curated lists**
   (club projects); others are **open-ended** (which OSS repo, which course, which CP platform). The LLM
   *maps onto* the known list and only proposes a normalized new entity when nothing fits.

3. **Event + role** — a link to a first-class club activity, carrying *how the member engaged*. Events are
   the annual/recurring things the club **does**: Hacktoberfest (organized at the college), Praveshan
   (recruitment), GSoC (prepared toward), Workshops, fosstalk (a member gives a public talk), fossplay
   (members go out and play). What matters for evaluation is the member's **role/engagement**.

   So "we ran the Hacktoberfest booth" = event `hacktoberfest` + role `organize`; "grinding toward GSoC"
   = event `gsoc` + role `prepare-for` (+ category `open-source`); "gave a fosstalk on Nix" = event
   `fosstalk` + role `present`.

One email → possibly **many** contribution rows. Everything on the dashboard rolls up from this.

---

## Pipeline (end to end)

```
[existing IMAP fetcher]
      │  raw messages
      ▼
(1) RAW EMAIL STORE  ── immutable, permanent. The real source of truth.
      │
      ▼
(2) LLM EXTRACTION  ── BULK / BATCHED (a few calls per day, many emails per call).
      │                 structured output (JSON schema). Shared context injected once and
      │                 prompt-cached: roster, canonical entity list, seeded recurring events,
      │                 the category enum + the event-role enum, all with definitions.
      ▼
(3) CONTRIBUTIONS STORE  ── fact table, keyed on the 3 dimensions + date + provenance.
      │
      ├──► (3b) AUTOMATED DEDUP PASS  ── periodic; keeps the entity list from fragmenting.
      ▼
(4) DASHBOARD  ── member / project / event / collaboration / cadence views.
```

**Re-runnability is a hard requirement.** Store raw emails immutably and stamp every contribution with
an `extraction_version`. When the prompt/schema improves, re-run extraction over stored emails and
re-derive contributions. The LLM output must never be the only copy of anything.

The **historical email archive is backfilled** through the same batched pipeline as live mail — the
dashboard is not limited to mail from go-live onward.

---

## Data model (relational — the queries are join-heavy, so SQL/Postgres fits)

- **`members`** — `id`, `name`, `emails[]`, `github_handle` (nullable, v2), `active`.
- **`emails`** — `id`, `from`, `received_at`, `subject`, `raw_body`, `parse_status`. Immutable.
- **`entities`** — `id`, `category`, `display_name`, `slug`, `status`
  (`active` | `merged_into:<id>`), `origin` (`seed` | `auto`), `first_seen_at`.
- **`events`** — `id`, `name`, `slug`. A curated seed list of the recurring/annual club activities
  (Hacktoberfest, Praveshan, GSoC, Workshop, fosstalk, fossplay…), seeded by leads. No dates: an event is
  a *thing the club does*, engaged with by role.
- **`contributions`** (fact table) — `id`, `member_id`, `email_id`, `date`, `category`,
  `entity_id` (nullable), `event_id` (nullable), `event_role` (nullable enum:
  `organize`|`prepare-for`|`compete-in`|`present`|`participate`), `activity_text`,
  `collaborators[]` (member ids), `links[]`, `blockers`, `confidence`, `extraction_version`.

Every dashboard view is an aggregation over `contributions`.

---

## Extraction design (bulk / batched)

The extractor runs as a **scheduled batch job**:

- **Many emails per request.** Each request packs a batch of emails (e.g. a day's worth, or fixed-size
  chunks), each delimited and keyed by `email_id`. The model returns contribution rows grouped back to
  each `email_id` via structured output (JSON schema). This collapses per-email overhead into a handful
  of requests per day.
- **Shared context is injected once and prompt-cached**, not re-sent per email — roster, canonical entity
  list, the seeded events, the category enum + event-role enum, and the extraction instructions are the
  large, stable prefix; caching it makes the marginal cost of each batch just the email bodies.
- **The async Batches API carries the daily run.** It is latency-tolerant (this is a scheduled job, not
  interactive) and roughly halves cost, which matters across backfill of the whole archive.

The injected context is what makes extraction accurate:

- **Roster** → resolve "helped Priya debug the scraper" to the right member id.
- **Current canonical entity list** (esp. club-project names + OSS repos already seen) → prefer matching.
- **Seeded recurring events + the role enum** → map work onto a known event and label *how* the member
  engaged. Work that matches no seeded event carries no event link; new/ad-hoc events are not
  force-created.
- **Category enum with definitions** → consistent classification.

The prompt instructs the model to: split each freeform update into discrete items; assign each a
category; map to an existing entity or propose a normalized new one; link a seeded event + role when
applicable; resolve collaborators to the roster; capture links/blockers; and emit a per-item `confidence`.

---

## Entity resolution (fully automated, self-healing)

Entity creation is fully automated — no human approval step. Left undefended it fragments
(`recsys` / `rec-sys` / `recommender system`), so robustness comes from three mechanisms:

1. **Inject the live entity list into every extraction batch** → the model matches instead of inventing.
2. **Normalize on write** — slugify, lowercase, strip filler ("the … project") for any new entity name.
3. **Periodic automated dedup pass (3b)** — embed entity names/descriptions, cluster by similarity, have
   an LLM confirm merges, then auto-merge: repoint contributions to the survivor and set the loser's
   `status = merged_into`. Runs on a schedule; no human needed.

Automation will still occasionally mis-merge or over-split, so the dashboard carries a **manual override**
on entities — rename, split, merge. Not a review queue and not a gate on ingestion; an escape hatch for
when leads spot something wrong.

Events are **not** auto-created — they are a seed list maintained by leads.

---

## Cadence (first-class)

Derived purely from `emails.received_at`. Surface prominently:
- Roster home shows each member's **last update**, **current streak**, and **N-day-silent flag**.
- Per-member **GitHub-style activity heatmap**.
- "Gone quiet" list for leads.

Label cadence for what it is: once members know it feeds evaluation, they write *for* the dashboard.
Cadence measures **reporting discipline, not work**, and the UI should say so where it's displayed.

---

## Evidence, not scores

No model-assigned effort/impact numbers. The dashboard presents evidence and lets humans judge:
- Per-member timeline + category breakdown + entities involved + events/roles + collaborators + links.
- **Volume/frequency** metrics only where quantified (active days, #contributions per category/entity,
  #distinct collaborators) — objective, un-editorialized.
- **Collaboration graph** (nodes = members, edges = co-mentions).
- OSS: show claimed contribution + repo/PR links now; real merged-PR/diff metrics arrive with v2
  enrichment.

---

## Dashboard views

- **Home / hawk-eye:** roster grid — recent categories, active entities, cadence status, last update.
- **Member page:** timeline, heatmap, category breakdown, entities, events + roles, collaborators, links.
- **Entity/project page:** roster, activity over time, recent contributions.
- **Event page:** per Hacktoberfest/Praveshan/GSoC/… — participants **grouped by role** + what each did.
- **Collaboration graph.**
- **Category lens:** filter everything by one category.

---

## Cross-cutting concerns

- **Provenance:** every contribution links back to its `email_id` → click through to the raw update.
- **Consent:** members must know their updates are parsed and surfaced to leads/faculty. State it once,
  explicitly.
- **Source-of-truth discipline:** dashboard is derived; raw emails are canonical and immutable.

---

## Deferred

- Concrete stack for extractor service, store, and front end (front end likely Next.js or a light
  dashboard; store likely Postgres).
- GitHub enrichment for OSS impact (v2).

---

## Open items

1. **Seed lists:** confirm the initial roster (name → sending addresses), the club-project entity list,
   and the recurring-events list with the leads before first run.
2. **Batch window:** how often the batch job runs (once daily vs. a couple of times a day), and batch
   size per request.

---

## Extraction quality eval set

Extraction quality is measured against real mail, and the same set is re-run whenever the prompt or
schema changes:

1. Take a sample of **~30–50 real status emails** across varied members/days.
2. Run the batched extraction over the sample with the JSON schema and full injected context
   (roster / entities / events / roles / categories).
3. Eyeball the contribution rows: are items split sensibly? Categories right? Entities mapped rather than
   duplicated? Events + roles assigned correctly? Collaborators resolved? Confidence sane?
4. Run the **dedup pass** over the resulting entity list — confirm variants collapse correctly.
5. Check the home + member + event views against the extracted rows to confirm they answer the leads'
   actual evaluation questions.
