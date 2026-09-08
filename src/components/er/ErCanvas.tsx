"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  useNodesState,
  type Connection,
  type Edge,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { EntityNode, type EntityNodeType } from "./EntityNode";
import { useSchemaStore, useSnapshot } from "@/lib/er/store";
import { getRole, getScenario } from "@/lib/sim/scenarios";
import { attributesOf } from "@/lib/types";

const nodeTypes: NodeTypes = { entity: EntityNode };

const KIND_STYLE = {
  "1:1": { stroke: "#0d9488", dash: undefined },
  "1:N": { stroke: "#4f46e5", dash: undefined },
  "M:N": { stroke: "#7c3aed", dash: undefined },
} as const;

export function ErCanvas({
  selectedRelationshipId,
  onSelectRelationship,
}: {
  selectedRelationshipId: string | null;
  onSelectRelationship: (id: string | null) => void;
}) {
  const entities = useSchemaStore((s) => s.entities);
  const relationships = useSchemaStore((s) => s.relationships);
  const project = useSchemaStore((s) => s.project);
  const highlighted = useSchemaStore((s) => s.highlightedEntityIds);
  const selectedEntityId = useSchemaStore((s) => s.selectedEntityId);
  const select = useSchemaStore((s) => s.select);
  const moveEntity = useSchemaStore((s) => s.moveEntity);
  const createRelationship = useSchemaStore((s) => s.createRelationship);
  const snapshot = useSnapshot();

  const scenario = getScenario(project?.scenario_key ?? "eshop");

  /**
   * Pozice uzlů drží během tažení plátno, ne úložiště.
   *
   * Kdybychom uzly počítali z úložiště při každém překreslení, přepsali bychom
   * plátnu pozici zpátky na starou a tabulka by se při tažení nehnula – jen by
   * po puštění skočila na nové místo. Do databáze se proto zapisuje až na konci
   * tažení a sem se cizí změny slévají tak, aby právě taženou tabulku minuly.
   */
  const [nodes, setNodes, applyNodeChanges] = useNodesState<EntityNodeType>([]);

  useEffect(() => {
    setNodes((previous) =>
      entities.map((entity) => {
        const existing = previous.find((node) => node.id === entity.id);
        const role = getRole(scenario, entity.roleKey);

        return {
          id: entity.id,
          type: "entity" as const,
          // Taženou tabulku nepřepisujeme – jinak by utekla pod myší.
          position: existing?.dragging
            ? existing.position
            : { x: entity.posX, y: entity.posY },
          dragging: existing?.dragging,
          selected: entity.id === selectedEntityId,
          data: {
            entity,
            attributes: attributesOf(snapshot, entity.id),
            roleLabel: role?.label ?? null,
            roleColor: role?.color ?? "var(--color-role-custom)",
            highlighted: highlighted.includes(entity.id),
            hasError: false,
          },
        };
      }),
    );
  }, [entities, snapshot, scenario, selectedEntityId, highlighted, setNodes]);

  const edges: Edge[] = useMemo(
    () =>
      relationships.map((relationship) => {
        const style = KIND_STYLE[relationship.kind];
        const needsJunction =
          relationship.kind === "M:N" && !relationship.junctionEntityId;
        return {
          id: relationship.id,
          source: relationship.fromEntityId,
          target: relationship.toEntityId,
          label: relationship.kind,
          selected: relationship.id === selectedRelationshipId,
          animated: needsJunction,
          markerEnd: { type: MarkerType.ArrowClosed, color: style.stroke },
          style: {
            stroke: needsJunction ? "var(--color-bad)" : style.stroke,
            strokeWidth: relationship.id === selectedRelationshipId ? 3 : 2,
            strokeDasharray: needsJunction ? "6 4" : undefined,
          },
          labelStyle: { fill: "#e8eaf6", fontWeight: 600, fontSize: 12 },
          labelBgStyle: { fill: "#1b2140" },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4,
        };
      }),
    [relationships, selectedRelationshipId],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<EntityNodeType>[]) => {
      // Nejdřív ať se plátno překreslí – tažení tak jde plynule vidět.
      applyNodeChanges(changes);

      for (const change of changes) {
        // `dragging: false` přijde v okamžiku puštění; teprve tehdy se ukládá.
        if (change.type === "position" && change.position && change.dragging === false) {
          void moveEntity(change.id, change.position.x, change.position.y);
        }
        if (change.type === "select" && change.selected) {
          select(change.id);
          onSelectRelationship(null);
        }
      }
    },
    [applyNodeChanges, moveEntity, select, onSelectRelationship],
  );

  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      // Výchozí je 1:N – nejčastější vazba. Přepnout jde jedním klikem v panelu.
      const created = await createRelationship({
        fromEntityId: connection.source,
        toEntityId: connection.target,
        kind: "1:N",
      });
      if (created) onSelectRelationship(created.id);
    },
    [createRelationship, onSelectRelationship],
  );

  return (
    <div className="df-canvas h-full w-full bg-canvas">
      <ReactFlow<EntityNodeType>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onConnect={handleConnect}
        onEdgeClick={(_, edge) => {
          onSelectRelationship(edge.id);
          select(null);
        }}
        onPaneClick={() => {
          select(null);
          onSelectRelationship(null);
        }}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="var(--color-canvas-line)"
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
