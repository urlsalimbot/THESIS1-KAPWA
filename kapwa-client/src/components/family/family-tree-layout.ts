import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';

// ---------------------------------------------------------------------------
// Family tree layout
//
// The office's own record keeps a flat list of household members, each labelled
// with its relationship to the person the case is about ("Self", "Spouse",
// "Child", "Parent", "Sibling", "Grandparent", "Grandchild"). The graph is
// drawn as a three-to-five generation tree:
//
//        grandparents            ← oldest generation on top
//        parents (and uncles?)   ← parents directly above their children
//        this household          ← siblings side by side, spouse adjacent
//        children
//        grandchildren
//
// Positions are computed here, apart from React, so the rules can be tested.
// ---------------------------------------------------------------------------

export interface FamilyMemberNode extends Record<string, unknown> {
  id: string;
  fullName: string;
  relationship: string;
  age: number;
  statusIncome?: string;
  isPrimary: boolean;
  depth?: number;
}

export type FamilyFlowNode = Node<FamilyMemberNode | { layerKey: string }, 'familyMember' | 'layerLabel'>;
export type FamilyFlowEdge = Edge;

export interface FamilyTreeLayout {
  nodes: FamilyFlowNode[];
  edges: FamilyFlowEdge[];
}

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 72;
export const LAYER_GAP_Y = 96;
export const NODE_GAP_X = 28;
export const STEP_X = NODE_WIDTH + NODE_GAP_X;

/** Generation index: -2 grandparents … 0 this household … +2 grandchildren. */
export type Generation = -2 | -1 | 0 | 1 | 2;

const LAYER_LABEL_KEYS: Record<Generation, string> = {
  [-2]: 'grandparents',
  [-1]: 'parents',
  0: 'household',
  1: 'children',
  2: 'grandchildren',
};

/**
 * Which generation a member belongs to. The relationship word decides; when it
 * is one the office does not normally use, the age gap against the person the
 * case is about decides instead.
 */
export function generationOf(member: Pick<FamilyMemberNode, 'relationship' | 'age'>, primaryAge?: number): Generation {
  const r = (member.relationship || '').toLowerCase();
  if (/grandparent|grandmother|grandfather|grandma|grandpa|lolo|lola/.test(r)) return -2;
  if (/grandchild|grandson|granddaughter|\bapo\b/.test(r)) return 2;
  if (/parent|mother|father/.test(r)) return -1;
  if (/\bchild\b|\bson\b|\bdaughter\b/.test(r)) return 1;
  if (/spouse|partner|husband|wife|self|head|primary|sibling|brother|sister|relative|other/.test(r)) return 0;
  if (primaryAge != null) {
    const gap = member.age - primaryAge;
    if (gap >= 18) return -1;
    if (gap <= -18) return 1;
  }
  return 0;
}

/** Order inside a row: siblings, then the person the case is about, then the spouse; eldest first within each group. */
function rowOrder(member: FamilyMemberNode, isPrimaryNode: boolean): [number, number] {
  const r = (member.relationship || '').toLowerCase();
  const group = isPrimaryNode || /self|head|primary/.test(r) ? 1 : /spouse|partner|husband|wife/.test(r) ? 2 : 0;
  return [group, -member.age];
}

function edgeId(from: string, to: string): string {
  return `e-${from}-${to}`;
}

const RELATION_STROKE: Record<string, string> = {
  Spouse: '#C8553D',
  Child: '#3D5A80',
  Parent: '#1B3A5C',
  Sibling: '#5C5A56',
};

function descentEdge(from: string, to: string, label: string): FamilyFlowEdge {
  return {
    id: edgeId(from, to),
    source: from,
    target: to,
    label,
    type: 'smoothstep',
    style: { stroke: RELATION_STROKE[label] ?? '#3D5A80', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: RELATION_STROKE[label] ?? '#3D5A80' },
    labelStyle: { fill: '#5C5A56', fontSize: 10, fontWeight: 500 },
    labelBgStyle: { fill: '#FFFFFF', fillOpacity: 0.9 },
    labelBgPadding: [4, 2] as [number, number],
    labelBgBorderRadius: 4,
  };
}

/** A same-generation line (a marriage or a sibling bond) — no arrowhead. */
function peerEdge(from: string, to: string, label: string): FamilyFlowEdge {
  return {
    id: edgeId(from, to),
    source: from,
    target: to,
    sourceHandle: 'right',
    targetHandle: 'left',
    label,
    type: 'smoothstep',
    style: { stroke: RELATION_STROKE[label] ?? '#5C5A56', strokeWidth: 1.5 },
    labelStyle: { fill: '#5C5A56', fontSize: 10, fontWeight: 500 },
    labelBgStyle: { fill: '#FFFFFF', fillOpacity: 0.9 },
    labelBgPadding: [4, 2] as [number, number],
    labelBgBorderRadius: 4,
  };
}

