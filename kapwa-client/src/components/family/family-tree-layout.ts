import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';

// ---------------------------------------------------------------------------
// Family tree layout
//
// The office's record keeps a flat list of household members, each labelled
// with its relationship to the person the case is about ("Self", "Spouse",
// "Child", "Parent", "Sibling", "Grandparent", "Grandchild", "Daughter-in-law").
// There are no explicit parent links, so the tree is reconstructed from those
// words — with two rules of thumb for what the words alone cannot say:
//
//   * a child usually carries a parent's surname, so a grandchild is hung from
//     the child whose surname it shares (and distributed evenly when several
//     children match or none does);
//   * anybody the words leave unattached is hung from the nearest person one
//     generation up, so no member is ever left floating.
//
//        great-grandparents        ← as deep as the record goes, oldest on top
//        grandparents
//        parents
//        this household            ← siblings side by side, spouse adjacent
//        children
//        grandchildren
//        great-grandchildren
//
// Positions are computed here, apart from React, so the rules can be tested.
// ---------------------------------------------------------------------------

export interface FamilyMemberNode extends Record<string, unknown> {
  id: string;
  fullName: string;
  relationship: string;
  age: number;
  surname?: string;
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

/** How much older a person must be to plausibly be the parent of another. */
const MIN_PARENT_AGE_GAP = 12;

/**
 * Which generation a member belongs to, counted in steps away from the person
 * the case is about (0). Negative is older. "Great-" adds a step, so a
 * great-grandchild is two rows below a grandchild. Relationship words the
 * office does not normally use are placed by the age gap instead.
 */
export function generationOf(
  member: Pick<FamilyMemberNode, 'relationship' | 'age'>,
  primaryAge?: number,
): number {
  const r = (member.relationship || '').toLowerCase();
  const greats = (r.match(/great/g) || []).length;

  if (/grandparent|grandmother|grandfather|grandma|grandpa|lolo|lola/.test(r)) return -2 - greats;
  if (/grandchild|grandson|granddaughter|\bapo\b/.test(r)) return 2 + greats;
  if (/parent|mother|father/.test(r)) return -1 - greats;
  if (/\bchild\b|\bson\b|\bdaughter\b/.test(r)) return 1 + greats;
  if (/spouse|partner|husband|wife|self|head|primary|sibling|brother|sister|relative|other/.test(r)) return 0;

  if (primaryAge != null) {
    const gap = member.age - primaryAge;
    if (gap >= 18) return -1;
    if (gap <= -18) return 1;
  }
  return 0;
}

/** A quiet caption for a generation row. */
export function layerLabelKey(generation: number): string {
  if (generation === 0) return 'household';
  if (generation === -1) return 'parents';
  if (generation === 1) return 'children';
  if (generation <= -2) return generation === -2 ? 'grandparents' : 'ancestors';
  return generation === 2 ? 'grandchildren' : 'descendants';
}

function surnameOf(member: FamilyMemberNode): string {
  const explicit = (member.surname || '').trim().toLowerCase();
  if (explicit) return explicit;
  // Fall back to the last word of the printed name (the layout may only be
  // handed a formatted name).
  const parts = (member.fullName || '').trim().split(/\s+/);
  return (parts[parts.length - 1] || '').toLowerCase();
}

/**
 * Pick the member one generation up that a younger member most likely belongs
 * to: the one sharing a surname when exactly one candidate does, otherwise the
 * closest in age that is plausibly old enough, otherwise a deterministic
 * spread across the candidates.
 */
export function parentAnchorFor(
  member: FamilyMemberNode,
  candidates: FamilyMemberNode[],
  primaryId?: string,
  memberIndex = 0,
): string | undefined {
  if (candidates.length === 0) return primaryId;
  const surname = surnameOf(member);
  if (surname) {
    const shared = candidates.filter((c) => surnameOf(c) === surname);
    if (shared.length === 1) return shared[0].id;
  }
  const plausible = candidates
    .map((c) => ({ id: c.id, gap: c.age - member.age }))
    .filter((c) => c.gap >= MIN_PARENT_AGE_GAP)
    .sort((a, b) => a.gap - b.gap);
  if (plausible.length > 0) return plausible[0].id;
  return candidates[memberIndex % candidates.length].id;
}

/** Order inside a row: siblings, then the person the case is about, then the spouse; eldest first. */
function rowOrder(member: FamilyMemberNode, isPrimaryNode: boolean): [number, number] {
  const r = (member.relationship || '').toLowerCase();
  const group = isPrimaryNode || /self|head|primary/.test(r) ? 1 : /spouse|partner|husband|wife/.test(r) ? 2 : 0;
  return [group, -member.age];
}

const RELATION_STROKE: Record<string, string> = {
  Spouse: '#C8553D',
  Child: '#3D5A80',
  Parent: '#1B3A5C',
  Sibling: '#5C5A56',
};

function edgeLabelStyle() {
  return {
    labelStyle: { fill: '#5C5A56', fontSize: 10, fontWeight: 500 },
    labelBgStyle: { fill: '#FFFFFF', fillOpacity: 0.9 },
    labelBgPadding: [4, 2] as [number, number],
    labelBgBorderRadius: 4,
  };
}

function descentEdge(from: string, to: string, label: string): FamilyFlowEdge {
  const stroke = RELATION_STROKE[label] ?? '#3D5A80';
  return {
    id: `e-${from}-${to}`,
    source: from,
    target: to,
    label,
    type: 'smoothstep',
    style: { stroke, strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: stroke },
    ...edgeLabelStyle(),
  };
}

/** A same-generation line (a marriage or a sibling bond) — no arrowhead. */
function peerEdge(from: string, to: string, label: string): FamilyFlowEdge {
  const stroke = RELATION_STROKE[label] ?? '#5C5A56';
  return {
    id: `e-${from}-${to}`,
    source: from,
    target: to,
    sourceHandle: 'right',
    targetHandle: 'left',
    label,
    type: 'smoothstep',
    style: { stroke, strokeWidth: 1.5 },
    ...edgeLabelStyle(),
  };
}

export function computeFamilyTreeLayout(
  members: FamilyMemberNode[],
  primary: FamilyMemberNode | null,
): FamilyTreeLayout {
  const all = primary ? [primary, ...members.filter((m) => m.id !== primary.id)] : [...members];
  if (all.length === 0) return { nodes: [], edges: [] };

  const primaryAge = primary?.age;
  const primaryId = primary?.id;

  // --- 1. one row per generation, deep as the record goes -------------------
  const rows = new Map<number, FamilyMemberNode[]>();
  for (const member of all) {
    const g = generationOf(member, primaryAge);
    const list = rows.get(g) ?? [];
    list.push(member);
    rows.set(g, list);
  }

  const generations = [...rows.keys()].sort((a, b) => a - b);

  // --- 2. positions: siblings side by side, the primary centred at x = 0 ----
  const nodes: FamilyFlowNode[] = [];
  const xOf = new Map<string, number>();
  let widestLeft = 0;

  for (const g of generations) {
    const row = rows.get(g)!;
    row.sort((a, b) => {
      const [ga, aa] = rowOrder(a, a.id === primaryId);
      const [gb, ab] = rowOrder(b, b.id === primaryId);
      return ga - gb || aa - ab;
    });

    // The row holding the primary is pinned so the primary sits at x = 0;
    // every other row is centred over the same axis, keeping each generation
    // above its descendants instead of drifting sideways.
    const primaryIndex = row.findIndex((m) => m.id === primaryId);
    const firstX = primaryIndex >= 0 ? -primaryIndex * STEP_X : -((row.length - 1) * STEP_X) / 2;

    const y = g * (NODE_HEIGHT + LAYER_GAP_Y);
    row.forEach((member, i) => {
      const x = firstX + i * STEP_X;
      xOf.set(member.id, x);
      widestLeft = Math.min(widestLeft, x);
      nodes.push({
        id: member.id,
        type: 'familyMember',
        position: { x, y },
        data: member,
        draggable: true,
      });
    });
  }

  // --- 3. edges that follow the hierarchy ----------------------------------
  // One pass per generation, away from the household row: ancestors are
  // anchored to the generation below them, descendants to the generation above.
  const edges: FamilyFlowEdge[] = [];
  const rowOf = (g: number) => rows.get(g) ?? [];
  const hasEdge = new Set<string>();
  const addEdge = (edge: FamilyFlowEdge) => {
    edges.push(edge);
    hasEdge.add(edge.source);
    hasEdge.add(edge.target);
  };

  const deepest = generations[0];
  const highest = generations[generations.length - 1];
  const household = rowOf(0);

  if (primaryId) {
    // The household row: the spouse and any siblings beside the person the
    // case is about. Siblings hang from the parents when the record has them.
    for (const peer of household) {
      if (peer.id === primaryId) continue;
      const r = (peer.relationship || '').toLowerCase();
      if (/spouse|partner|husband|wife/.test(r)) {
        addEdge(peerEdge(primaryId, peer.id, 'Spouse'));
      } else if (/sibling|brother|sister/.test(r)) {
        const parents = rowOf(-1);
        if (parents.length > 0) addEdge(descentEdge(parents[0].id, peer.id, 'Child'));
        else addEdge(peerEdge(primaryId, peer.id, 'Sibling'));
      }
    }
  }

  // Ancestors (negative generations): each one descends into the generation
  // below, so a great-grandparent sits above a grandparent above a parent.
  for (let g = deepest; g <= -1; g++) {
    const below = g === -1 ? [] : rowOf(g + 1);
    for (const ancestor of rowOf(g)) {
      const label = ancestor.relationship || (g === -1 ? 'Parent' : 'Relative');
      if (g === -1 && primaryId) {
        addEdge(descentEdge(ancestor.id, primaryId, label));
        continue;
      }
      const pool = below.filter((m) => hasEdge.has(m.id));
      const anchor = nearestByX(pool.length > 0 ? pool : below, ancestor, xOf) ?? primaryId;
      if (anchor && anchor !== ancestor.id) addEdge(descentEdge(ancestor.id, anchor, label));
    }
  }

  // Descendants (positive generations): children descend from the person in
  // the case, grandchildren from the child they most likely belong to, and so
  // on. Only people in the direct line may anchor a younger generation — a
  // nephew or an in-law who happens to sit in the same row must not adopt
  // somebody else's children. A child's spouse is left for the pairing step.
  const isInLawMember = (m: FamilyMemberNode) => /in.?law/.test((m.relationship || '').toLowerCase());
  const isDirectDescendant = (m: FamilyMemberNode) =>
    !isInLawMember(m) && /child|son|daughter|grandchild|apo/.test((m.relationship || '').toLowerCase());

  for (let g = 1; g <= highest; g++) {
    const rowAbove = rowOf(g - 1);
    const direct = rowAbove.filter(isDirectDescendant);
    const above = g === 1 ? (primaryId ? [primary!] : []) : direct.length > 0 ? direct : rowAbove;
    const memberIndex = new Map(rowOf(g).map((m, i) => [m.id, i]));
    for (const descendant of rowOf(g)) {
      if (isInLawMember(descendant)) continue; // paired beside their own spouse
      const isGrand = /grandchild|grandson|granddaughter|\bapo\b/.test((descendant.relationship || '').toLowerCase());
      const label = isDirectDescendant(descendant) ? (isGrand ? 'Grandchild' : 'Child') : descendant.relationship || 'Relative';
      const anchor = parentAnchorFor(descendant, above, primaryId, memberIndex.get(descendant.id) ?? 0);
      if (anchor && anchor !== descendant.id) addEdge(descentEdge(anchor, descendant.id, label));
    }
  }

  // A child's own spouse (an in-law) sits beside that child, not below them:
  // the shared surname if there is one, otherwise the nearest connected person
  // in the same row.
  for (const g of generations.filter((x) => x > 0)) {
    for (const member of rowOf(g)) {
      if (!isInLawMember(member) || hasEdge.has(member.id)) continue;
      const connected = rowOf(g).filter((m) => m.id !== member.id && !isInLawMember(m) && hasEdge.has(m.id));
      const sameSurname = connected.filter((m) => surnameOf(m) === surnameOf(member));
      const spouse = sameSurname[0]?.id ?? nearestByX(connected, member, xOf) ?? rowOf(g).find((m) => m.id !== member.id)?.id;
      if (spouse) addEdge(peerEdge(spouse, member.id, member.relationship || 'Spouse'));
    }
  }

  // --- 4. nobody floats ----------------------------------------------------
  // Whatever the words did not place (a nephew, a helper) is anchored to the
  // generation beside it, so every member is part of the picture.
  for (const member of all) {
    if (member.id === primaryId || hasEdge.has(member.id)) continue;
    const g = generationOf(member, primaryAge);
    const relation = member.relationship || 'Relative';

    if (g < 0) {
      const below = rowOf(g + 1);
      const pool = below.filter((m) => hasEdge.has(m.id));
      const anchor = nearestByX(pool.length > 0 ? pool : below, member, xOf) ?? primaryId;
      if (anchor && anchor !== member.id) addEdge(descentEdge(member.id, anchor, relation));
      continue;
    }
    if (g > 0) {
      const above = rowOf(g - 1);
      const pool = above.filter((m) => hasEdge.has(m.id));
      const anchor = nearestByX(pool.length > 0 ? pool : above, member, xOf) ?? primaryId;
      if (anchor && anchor !== member.id) addEdge(descentEdge(anchor, member.id, relation));
      continue;
    }
    // Same row as the person the case is about: a quiet bond line.
    if (primaryId) addEdge(peerEdge(primaryId, member.id, relation));
  }

  // --- 5. generation captions in a common gutter ---------------------------
  for (const g of generations) {
    nodes.push({
      id: `layer-${g}`,
      type: 'layerLabel',
      position: { x: widestLeft - 16, y: g * (NODE_HEIGHT + LAYER_GAP_Y) + NODE_HEIGHT / 2 },
      data: { layerKey: layerLabelKey(g) },
      selectable: false,
      draggable: false,
      zIndex: 0,
    } as FamilyFlowNode);
  }

  return { nodes, edges };
}

/** The candidate closest to `member` horizontally — keeps lines from crossing. */
function nearestByX(
  candidates: FamilyMemberNode[],
  member: FamilyMemberNode,
  xOf: Map<string, number>,
): string | undefined {
  if (candidates.length === 0) return undefined;
  const x = xOf.get(member.id) ?? 0;
  return candidates.reduce((best, c) =>
    Math.abs((xOf.get(c.id) ?? 0) - x) < Math.abs((xOf.get(best.id) ?? 0) - x) ? c : best,
  ).id;
}
