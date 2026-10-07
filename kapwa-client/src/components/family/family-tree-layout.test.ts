import { describe, it, expect } from 'vitest';
import {
  computeFamilyTreeLayout,
  generationOf,
  STEP_X,
  type FamilyMemberNode,
} from './family-tree-layout';

const member = (over: Partial<FamilyMemberNode> & { id: string }): FamilyMemberNode => ({
  fullName: over.id,
  relationship: 'Other',
  age: 30,
  isPrimary: false,
  ...over,
});

const self = member({ id: 'self', fullName: 'Pedro Reyes', relationship: 'Self', age: 38, isPrimary: true });
const spouse = member({ id: 'spouse', fullName: 'Elena Reyes', relationship: 'Spouse', age: 36 });
const son = member({ id: 'son', fullName: 'Mico Reyes', relationship: 'Child', age: 12 });
const daughter = member({ id: 'daughter', fullName: 'Nena Reyes', relationship: 'Child', age: 9 });
const father = member({ id: 'father', fullName: 'Ramon Reyes', relationship: 'Parent', age: 68 });
const mother = member({ id: 'mother', fullName: 'Luz Reyes', relationship: 'Parent', age: 65 });
const lolo = member({ id: 'lolo', fullName: 'Juan Reyes', relationship: 'Grandparent', age: 90 });
const brother = member({ id: 'brother', fullName: 'Tomas Reyes', relationship: 'Sibling', age: 42 });
const apo = member({ id: 'apo', fullName: 'Bibi Reyes', relationship: 'Grandchild', age: 3 });

const at = (nodes: ReturnType<typeof computeFamilyTreeLayout>['nodes'], id: string) => {
  const n = nodes.find(n => n.id === id);
  if (!n) throw new Error(`no node ${id}`);
  return n;
};

describe('family tree layout — generations', () => {
  const all = [self, spouse, son, daughter, father, mother, lolo, brother, apo];
  const { nodes, edges } = computeFamilyTreeLayout(all, self);

  it('stacks the generations: grandparents, parents, household, children, grandchildren', () => {
    const y = (id: string) => at(nodes, id).position.y;
    expect(y('lolo')).toBeLessThan(y('father'));
    expect(y('father')).toBeLessThan(y('self'));
    expect(y('self')).toBeLessThan(y('son'));
    expect(y('son')).toBeLessThan(y('apo'));
  });

  it('puts parents on one row and siblings side by side', () => {
    expect(at(nodes, 'father').position.y).toBe(at(nodes, 'mother').position.y);
    expect(at(nodes, 'brother').position.y).toBe(at(nodes, 'self').position.y);
    expect(at(nodes, 'brother').position.x).not.toBe(at(nodes, 'self').position.x);
  });

  it('places the spouse beside the person the case is about, not below', () => {
    expect(at(nodes, 'spouse').position.y).toBe(at(nodes, 'self').position.y);
    expect(Math.abs(at(nodes, 'spouse').position.x - at(nodes, 'self').position.x)).toBe(STEP_X);
  });

  it('keeps the person the case is about on the centre line', () => {
    expect(at(nodes, 'self').position.x).toBe(0);
  });

  it('orders same-generation members eldest first, left to right', () => {
    // grandmother/father and the two siblings follow the same rule
    const parents = ['father', 'mother'].map(id => at(nodes, id).position.x);
    expect(parents[0]).toBeLessThan(parents[1]); // 68 before 65
  });

  it('draws descent edges down the hierarchy and marriage lines sideways', () => {
    const byId = new Map(edges.map(e => [`${e.source}->${e.target}`, e]));
    expect(byId.get('father->self')?.label).toBe('Parent');
    expect(byId.get('self->son')?.label).toBe('Child');
    expect(byId.get('lolo->father')?.label).toBe('Child');
    // A descent edge carries an arrowhead; a marriage line does not.
    expect(byId.get('self->son')?.markerEnd).toBeTruthy();
    const marriage = byId.get('self->spouse');
    expect(marriage?.markerEnd).toBeFalsy();
    expect(marriage?.sourceHandle).toBe('right');
    expect(marriage?.targetHandle).toBe('left');
  });

  it('hangs siblings from the parents when the parents are on file', () => {
    const fromParent = edges.find(e => e.source === 'father' && e.target === 'brother');
    expect(fromParent?.label).toBe('Child');
  });

  it('labels each generation in the gutter', () => {
    const labels = nodes.filter(n => n.type === 'layerLabel');
    expect(labels.map(l => (l.data as { layerKey: string }).layerKey).sort())
      .toEqual(['children', 'grandchildren', 'grandparents', 'household', 'parents']);
  });
});

describe('family tree layout — relationship fallbacks', () => {
  it('reads the usual relationship words', () => {
    expect(generationOf({ relationship: 'Grandparent', age: 90 })).toBe(-2);
    expect(generationOf({ relationship: 'Parent', age: 60 })).toBe(-1);
    expect(generationOf({ relationship: 'Spouse', age: 40 })).toBe(0);
    expect(generationOf({ relationship: 'Child', age: 10 })).toBe(1);
    expect(generationOf({ relationship: 'Grandchild', age: 3 })).toBe(2);
  });

  it('falls back to the age gap for wording the office does not normally use', () => {
    expect(generationOf({ relationship: 'Kasambahay', age: 60 }, 38)).toBe(-1);
    expect(generationOf({ relationship: 'Kasambahay', age: 12 }, 38)).toBe(1);
    expect(generationOf({ relationship: 'Kasambahay', age: 35 }, 38)).toBe(0);
  });

  it('never claims a grandparent is a parent', () => {
    expect(generationOf({ relationship: 'Lola', age: 80 }, 40)).toBe(-2);
    expect(generationOf({ relationship: 'Apo', age: 4 }, 40)).toBe(2);
  });
});
