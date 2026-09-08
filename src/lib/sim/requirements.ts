import type {
  EntityRecord,
  RelationKind,
  RelationshipRecord,
  SchemaSnapshot,
} from "@/lib/types";
import { attributesOf } from "@/lib/types";
import * as issues from "./issues";
import type { Requirement, RoleDef, Scenario, SimIssue } from "./types";

/**
 * Překlad mezi „co scénář potřebuje“ a „co žák nakreslil“.
 *
 * Tenhle soubor je důvod, proč simulace umí říct *proč* se zákazník zasekl.
 */

export type LinkResolution =
  | { status: "ok"; relationship: RelationshipRecord | null; junction: EntityRecord | null }
  | { status: "missing" }
  | { status: "wrong-kind"; relationship: RelationshipRecord; actual: RelationKind }
  | { status: "mn-no-junction"; relationship: RelationshipRecord };

export function entityForRole(
  snapshot: SchemaSnapshot,
  role: string,
): EntityRecord | undefined {
  return snapshot.entities.find((e) => e.roleKey === role);
}

function relationsBetween(
  snapshot: SchemaSnapshot,
  a: string,
  b: string,
): RelationshipRecord[] {
  return snapshot.relationships.filter(
    (r) =>
      (r.fromEntityId === a && r.toEntityId === b) ||
      (r.fromEntityId === b && r.toEntityId === a),
  );
}

/** Ruční varianta M:N: dvě vazby 1:N do společné tabulky uprostřed. */
function findManualJunction(
  snapshot: SchemaSnapshot,
  a: string,
  b: string,
): EntityRecord | null {
  for (const candidate of snapshot.entities) {
    if (candidate.id === a || candidate.id === b) continue;
    const fromA = snapshot.relationships.some(
      (r) => r.kind === "1:N" && r.fromEntityId === a && r.toEntityId === candidate.id,
    );
    const fromB = snapshot.relationships.some(
      (r) => r.kind === "1:N" && r.fromEntityId === b && r.toEntityId === candidate.id,
    );
    if (fromA && fromB) return candidate;
  }
  return null;
}

export function resolveLink(
  snapshot: SchemaSnapshot,
  from: EntityRecord,
  to: EntityRecord,
  expected: RelationKind,
): LinkResolution {
  const candidates = relationsBetween(snapshot, from.id, to.id);

  if (expected === "M:N") {
    const direct = candidates.find((r) => r.kind === "M:N");
    if (direct) {
      if (direct.junctionEntityId) {
        const junction = snapshot.entities.find((e) => e.id === direct.junctionEntityId);
        if (junction) return { status: "ok", relationship: direct, junction };
      }
      // Vazba M:N je nakreslená správně, ale uložit se bez tabulky uprostřed nedá.
      const manual = findManualJunction(snapshot, from.id, to.id);
      if (manual) return { status: "ok", relationship: direct, junction: manual };
      return { status: "mn-no-junction", relationship: direct };
    }
    const manual = findManualJunction(snapshot, from.id, to.id);
    if (manual) return { status: "ok", relationship: null, junction: manual };
    if (candidates.length > 0) {
      return { status: "wrong-kind", relationship: candidates[0], actual: candidates[0].kind };
    }
    return { status: "missing" };
  }

  if (expected === "1:N") {
    const exact = candidates.find(
      (r) => r.kind === "1:N" && r.fromEntityId === from.id && r.toEntityId === to.id,
    );
    if (exact) return { status: "ok", relationship: exact, junction: null };
    if (candidates.length > 0) {
      // Buď je obrácená, nebo je to jiný typ – v obou případech chce opravit.
      return { status: "wrong-kind", relationship: candidates[0], actual: candidates[0].kind };
    }
    return { status: "missing" };
  }

  const oneToOne = candidates.find((r) => r.kind === "1:1");
  if (oneToOne) return { status: "ok", relationship: oneToOne, junction: null };
  if (candidates.length > 0) {
    return { status: "wrong-kind", relationship: candidates[0], actual: candidates[0].kind };
  }
  return { status: "missing" };
}

export function findAttributeBySemantic(
  snapshot: SchemaSnapshot,
  entityId: string,
  semantic: string,
) {
  return attributesOf(snapshot, entityId).find((a) => a.semanticKey === semantic);
}

function roleLabel(scenario: Scenario, role: string): string {
  return scenario.roles.find((r) => r.key === role)?.label ?? role;
}

function semanticLabel(scenario: Scenario, role: string, semantic: string): string {
  const def: RoleDef | undefined = scenario.roles.find((r) => r.key === role);
  const suggested = def?.suggested.find((s) => s.semantic === semantic);
  return suggested?.name ?? semantic;
}

/** Vrátí první nesplněný požadavek, nebo null když je vše v pořádku. */
export function checkRequirement(
  snapshot: SchemaSnapshot,
  scenario: Scenario,
  req: Requirement,
): SimIssue | null {
  if (req.kind === "entity") {
    const entity = entityForRole(snapshot, req.role);
    if (!entity) return issues.missingEntity(req.role, roleLabel(scenario, req.role));
    return null;
  }

  if (req.kind === "link") {
    const from = entityForRole(snapshot, req.from);
    const to = entityForRole(snapshot, req.to);
    if (!from) return issues.missingEntity(req.from, roleLabel(scenario, req.from));
    if (!to) return issues.missingEntity(req.to, roleLabel(scenario, req.to));

    const resolution = resolveLink(snapshot, from, to, req.relation);
    const roles = [req.from, req.to];
    if (resolution.status === "ok") return null;
    if (resolution.status === "missing") {
      return issues.missingLink(from.name, to.name, req.relation, roles);
    }
    if (resolution.status === "mn-no-junction") {
      return issues.missingJunction(from.name, to.name, roles);
    }
    return issues.wrongLinkKind(
      from.name,
      to.name,
      req.relation,
      resolution.actual,
      resolution.relationship.id,
      roles,
    );
  }

  const entity = entityForRole(snapshot, req.role);
  if (!entity) return issues.missingEntity(req.role, roleLabel(scenario, req.role));

  const attribute = findAttributeBySemantic(snapshot, entity.id, req.semantic);
  if (!attribute) {
    return issues.missingAttribute(
      req.role,
      entity.name,
      semanticLabel(scenario, req.role, req.semantic),
      entity.id,
    );
  }
  if (req.types && !req.types.includes(attribute.dataType)) {
    return issues.wrongDataType(
      req.role,
      entity.name,
      attribute.name,
      attribute.dataType,
      req.types,
      entity.id,
    );
  }
  return null;
}

export function checkRequirements(
  snapshot: SchemaSnapshot,
  scenario: Scenario,
  requirements: Requirement[],
): SimIssue | null {
  for (const req of requirements) {
    const issue = checkRequirement(snapshot, scenario, req);
    if (issue) return issue;
  }
  return null;
}

export interface StepReadiness {
  stepKey: string;
  label: string;
  optional: boolean;
  ready: boolean;
  issue: SimIssue | null;
}

/**
 * Přehled „co už firma umí“ – používá se před spuštěním simulace i v panelu
 * Kontrola návrhu, aby žák nemusel hádat.
 */
export function describeReadiness(
  snapshot: SchemaSnapshot,
  scenario: Scenario,
): StepReadiness[] {
  return scenario.journey.map((step) => {
    const issue = checkRequirements(snapshot, scenario, step.requires);
    return {
      stepKey: step.key,
      label: step.label,
      optional: Boolean(step.optional),
      ready: issue === null,
      issue,
    };
  });
}
