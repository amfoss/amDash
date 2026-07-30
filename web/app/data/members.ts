export type Category =
  | "club-project"
  | "personal-project"
  | "open-source"
  | "learning"
  | "competitive-programming"
  | "academic"
  | "hackathon"
  | "event"
  | "non-technical"
  | "other";

export type Status = "ACTIVE" | "SILENT" | "INACTIVE";

export interface Member {
  id: number;
  name: string;
  githubHandle: string | null;
  status: Status;
  lastUpdateDaysAgo: number | null;
  lastUpdateDate: string | null;
  activeCategories: Category[];
  contribCount: number;
  active: boolean;
}
