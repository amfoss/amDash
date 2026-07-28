/*
 * The dot fan: one dot's history as dated strands, and the raw email behind any
 * strand.
 *
 * This is the provenance terminus. The dashboard is derived and disposable; the
 * mail underneath is canonical, so every mark must reach the message that
 * produced it. The panel sits *on* the field in Damp Earth with a hairline
 * edge — no shadow, and it never wraps the drawing in a card.
 */
"use client";

import { useEffect, useState } from "react";
import type { Placed } from "../lib/geometry";
import { CATEGORY_PIGMENT } from "../lib/geometry";
import type { EmailPayload, FanPayload } from "../lib/types";
import DotGlyph from "./DotGlyph";
import styles from "./Fan.module.css";

interface Props {
  dotKey: string;
  dot: Placed | undefined;
  api: string;
  onClose: () => void;
}

/** entity:6 → /api/dot/entity/6 ; unattached:academic → /api/dot/unattached/academic */
function fanUrl(api: string, dotKey: string): string {
  const [kind, ref] = dotKey.split(":");
  return `${api}/api/dot/${kind}/${ref}`;
}

export default function Fan({ dotKey, dot, api, onClose }: Props) {
  const [fan, setFan] = useState<FanPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<EmailPayload | null>(null);

  // No state reset here: page.tsx keys this component on dotKey, so selecting a
  // different dot remounts it with fresh state rather than clearing it in an
  // effect and rendering the previous dot's history for a frame.
  useEffect(() => {
    let live = true;
    fetch(fanUrl(api, dotKey))
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((j) => live && setFan(j))
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [dotKey, api]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (email) setEmail(null);
      else onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [email, onClose]);

  const openEmail = (id: number) => {
    fetch(`${api}/api/email/${id}`)
      .then((r) => r.json())
      .then(setEmail)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };

  return (
    <section className={styles.panel} aria-label={`History for ${dot?.label ?? dotKey}`}>
      <header className={styles.head}>
        {dot && (
          <svg width={26} height={26} viewBox="-13 -13 26 26" aria-hidden="true">
            <DotGlyph
              category={dot.category}
              r={9}
              stroke={CATEGORY_PIGMENT[dot.category]}
            />
          </svg>
        )}
        <div>
          <h2 className="t-title">{fan?.subject.slug ?? dot?.label ?? "…"}</h2>
          <p className={`${styles.sub} t-data`}>
            {dot?.kind === "unattached"
              ? "work that named no project or event"
              : (fan?.subject.category ?? dot?.category ?? "")}
            {fan?.history.length ? ` · ${fan.history.length} contributions` : ""}
          </p>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      {fan?.coalesced && (
        <p className={styles.notice}>
          Stored twice — as an auto-created entity and as a seeded event. Folded into
          one dot here.
        </p>
      )}

      {error && <p className={styles.notice}>Could not load: {error}</p>}

      {!fan && !error && <p className={styles.sub}>…</p>}

      {fan && (
        <ol className={styles.strands}>
          {fan.history.map((h) => (
            <li key={h.id} className={styles.strand}>
              <span className={`${styles.date} t-data`}>{h.date}</span>
              <span className={styles.who}>{h.member_name}</span>
              <span className={styles.what}>
                {h.activity_text}
                {h.event_role && (
                  <em className={styles.role}> · {h.event_role}</em>
                )}
                {h.blockers && (
                  <span className={styles.blocker}>blocked: {h.blockers}</span>
                )}
              </span>
              {/* Confidence is a property of the extraction, never of the
                  person. Mono because it is a measurement. */}
              <span className={`${styles.conf} t-data`} title="extraction confidence">
                {h.confidence.toFixed(2)}
              </span>
              <button
                type="button"
                className={`${styles.source} t-label`}
                onClick={() => openEmail(h.email_id)}
              >
                source
              </button>
            </li>
          ))}
        </ol>
      )}

      {email && (
        <div className={styles.raw} role="region" aria-label="The original update">
          <header className={styles.rawHead}>
            <h3 className="t-label">The update, unedited</h3>
            <button
              type="button"
              className={styles.close}
              onClick={() => setEmail(null)}
              aria-label="Close the original update"
            >
              ×
            </button>
          </header>
          <p className={`${styles.rawMeta} t-data`}>
            {email.email.from_addr} · {email.email.report_date} ·{" "}
            {email.email.parse_status}
          </p>
          {email.email.subject && <p className={styles.rawSubject}>{email.email.subject}</p>}
          <pre className={styles.rawBody}>{email.email.raw_body}</pre>
        </div>
      )}
    </section>
  );
}
