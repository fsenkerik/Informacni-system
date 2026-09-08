import type {
  AttributeRecord,
  EntityRecord,
  RelationshipRecord,
} from "@/lib/types";
import type {
  AttributeRow,
  EntityRow,
  RelationshipRow,
} from "@/lib/supabase/types";

/** Databáze mluví snake_case, aplikace camelCase. Překlad je jen tady. */

export function toEntity(row: EntityRow): EntityRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    roleKey: row.role_key,
    posX: row.pos_x,
    posY: row.pos_y,
    color: row.color,
  };
}

export function toAttribute(row: AttributeRow): AttributeRecord {
  return {
    id: row.id,
    entityId: row.entity_id,
    projectId: row.project_id,
    name: row.name,
    dataType: row.data_type,
    length: row.length,
    enumValues: row.enum_values,
    isPrimaryKey: row.is_primary_key,
    isRequired: row.is_required,
    isUnique: row.is_unique,
    defaultValue: row.default_value,
    semanticKey: row.semantic_key,
    orderIndex: row.order_index,
  };
}

export function toRelationship(row: RelationshipRow): RelationshipRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    fromEntityId: row.from_entity_id,
    toEntityId: row.to_entity_id,
    kind: row.kind,
    fromLabel: row.from_label,
    toLabel: row.to_label,
    junctionEntityId: row.junction_entity_id,
    onDelete: row.on_delete,
  };
}
