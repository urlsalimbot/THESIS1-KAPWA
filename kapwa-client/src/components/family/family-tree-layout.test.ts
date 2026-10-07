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
    // An ancestor edge carries the record's own word for that person.
    expect(byId.get('lolo->father')?.label).toBe('Grandparent');
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

describe('family tree layout — the case is about a grandparent', () => {
  // Lolo Juan heads the household: his two children and their children live
  // with him. The record only says "Child" and "Grandchild" relative to him.
  const lolo = member({ id: 'lolo', fullName: 'Juan Reyes', surname: 'Reyes', relationship: 'Self', age: 72, isPrimary: true });
  const ramon = member({ id: 'ramon', fullName: 'Ramon Reyes', surname: 'Reyes', relationship: 'Child', age: 45 });
  const maria = member({ id: 'maria', fullName: 'Maria Santos', surname: 'Santos', relationship: 'Child', age: 42 });
  const mico = member({ id: 'mico', fullName: 'Mico Reyes', surname: 'Reyes', relationship: 'Grandchild', age: 16 });
  const bibi = member({ id: 'bibi', fullName: 'Bibi Reyes', surname: 'Reyes', relationship: 'Grandchild', age: 8 });
  const nena = member({ id: 'nena', fullName: 'Nena Santos', surname: 'Santos', relationship: 'Grandchild', age: 11 });
  const { nodes, edges } = computeFamilyTreeLayout([ramon, maria, mico, bibi, nena], lolo);
  const byId = new Map(edges.map(e => [`${e.source}->${e.target}`, e]));
  const at = (id: string) => nodes.find(n => n.id === id)!;

  it('puts the grandchildren below the children, and the children below him', () => {
    expect(at('lolo').position.y).toBeLessThan(at('ramon').position.y);
    expect(at('ramon').position.y).toBe(at('maria').position.y);
    expect(at('mico').position.y).toBeGreaterThan(at('ramon').position.y);
    expect(at('mico').position.y).toBe(at('bibi').position.y);
    expect(at('mico').position.y).toBe(at('nena').position.y);
  });

  it('descends from him to each of his children', () => {
    expect(byId.get('lolo->ramon')?.label).toBe('Child');
    expect(byId.get('lolo->maria')?.label).toBe('Child');
  });

  it('hangs each grandchild from the child whose surname it shares', () => {
    expect(byId.get('ramon->mico')?.label).toBe('Grandchild');
    expect(byId.get('ramon->bibi')?.label).toBe('Grandchild');
    expect(byId.get('maria->nena')?.label).toBe('Grandchild');
    // and never from the wrong side of the family
    expect(byId.has('maria->mico')).toBe(false);
    expect(byId.has('ramon->nena')).toBe(false);
  });

  it('never lets a relative in the same row adopt the grandchildren', () => {
    // A nephew shares the family surname and sits in the children's row — he
    // must not become the parent of somebody else's children.
    const ton = member({ id: 'ton', fullName: 'Ton Reyes', surname: 'Reyes', relationship: 'Nephew', age: 30 });
    const layout = computeFamilyTreeLayout([ramon, maria, mico, bibi, nena, ton], lolo);
    const byId = new Map(layout.edges.map(e => [`${e.source}->${e.target}`, e]));
    expect(byId.get('ramon->mico')?.label).toBe('Grandchild');
    expect(byId.get('ramon->bibi')?.label).toBe('Grandchild');
    expect(byId.get('maria->nena')?.label).toBe('Grandchild');
    expect([...byId.keys()].some(k => k.startsWith('ton->'))).toBe(false);
    // His own line carries his own word, not "Child".
    expect(byId.get('lolo->ton')?.label).toBe('Nephew');
  });

  it('leaves nobody floating, whatever the record says', () => {
    const messy = [
      lolo, ramon, maria, mico,
      member({ id: 'nephew', fullName: 'Ton Reyes', surname: 'Reyes', relationship: 'Nephew', age: 30 }),
      member({ id: 'helper', fullName: 'Ana Cruz', relationship: 'Kasambahay', age: 22 }),
      member({ id: 'inlaw', fullName: 'Rosa Santos', surname: 'Santos', relationship: 'Daughter-in-law', age: 40 }),
    ];
    const layout = computeFamilyTreeLayout(messy, lolo);
    for (const m of messy) {
      expect(layout.edges.some(e => e.source === m.id || e.target === m.id)).toBe(true);
    }
  });
});

describe('family tree layout — deeper generations', () => {
  const lolo = member({ id: 'self', fullName: 'Pedro Reyes', surname: 'Reyes', relationship: 'Self', age: 60, isPrimary: true });
  const great = member({ id: 'great', fullName: 'Juan Reyes', surname: 'Reyes', relationship: 'Great-grandparent', age: 95 });
  const parent = member({ id: 'parent', fullName: 'Ramon Reyes', surname: 'Reyes', relationship: 'Parent', age: 80 });
  const child = member({ id: 'child', fullName: 'Mico Reyes', surname: 'Reyes', relationship: 'Child', age: 35 });
  const apo = member({ id: 'apo', fullName: 'Bibi Reyes', surname: 'Reyes', relationship: 'Grandchild', age: 10 });
  const apo2 = member({ id: 'apo2', fullName: 'Toti Reyes', surname: 'Reyes', relationship: 'Great-grandchild', age: 2 });
  const { nodes, edges } = computeFamilyTreeLayout([great, parent, child, apo, apo2], lolo);
  const y = (id: string) => nodes.find(n => n.id === id)!.position.y;

  it('stacks five generations in order', () => {
    expect(y('great')).toBeLessThan(y('parent'));
    expect(y('parent')).toBeLessThan(y('self'));
    expect(y('self')).toBeLessThan(y('child'));
    expect(y('child')).toBeLessThan(y('apo'));
    expect(y('apo')).toBeLessThan(y('apo2'));
  });

  it('reads great- as one generation further', () => {
    expect(generationOf({ relationship: 'Great-grandchild', age: 2 }, 60)).toBe(3);
    expect(generationOf({ relationship: 'Great-great-grandchild', age: 1 }, 60)).toBe(4);
    expect(generationOf({ relationship: 'Great-grandparent', age: 95 }, 60)).toBe(-3);
  });

  it('hangs the great-grandchild from the grandchild, not from the child', () => {
    const byId = new Map(edges.map(e => [`${e.source}->${e.target}`, e]));
    expect(byId.has('apo->apo2')).toBe(true);
    expect(byId.has('child->apo2')).toBe(false);
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
