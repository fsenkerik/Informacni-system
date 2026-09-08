import type {
  DataType,
  OnDelete,
  RelationKind,
  RunStatus,
  Severity,
  SizePreset,
} from "@/lib/types";

/**
 * Ruční popis databáze pro typovaného Supabase klienta.
 *
 * `Table<Row, Generated>` odvodí Insert/Update z Row – sloupce vyjmenované
 * v `Generated` doplňuje databáze (id, project_id z triggeru, timestampy),
 * takže je klient nemusí posílat.
 */
type NullableKeys<Row> = {
  [K in keyof Row]-?: null extends Row[K] ? K : never;
}[keyof Row];

type Optional<Row, Generated extends keyof Row> = Generated | NullableKeys<Row>;

type Table<Row, Generated extends keyof Row = never> = {
  Row: Row;
  // Vynechat jde všechno, co si databáze doplní sama, i každý sloupec,
  // který smí být NULL – přesně jako v Postgresu.
  Insert: Omit<Row, Optional<Row, Generated>> &
    Partial<Pick<Row, Optional<Row, Generated>>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type TeacherRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
};

export type ClassRow = {
  id: string;
  teacher_id: string;
  name: string;
  school_year: string | null;
  created_at: string;
};

export type ProjectRow = {
  id: string;
  class_id: string | null;
  name: string;
  company_name: string | null;
  scenario_key: string;
  join_code: string;
  size_preset: SizePreset;
  free_mode: boolean;
  created_at: string;
  updated_at: string;
};

export type ProjectMemberRow = {
  project_id: string;
  user_id: string;
  nickname: string;
  role: "owner" | "member";
  last_seen_at: string;
  joined_at: string;
};

export type EntityRow = {
  id: string;
  project_id: string;
  name: string;
  role_key: string | null;
  pos_x: number;
  pos_y: number;
  color: string | null;
  created_at: string;
  updated_at: string;
};

export type AttributeRow = {
  id: string;
  entity_id: string;
  project_id: string;
  name: string;
  data_type: DataType;
  length: number | null;
  enum_values: string[] | null;
  is_primary_key: boolean;
  is_required: boolean;
  is_unique: boolean;
  default_value: string | null;
  semantic_key: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type RelationshipRow = {
  id: string;
  project_id: string;
  from_entity_id: string;
  to_entity_id: string;
  kind: RelationKind;
  from_label: string | null;
  to_label: string | null;
  junction_entity_id: string | null;
  on_delete: OnDelete;
  created_at: string;
  updated_at: string;
};

export type SimRunRow = {
  id: string;
  project_id: string;
  scenario_key: string;
  seed: number;
  speed: number;
  customers_per_day: number;
  host_user_id: string | null;
  sim_clock: number;
  tick: number;
  status: RunStatus;
  metrics: Record<string, number>;
  heartbeat_at: string;
  started_at: string;
};

export type SimRecordRow = {
  id: string;
  run_id: string;
  project_id: string;
  entity_id: string;
  data: Record<string, unknown>;
  created_tick: number;
};

export type SimEventRow = {
  id: number;
  run_id: string;
  project_id: string;
  tick: number;
  type: string;
  severity: Severity;
  payload: Record<string, unknown>;
  created_at: string;
};

export type SimIssueRow = {
  id: string;
  run_id: string;
  project_id: string;
  code: string;
  entity_id: string | null;
  relationship_id: string | null;
  message: string;
  count: number;
  first_seen_tick: number;
  last_seen_tick: number;
};

export type ProjectProgressRow = {
  project_id: string;
  xp: number;
  level: number;
  missions_done: string[];
  updated_at: string;
};

export type ProjectAchievementRow = {
  project_id: string;
  achievement_key: string;
  xp: number;
  unlocked_at: string;
};

export type Database = {
  public: {
    Tables: {
      teachers: Table<TeacherRow, "created_at">;
      classes: Table<ClassRow, "id" | "created_at">;
      projects: Table<
        ProjectRow,
        "id" | "join_code" | "free_mode" | "size_preset" | "scenario_key" | "created_at" | "updated_at"
      >;
      project_members: Table<ProjectMemberRow, "last_seen_at" | "joined_at" | "role">;
      entities: Table<EntityRow, "id" | "created_at" | "updated_at">;
      attributes: Table<AttributeRow, "id" | "project_id" | "created_at" | "updated_at">;
      relationships: Table<RelationshipRow, "id" | "created_at" | "updated_at">;
      sim_runs: Table<SimRunRow, "id" | "heartbeat_at" | "started_at" | "metrics" | "sim_clock" | "tick" | "status">;
      sim_records: Table<SimRecordRow, "id" | "project_id">;
      sim_events: Table<SimEventRow, "id" | "project_id" | "created_at">;
      sim_issues: Table<SimIssueRow, "id" | "project_id">;
      project_progress: Table<ProjectProgressRow, "xp" | "level" | "missions_done" | "updated_at">;
      project_achievements: Table<ProjectAchievementRow, "unlocked_at" | "xp">;
    };
    Views: Record<never, never>;
    Functions: {
      join_project: {
        Args: { p_code: string; p_nickname: string };
        Returns: string;
      };
      generate_join_code: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