export function computeFamilyTreeLayout(
  members: FamilyMemberNode[],
  primary: FamilyMemberNode | null,
): FamilyTreeLayout {
  const all = primary ? [primary, ...members.filter((m) => m.id !== primary.id)] : [...members];
  if (all.length === 0) return { nodes: [], edges: [] };

  const primaryAge = primary?.age;

  // --- 1. one row per generation ------------------------------------------
  const rows = new Map<Generation, FamilyMemberNode[]>();
  for (const member of all) {
    const g = generationOf(member, primaryAge);
    const list = rows.get(g) ?? [];
    list.push(member);
    rows.set(g, list);
  }

  // --- 2. positions: siblings side by side, the primary centred at x = 0 ----
  const nodes: FamilyFlowNode[] = [];
  const generations = [...rows.keys()].sort((a, b) => a - b);
  let widestLeft = 0;

  for (const g of generations) {
    const row = rows.get(g)!;
    row.sort((a, b) => {
      const [ga, aa] = rowOrder(a, a.id === primary?.id);
      const [gb, ab] = rowOrder(b, b.id === primary?.id);
      return ga - gb || aa - ab;
    });

    // The row that holds the primary is pinned so the primary sits at x = 0;
    // every other row is centred over the same axis, which keeps parents above
    // their children instead of drifting sideways.
    const primaryIndex = row.findIndex((m) => m.id === primary?.id);
    const firstX = primaryIndex >= 0
      ? -primaryIndex * STEP_X
      : -((row.length - 1) * STEP_X) / 2;

    const y = g * (NODE_HEIGHT + LAYER_GAP_Y);
    row.forEach((member, i) => {
      const x = firstX + i * STEP_X;
      widestLeft = Math.min(widestLeft, x);
      nodes.push({
        id: member.id,
        type: 'familyMember',
        position: { x, y },
        data: member,
        draggable: true,
      });
    });

    // A quiet generation caption in the gutter to the left of the row.
    nodes.push({
      id: `layer-${g}`,
      type: 'layerLabel',
      position: { x: firstX - 16, y: y + NODE_HEIGHT / 2 },
      data: { layerKey: LAYER_LABEL_KEYS[g] },
      selectable: false,
      draggable: false,
      zIndex: 0,
    } as FamilyFlowNode);
  }

  // Shift every label into a common gutter so the captions line up vertically.
  const gutterX = widestLeft - 16;
  for (const node of nodes) {
    if (node.type === 'layerLabel') node.position.x = gutterX;
  }

  // --- 3. edges that follow the hierarchy ----------------------------------
  const edges: FamilyFlowEdge[] = [];
  const byGeneration = (g: Generation) => rows.get(g) ?? [];
  const primaryId = primary?.id;
  if (!primaryId) return { nodes, edges };

  const spouses = byGeneration(0).filter((m) => /spouse|partner|husband|wife/.test((m.relationship || '').toLowerCase()));
  const parents = byGeneration(-1);
  const children = byGeneration(1);
  const siblings = byGeneration(0).filter((m) => m.id !== primaryId && /sibling|brother|sister/.test((m.relationship || '').toLowerCase()));
  const grandparents = byGeneration(-2);
  const grandchildren = byGeneration(2);

  // Marriage: drawn beside the person the case is about, not below them.
  for (const spouse of spouses) peerEdgeOne(edges, primaryId, spouse.id, 'Spouse');

  // Parents above the household; without a parent generation, a sibling bond
  // is drawn as a same-generation line instead of pointing at nobody.
  for (const parent of parents) edges.push(descentEdge(parent.id, primaryId, 'Parent'));
  for (const sibling of siblings) {
    if (parents.length > 0) edges.push(descentEdge(parents[0].id, sibling.id, 'Child'));
    else peerEdgeOne(edges, primaryId, sibling.id, 'Sibling');
  }

  // Children below their parents; grandchildren hang from the nearest child.
  const childAnchor = children[0]?.id ?? primaryId;
  for (const child of children) edges.push(descentEdge(primaryId, child.id, 'Child'));
  for (const grandchild of grandchildren) edges.push(descentEdge(childAnchor, grandchild.id, 'Grandchild'));

  // Grandparents sit above their own child (the parent generation) when we have
  // one; otherwise the line drops to the person the case is about.
  const grandparentAnchor = parents[0]?.id ?? primaryId;
  for (const grandparent of grandparents) edges.push(descentEdge(grandparent.id, grandparentAnchor, 'Child'));

  // Everything else that shares the household row keeps a quiet bond line.
  for (const member of byGeneration(0)) {
    if (member.id === primaryId) continue;
    const labelled = /spouse|partner|husband|wife|sibling|brother|sister/.test((member.relationship || '').toLowerCase());
    if (labelled) continue;
    peerEdgeOne(edges, primaryId, member.id, member.relationship || 'Relative');
  }

  return { nodes, edges };

  function peerEdgeOne(list: FamilyFlowEdge[], from: string, to: string, label: string) {
    list.push(peerEdge(from, to, label));
  }
}
