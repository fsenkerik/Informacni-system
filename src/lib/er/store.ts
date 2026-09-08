"use client";

import { useMemo } from "react";
import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AttributeRow,
  EntityRow,
  ProjectRow,
  RelationshipRow,
} from "@/lib/supabase/types";
import type {
  AttributeRecord,
  DataType,
  EntityRecord,
  RelationKind,
  RelationshipRecord,
  SchemaSnapshot,
} from "@/lib/types";
import { toAttribute, toEntity, toRelationship } from "./mappers";
import { DEMO_PROJECT, DEMO_PROJECT_ID, buildDemoSchema } from "./demo";

/**
 * Ukázkový projekt běží celý v prohlížeči – žádné dotazy do databáze.
 * Díky tomu jde aplikaci předvést na projektoru, než je Supabase nastavená.
 */
const isDemo = (projectId: string | null) => projectId === DEMO_PROJECT_ID;
const newId = () => globalThis.crypto.randomUUID();

export interface Collaborator {
  userId: string;
  nickname: string;
  color: string;
}

interface SchemaState {
  projectId: string | null;
  project: ProjectRow | null;
  entities: EntityRecord[];
  attributes: AttributeRecord[];
  relationships: RelationshipRecord[];
  collaborators: Collaborator[];
  selectedEntityId: string | null;
  highlightedEntityIds: string[];
  loading: boolean;
  error: string | null;

  load(projectId: string): Promise<void>;
  connect(projectId: string, me: { userId: string; nickname: string }): () => void;
  snapshot(): SchemaSnapshot;

  select(entityId: string | null): void;
  highlight(entityIds: string[]): void;

  createEntity(input: {
    name: string;
    roleKey?: string | null;
    posX: number;
    posY: number;
  }): Promise<EntityRecord | null>;
  renameEntity(id: string, name: string): Promise<void>;
  setEntityRole(id: string, roleKey: string | null): Promise<void>;
  moveEntity(id: string, posX: number, posY: number): Promise<void>;
  deleteEntity(id: string): Promise<void>;

  createAttribute(input: {
    entityId: string;
    name: string;
    dataType?: DataType;
    semanticKey?: string | null;
    isPrimaryKey?: boolean;
    isRequired?: boolean;
    isUnique?: boolean;
  }): Promise<void>;
  updateAttribute(id: string, patch: Partial<AttributeRecord>): Promise<void>;
  deleteAttribute(id: string): Promise<void>;

  createRelationship(input: {
    fromEntityId: string;
    toEntityId: string;
    kind: RelationKind;
    junctionEntityId?: string | null;
  }): Promise<RelationshipRecord | null>;
  updateRelationship(id: string, patch: Partial<RelationshipRecord>): Promise<void>;
  deleteRelationship(id: string): Promise<void>;
}

const PRESENCE_COLORS = [
  "#4f46e5", "#0d9488", "#db2777", "#b45309", "#2563eb", "#7c3aed",
];

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((x) => x.id === item.id);
  if (index === -1) return [...list, item];
  const next = [...list];
  next[index] = item;
  return next;
}

