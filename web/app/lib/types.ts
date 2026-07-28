/*
 * Shapes returned by the Flask API (app.py). Kept hand-written rather than
 * generated: the API is small, and drift shows up immediately in the field.
 */

export type Category =
  | "club-project"
  | "personal-project"
  | "open-source"
  | "non-technical"
  | "academic"
  | "hackathon"
  | "learning"
  | "competitive-programming"
  | "event"
  | "other";

export type DotKind = "entity" | "event" | "unattached";

export interface Dot {
  key: string;
  kind: DotKind;
  ref_id: number | null;
  label: string;
  category: Category;
  count: number;
  member_ids: number[];
}

export interface ThreadStop {
  contribution_id: number;
  dot: string;
  date: string;
  category: Category;
  email_id: number;
}

export interface Member {
  id: number;
  name: string;
  github_handle: string | null;
  active: number;
  emails: string[];
  reported_days: string[];
  /** One boolean per day of the window, in order. Reporting, not work. */
  cadence: boolean[];
  last_report: string | null;
  contribution_count: number;
}

export interface Contribution {
  id: number;
  member_id: number;
  email_id: number;
  date: string;
  category: Category;
  entity_id: number | null;
  event_id: number | null;
  event_role: string | null;
  activity_text: string;
  collaborator_ids: number[];
  blockers: string | null;
  confidence: number;
  entity_slug: string | null;
  entity_name: string | null;
  entity_category: Category | null;
  event_slug: string | null;
  event_name: string | null;
  dot: string;
}

export interface Smudge {
  id: number;
  from_addr: string;
  report_date: string;
  subject: string | null;
}

export interface FieldPayload {
  window: { from: string; to: string; days: string[] };
  dots: Dot[];
  threads: Record<string, ThreadStop[]>;
  members: Member[];
  contributions: Contribution[];
  smudges: Smudge[];
}

export interface MetaPayload {
  categories: Category[];
  event_roles: string[];
  contribution_span: { from: string | null; to: string | null };
  email_span: { from: string | null; to: string | null };
  default_window_days: number;
  pipeline_runs: {
    run_date: string;
    status: string;
    error_message: string | null;
    emails_stored: number;
    contribs_extracted: number;
    entities_merged: number;
  }[];
  parse_status: Record<string, number>;
  counts: {
    active_members: number;
    emails: number;
    contributions: number;
    entities: number;
  };
}

export interface FanRow {
  id: number;
  date: string;
  activity_text: string;
  confidence: number;
  category: Category;
  event_role: string | null;
  blockers: string | null;
  email_id: number;
  member_id: number;
  member_name: string;
}

export interface FanPayload {
  kind: DotKind;
  subject: {
    id?: number;
    slug: string;
    display_name: string;
    category?: string;
    origin?: string;
    status?: string;
    first_seen_at?: string;
    description?: string | null;
  };
  coalesced: boolean;
  history: FanRow[];
}

export interface EmailPayload {
  email: {
    id: number;
    message_id: string | null;
    from_addr: string;
    report_date: string;
    received_at: string;
    subject: string | null;
    raw_body: string;
    parse_status: string;
  };
  contributions: {
    id: number;
    date: string;
    category: Category;
    activity_text: string;
    confidence: number;
    event_role: string | null;
    blockers: string | null;
    entity_slug: string | null;
    event_slug: string | null;
    member_name: string;
  }[];
}
