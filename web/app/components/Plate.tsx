/*
 * The plate: the field's text equivalent, at full parity.
 *
 * Not a degraded fallback. It is the keyboard and screen-reader path to
 * everything the drawing shows, and it is the primary surface below 640px
 * because a 20-thread kolam on a phone is illegible.
 *
 * Sort options here are deliberately limited to name, date, and category —
 * every one of them an intrinsic property of the row. There is no sort by
 * contribution count and there never will be: that is the leaderboard the
 * product refuses, and the plate is the one place it could sneak in.
 */
"use client";

import { useMemo, useState } from "react";
import type { Placed } from "../lib/geometry";
import { CATEGORY_PIGMENT } from "../lib/geometry";
import type { FieldPayload, MetaPayload } from "../lib/types";
import DotGlyph from "./DotGlyph";
import styles from "./Plate.module.css";

interface Props {
  field: FieldPayload;
  meta: MetaPayload;
  seats: Map<string, Placed>;
  onPickMember: (id: number) => void;
  onPickDot: (key: string) => void;
  api: string;
}

type Sort = "date" | "member" | "category" | "work";

export default function Plate({ field, seats, onPickDot }: Props) {
  const [sort, setSort] = useState<Sort>("date");
  const [category, setCategory] = useState<string>("all");

  const names = useMemo(
    () => new Map(field.members.map((m) => [m.id, m.name])),
    [field.members],
  );

  const rows = useMemo(() => {
    const label = (dotKey: string) => seats.get(dotKey)?.label ?? dotKey;
    const filtered = field.contributions.filter(
      (c) => category === "all" || c.category === category,
    );
    const sorted = [...filtered];
    switch (sort) {
      case "date":
        // Newest first — recency, not rank.
        sorted.sort((a, b) => b.date.localeCompare(a.date) || a.id - b.id);
        break;
      case "member":
        sorted.sort((a, b) =>
          (names.get(a.member_id) ?? "").localeCompare(names.get(b.member_id) ?? ""),
        );
        break;
      case "category":
        sorted.sort((a, b) => a.category.localeCompare(b.category) || a.id - b.id);
        break;
      case "work":
        sorted.sort((a, b) => label(a.dot).localeCompare(label(b.dot)) || a.id - b.id);
        break;
    }
    return sorted;
  }, [field.contributions, sort, category, names, seats]);

  return (
    <section id="plate" className={styles.plate} aria-label="The text plate">
      <div className={styles.controls}>
        <label className={styles.control}>
          <span className="t-label">Order by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="date">date, newest first</option>
            <option value="member">member name</option>
            <option value="category">category</option>
            <option value="work">project or event</option>
          </select>
        </label>

        <label className={styles.control}>
          <span className="t-label">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">all</option>
            {[...new Set(field.contributions.map((c) => c.category))].sort().map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <p className={`${styles.count} t-data`}>
          {rows.length} of {field.contributions.length}
        </p>
      </div>

      <table className={`${styles.table} ${styles.contribs}`}>
        <caption className="visually-hidden">
          Every contribution in the window: date, member, the project or event it
          attaches to, category, and a link to the update it was extracted from. Ordered
          by {sort}; no ordering by volume is offered.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="t-label">Date</th>
            <th scope="col" className="t-label">Member</th>
            <th scope="col" className="t-label">Work</th>
            <th scope="col" className="t-label">Activity</th>
            <th scope="col" className="t-label">Conf.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const seat = seats.get(c.dot);
            return (
              <tr key={c.id}>
                <td className="t-data">{c.date}</td>
                <td>{names.get(c.member_id) ?? `member ${c.member_id}`}</td>
                <td>
                  <button
                    type="button"
                    className={styles.dotLink}
                    onClick={() => onPickDot(c.dot)}
                  >
                    <svg width={14} height={14} viewBox="-7 -7 14 14" aria-hidden="true">
                      <DotGlyph
                        category={c.category}
                        r={5}
                        stroke={CATEGORY_PIGMENT[c.category]}
                      />
                    </svg>
                    {seat?.label ?? c.dot}
                  </button>
                  <span className={`${styles.cat} t-label`}>{c.category}</span>
                </td>
                <td className={styles.activity}>
                  {c.activity_text}
                  {c.event_role && <em className={styles.role}> · {c.event_role}</em>}
                  {c.blockers && (
                    <span className={styles.blocker}>blocked: {c.blockers}</span>
                  )}
                </td>
                <td className="t-data">{c.confidence.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {rows.length === 0 && (
        <p className={styles.empty}>
          No contributions in this window
          {category !== "all" ? ` under ${category}` : ""}.
        </p>
      )}

      <section className={styles.roster} aria-label="Roster and reporting cadence">
        <h2 className="t-label">Roster · {field.members.length}</h2>
        <p className={styles.note}>
          Cadence counts whether an update was <em>written</em>, not whether work
          happened. Members are listed alphabetically and are never ranked.
        </p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className="t-label">Member</th>
              <th scope="col" className="t-label">Days reported</th>
              <th scope="col" className="t-label">Last update</th>
            </tr>
          </thead>
          <tbody>
            {field.members.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td className="t-data">
                  {m.reported_days.length} / {m.cadence.length}
                </td>
                <td className="t-data">{m.last_report ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {field.smudges.length > 0 && (
        <section className={styles.roster} aria-label="Updates that failed extraction">
          <h2 className="t-label">Failed extraction · {field.smudges.length}</h2>
          <p className={styles.note}>
            These updates arrived but could not be parsed. The mail is intact; only the
            extraction failed.
          </p>
          <ul>
            {field.smudges.map((s) => (
              <li key={s.id} className="t-data">
                {s.report_date} · {s.from_addr}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