export const useSchemaStore = create<SchemaState>((set, get) => ({
  projectId: null,
  project: null,
  entities: [],
  attributes: [],
  relationships: [],
  collaborators: [],
  selectedEntityId: null,
  highlightedEntityIds: [],
  loading: true,
  error: null,

  snapshot() {
    const { projectId, entities, attributes, relationships } = get();
    return { projectId: projectId ?? "", entities, attributes, relationships };
  },

  select(entityId) {
    set({ selectedEntityId: entityId });
  },

  highlight(entityIds) {
    set({ highlightedEntityIds: entityIds });
  },

  async load(projectId) {
    set({ loading: true, error: null, projectId });

    if (isDemo(projectId)) {
      const demo = buildDemoSchema();
      set({
        project: DEMO_PROJECT,
        entities: demo.entities,
        attributes: demo.attributes,
        relationships: demo.relationships,
        loading: false,
      });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const [project, entities, attributes, relationships] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("entities").select("*").eq("project_id", projectId),
      supabase.from("attributes").select("*").eq("project_id", projectId),
      supabase.from("relationships").select("*").eq("project_id", projectId),
    ]);

    if (project.error) {
      set({
        loading: false,
        error:
          "Projekt se nepodařilo načíst. Zkontroluj, jestli jsi připojený správným kódem.",
      });
      return;
    }

    set({
      project: project.data,
      entities: (entities.data ?? []).map(toEntity),
      attributes: (attributes.data ?? []).map(toAttribute),
      relationships: (relationships.data ?? []).map(toRelationship),
      loading: false,
    });
  },

  connect(projectId, me) {
    if (isDemo(projectId)) return () => {};
    const supabase = getSupabaseBrowserClient();

    const channel: RealtimeChannel = supabase
      .channel(`projekt:${projectId}`, {
        config: { presence: { key: me.userId } },
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "entities", filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id: string }).id;
            set((s) => ({
              entities: s.entities.filter((e) => e.id !== id),
              attributes: s.attributes.filter((a) => a.entityId !== id),
              selectedEntityId: s.selectedEntityId === id ? null : s.selectedEntityId,
            }));
            return;
          }
          const entity = toEntity(payload.new as EntityRow);
          set((s) => ({ entities: upsert(s.entities, entity) }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attributes", filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id: string }).id;
            set((s) => ({ attributes: s.attributes.filter((a) => a.id !== id) }));
            return;
          }
          const attribute = toAttribute(payload.new as AttributeRow);
          set((s) => ({ attributes: upsert(s.attributes, attribute) }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "relationships", filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id: string }).id;
            set((s) => ({ relationships: s.relationships.filter((r) => r.id !== id) }));
            return;
          }
          const relationship = toRelationship(payload.new as RelationshipRow);
          set((s) => ({ relationships: upsert(s.relationships, relationship) }));
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ nickname: string; userId: string }>();
        const collaborators: Collaborator[] = Object.entries(state).map(
          ([key, entries], index) => ({
            userId: key,
            nickname: entries[0]?.nickname ?? "Spolužák",
            color: PRESENCE_COLORS[index % PRESENCE_COLORS.length],
          }),
        );
        set({ collaborators });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ nickname: me.nickname, userId: me.userId });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  },

  // -----------------------------------------------------------------
  //  Entity
  // -----------------------------------------------------------------

  async createEntity({ name, roleKey = null, posX, posY }) {
    const projectId = get().projectId;
    if (!projectId) return null;

    if (isDemo(projectId)) {
      const entity = { id: newId(), projectId, name, roleKey, posX, posY, color: null };
      set((s) => ({ entities: [...s.entities, entity], selectedEntityId: entity.id }));
      return entity;
    }

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("entities")
      .insert({ project_id: projectId, name, role_key: roleKey, pos_x: posX, pos_y: posY })
      .select()
      .single();

    if (error || !data) {
      set({ error: "Tabulku se nepodařilo vytvořit." });
      return null;
    }
    const entity = toEntity(data);
    set((s) => ({ entities: upsert(s.entities, entity), selectedEntityId: entity.id }));
    return entity;
  },

  async renameEntity(id, name) {
    set((s) => ({
      entities: s.entities.map((e) => (e.id === id ? { ...e, name } : e)),
    }));
    if (isDemo(get().projectId)) return;

    const supabase = getSupabaseBrowserClient();
    await supabase.from("entities").update({ name }).eq("id", id);
  },

  async setEntityRole(id, roleKey) {
    set((s) => ({
      entities: s.entities.map((e) => (e.id === id ? { ...e, roleKey } : e)),
    }));
    if (isDemo(get().projectId)) return;

    const supabase = getSupabaseBrowserClient();
    await supabase.from("entities").update({ role_key: roleKey }).eq("id", id);
  },

  async moveEntity(id, posX, posY) {
    set((s) => ({
      entities: s.entities.map((e) => (e.id === id ? { ...e, posX, posY } : e)),
    }));
    if (isDemo(get().projectId)) return;

    const supabase = getSupabaseBrowserClient();
    await supabase.from("entities").update({ pos_x: posX, pos_y: posY }).eq("id", id);
  },

  async deleteEntity(id) {
    set((s) => ({
      entities: s.entities.filter((e) => e.id !== id),
      attributes: s.attributes.filter((a) => a.entityId !== id),
      relationships: s.relationships.filter(
        (r) => r.fromEntityId !== id && r.toEntityId !== id,
      ),
      selectedEntityId: s.selectedEntityId === id ? null : s.selectedEntityId,
    }));
    if (isDemo(get().projectId)) return;

    const supabase = getSupabaseBrowserClient();
    await supabase.from("entities").delete().eq("id", id);
  },

  // -----------------------------------------------------------------
  //  Atributy
  // -----------------------------------------------------------------

  async createAttribute({
    entityId,
    name,
    dataType = "VARCHAR",
    semanticKey = null,
    isPrimaryKey = false,
    isRequired = false,
    isUnique = false,
  }) {
    const projectId = get().projectId;
    if (!projectId) return;
    const orderIndex = get().attributes.filter((a) => a.entityId === entityId).length;

    if (isDemo(projectId)) {
      set((s) => ({
        attributes: [
          ...s.attributes,
          {
            id: newId(),
            entityId,
            projectId,
            name,
            dataType,
            length: null,
            enumValues: null,
            isPrimaryKey,
            isRequired,
            isUnique,
            defaultValue: null,
            semanticKey,
            orderIndex,
          },
        ],
      }));
      return;
    }

    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from("attributes")
      .insert({
        entity_id: entityId,
        project_id: projectId,
        name,
        data_type: dataType,
        semantic_key: semanticKey,
        is_primary_key: isPrimaryKey,
        is_required: isRequired,
        is_unique: isUnique,
        order_index: orderIndex,
        length: null,
        enum_values: null,
        default_value: null,
      })
      .select()
      .single();

    if (error || !data) {
      set({ error: "Sloupec se nepodařilo přidat." });
      return;
    }
    set((s) => ({ attributes: upsert(s.attributes, toAttribute(data)) }));
  },

  async updateAttribute(id, patch) {
    set((s) => ({
      attributes: s.attributes.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));

    if (isDemo(get().projectId)) return;

    const supabase = getSupabaseBrowserClient();
    const row: Partial<AttributeRow> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.dataType !== undefined) row.data_type = patch.dataType;
    if (patch.length !== undefined) row.length = patch.length;
    if (patch.enumValues !== undefined) row.enum_values = patch.enumValues;
    if (patch.isPrimaryKey !== undefined) row.is_primary_key = patch.isPrimaryKey;
    if (patch.isRequired !== undefined) row.is_required = patch.isRequired;
    if (patch.isUnique !== undefined) row.is_unique = patch.isUnique;
    if (patch.defaultValue !== undefined) row.default_value = patch.defaultValue;
    if (patch.semanticKey !== undefined) row.semantic_key = patch.semanticKey;
    if (patch.orderIndex !== undefined) row.order_index = patch.orderIndex;

    await supabase.from("attributes").update(row).eq("id", id);
  },

  async deleteAttribute(id) {
    set((s) => ({ attributes: s.attributes.filter((a) => a.id !== id) }));
    if (isDemo(get().projectId)) return;

    const supabase = getSupabaseBrowserClient();
    await supabase.from("attributes").delete().eq("id", id);
  },

  // -----------------------------------------------------------------
  //  Vazby
  // -----------------------------------------------------------------

  async createRelationship({ fromEntityId, toEntityId, kind, junctionEntityId = null }) {
    const projectId = get().projectId;
    if (!projectId) return null;

    if (isDemo(projectId)) {
      const relationship = {
        id: newId(),
        projectId,
        fromEntityId,
        toEntityId,
        kind,
        fromLabel: null,
        toLabel: null,
        junctionEntityId,
        onDelete: "restrict" as const,
      };
      set((s) => ({ relationships: [...s.relationships, relationship] }));
      return relationship;
    }

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("relationships")
      .insert({
        project_id: projectId,
        from_entity_id: fromEntityId,
        to_entity_id: toEntityId,
        kind,
        junction_entity_id: junctionEntityId,
        from_label: null,
        to_label: null,
        on_delete: "restrict",
      })
      .select()
      .single();

    if (error || !data) {
      set({ error: "Vazbu se nepodařilo vytvořit." });
      return null;
    }
    const relationship = toRelationship(data);
    set((s) => ({ relationships: upsert(s.relationships, relationship) }));
    return relationship;
  },

  async updateRelationship(id, patch) {
    set((s) => ({
      relationships: s.relationships.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));

    if (isDemo(get().projectId)) return;

    const supabase = getSupabaseBrowserClient();
    const row: Partial<RelationshipRow> = {};
    if (patch.kind !== undefined) row.kind = patch.kind;
    if (patch.fromEntityId !== undefined) row.from_entity_id = patch.fromEntityId;
    if (patch.toEntityId !== undefined) row.to_entity_id = patch.toEntityId;
    if (patch.fromLabel !== undefined) row.from_label = patch.fromLabel;
    if (patch.toLabel !== undefined) row.to_label = patch.toLabel;
    if (patch.junctionEntityId !== undefined) {
      row.junction_entity_id = patch.junctionEntityId;
    }
    if (patch.onDelete !== undefined) row.on_delete = patch.onDelete;

    await supabase.from("relationships").update(row).eq("id", id);
  },

  async deleteRelationship(id) {
    set((s) => ({ relationships: s.relationships.filter((r) => r.id !== id) }));
    if (isDemo(get().projectId)) return;

    const supabase = getSupabaseBrowserClient();
    await supabase.from("relationships").delete().eq("id", id);
  },
}));

/**
 * Snímek schématu pro komponenty.
 *
 * Akce `snapshot()` má stabilní referenci, takže by na ní komponenta
 * nepřekreslila při změně sloupce. Tenhle hook se přihlásí přímo k polím,
 * takže úprava atributu je hned vidět v diagramu i v kontrole návrhu.
 */
export function useSnapshot(): SchemaSnapshot {
  const projectId = useSchemaStore((s) => s.projectId);
  const entities = useSchemaStore((s) => s.entities);
  const attributes = useSchemaStore((s) => s.attributes);
  const relationships = useSchemaStore((s) => s.relationships);

  return useMemo(
    () => ({ projectId: projectId ?? "", entities, attributes, relationships }),
    [projectId, entities, attributes, relationships],
  );
}
