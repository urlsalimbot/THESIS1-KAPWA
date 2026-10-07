/**
 * DOT → draw.io (mxGraph) exporter.
 *
 * The DFD docs hold Graphviz DOT. Graphviz draws them correctly but rasterises
 * to PNG/PDF, which is not editable and — at the sizes these DFDs reach — not
 * sharp enough for print. This exporter re-expresses each graph as an editable
 * .drawio file:
 *
 *   entity   rectangle, light-blue fill
 *   process  swimlane with a top title band (the number in the band, the name
 *            in a child label in the body), rounded corners
 *   store    swimlane rotated so the band is on the LEFT (D-number in the band,
 *            name in the body)
 *   flow     edge with the flow label
 *
 * Geometry comes from `dot -Tjson`, so the draw.io file opens with the same
 * arrangement the rendered images have; the user can then edit freely. Labels
 * and symbol kinds are parsed from the DOT source (where they are unambiguous)
 * rather than from Graphviz's resolved HTML labels.
 */
import { execFileSync } from 'node:child_process';

const ENTITY_FILL = '#cfe2f3';
const STROKE = '#111111';
const PX = 96 / 72; // points → draw.io pixels

// draw.io styles for the standard ANSI/ISO (ISO 5807) flowchart symbols, plus
// the DFD shapes the other diagrams use. The exporter maps each Graphviz shape
// onto the draw.io counterpart so the drawn symbol is the standard one.
const STYLES = {
  'flow-terminator': `rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor=${ENTITY_FILL};strokeColor=${STROKE};fontSize=11;`,
  'flow-process': `rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=${STROKE};fontSize=11;`,
  'flow-decision': `rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=${STROKE};fontSize=11;`,
  'flow-data': 'shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;' +
    `fillColor=#ffffff;strokeColor=${STROKE};fontSize=11;`,
  'flow-stored': 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;' +
    `fillColor=#f5f5f5;strokeColor=${STROKE};fontSize=11;`,
  'flow-note': 'shape=note;whiteSpace=wrap;html=1;size=14;backgroundOutline=1;' +
    `fillColor=#fff9c4;strokeColor=${STROKE};fontSize=10;align=left;`,
  'flow-connector': `ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#ffffff;strokeColor=${STROKE};fontSize=11;`,
  'dfd-entity': `rounded=0;whiteSpace=wrap;html=1;fillColor=${ENTITY_FILL};strokeColor=${STROKE};fontSize=11;`,
};

/** Graphviz shape → standard flowchart symbol. */
const SHAPE_TO_SYMBOL = {
  terminator: 'flow-terminator',
  stadium: 'flow-terminator',
  diamond: 'flow-decision',
  parallelogram: 'flow-data',
  cylinder: 'flow-stored',
  note: 'flow-note',
  ellipse: 'flow-connector',
  circle: 'flow-connector',
  box: 'flow-process',
  rect: 'flow-process',
  rectangle: 'flow-process',
};

function xmlEsc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Parse the DOT source into node descriptors + edges (labels live here). */
function parseDot(code) {
  const nodes = new Map(); // id → {kind, band, name, label}
  const edges = [];

  const blockRe = /(?:^|\n)\s*([A-Za-z0-9_]+)\s*\[([\s\S]*?)\]\s*;/g;
  let m;
  while ((m = blockRe.exec(code))) {
    const id = m[1];
    const attrs = m[2];
    if (/<TABLE/.test(attrs)) {
      const cells = [...attrs.matchAll(/<TD[^>]*>([\s\S]*?)<\/TD>/g)].map((c) => c[1].trim());
      const isStore = /CELLBORDER="1"/.test(attrs);
      nodes.set(id, isStore
        ? { kind: 'dfd-store', band: cells[0] ?? '', name: cells[1] ?? '' }
        : { kind: 'dfd-process', band: cells[0] ?? '', name: cells[1] ?? '' });
      continue;
    }
    const shape = /shape=([A-Za-z0-9_]+)/.exec(attrs)?.[1] ?? 'box';
    // Labels may be HTML-like (label=<...>) or quoted (label="...").
    const htmlLabel = /label=<(.*?)>/.exec(attrs);
    const quotedLabel = /label="((?:[^"\\]|\\.)*)"/.exec(attrs);
    const value = (htmlLabel ? htmlLabel[1] : quotedLabel ? quotedLabel[1] : id).trim();
    // A filled box is a DFD external entity; a plain box is a process step.
    const filled = /style=filled/.test(attrs) && /fillcolor="#cfe2f3"/i.test(attrs);
    if (shape === 'box' && filled) {
      nodes.set(id, { kind: 'dfd-entity', label: value });
      continue;
    }
    nodes.set(id, { kind: 'flow', style: SHAPE_TO_SYMBOL[shape] ?? 'flow-process', label: value });
  }

  // Edge statements may chain: a -> b -> c; — split every hop. Labels sit in
  // the statement's attribute list and (per Graphviz) apply to its last hop.
  const edgeRe = /(?:^|\n)\s*([A-Za-z0-9_]+(?:\s*->\s*[A-Za-z0-9_]+)+)(\s*\[([\s\S]*?)\])?\s*;/g;
  while ((m = edgeRe.exec(code))) {
    const ids = m[1].split('->').map((s) => s.trim());
    const attrs = m[3] ?? '';
    const labelM = /label="((?:[^"\\]|\\.)*)"/.exec(attrs) ?? /label=<(.*?)>/.exec(attrs);
    const label = labelM ? labelM[1].trim() : '';
    for (let i = 0; i < ids.length - 1; i++) {
      edges.push({ from: ids[i], to: ids[i + 1], label: i === ids.length - 2 ? label : '' });
    }
  }

  return { nodes, edges };
}

/** Graphviz puts the origin bottom-left; draw.io puts it top-left.
 *  In `-Tjson`, `pos` is in points while `width`/`height` are in INCHES. */
function toDrawioRect(pos, widthIn, heightIn, bbH) {
  return {
    x: Math.round((pos.x - (widthIn * 72) / 2) * PX),
    y: Math.round((bbH - pos.y - (heightIn * 72) / 2) * PX),
    w: Math.round(widthIn * 96),
    h: Math.round(heightIn * 96),
  };
}

/**
 * Convert one DOT chart to a draw.io XML document.
 * `pageName` labels the diagram inside the file.
 */
export function dotToDrawio(code, pageName) {
  const json = JSON.parse(
    execFileSync('dot', ['-Tjson'], { input: code, maxBuffer: 64 * 1024 * 1024 }).toString(),
  );
  const [, , bbW, bbH] = json.bb.split(/[,\s]+/).map(Number);
  const { nodes: parsed, edges } = parseDot(code);

  // Graphviz object order is its own; index by name.
  const geo = new Map();
  for (const o of json.objects ?? []) geo.set(o.name, o);
  const index = new Map();
  (json.objects ?? []).forEach((o, i) => index.set(o.name, i));

  const cells = [];
  const cell = (id, value, style, geom, parent = '1') =>
    `<mxCell id="${xmlEsc(id)}" value="${xmlEsc(value)}" style="${xmlEsc(style)}" vertex="1" parent="${parent}">` +
    `<mxGeometry x="${geom.x}" y="${geom.y}" width="${geom.w}" height="${geom.h}" as="geometry"/></mxCell>`;

  for (const [name, node] of parsed) {
    const o = geo.get(name);
    if (!o) continue;
    const pos = (() => {
      const [x, y] = String(o.pos).split(',').map(Number);
      return { x, y };
    })();
    const rect = toDrawioRect(pos, Number(o.width), Number(o.height), bbH);

    if (node.kind === 'flow') {
      cells.push(cell(name, node.label, STYLES[node.style] ?? STYLES['flow-process'], rect));
    } else if (node.kind === 'dfd-entity') {
      cells.push(cell(name, node.label, STYLES['dfd-entity'], rect));
    } else if (node.kind === 'dfd-process') {
      // Top band holds the number; the body is a child label with the name.
      const bandH = 22;
      cells.push(cell(
        name,
        node.band,
        `swimlane;startSize=${bandH};horizontal=0;rounded=1;arcSize=12;whiteSpace=wrap;html=1;` +
        `fillColor=#ffffff;swimlaneFillColor=${ENTITY_FILL};strokeColor=${STROKE};fontSize=11;fontStyle=0;`,
        rect,
      ));
      cells.push(cell(
        `${name}__body`,
        node.name,
        'text;html=1;align=center;verticalAlign=middle;resizable=0;points=[];autosize=1;strokeColor=none;fillColor=none;fontSize=11;',
        // Child geometry is relative to the parent swimlane.
        { x: 6, y: bandH + 2, w: Math.max(40, rect.w - 12), h: Math.max(20, rect.h - bandH - 6) },
        name,
      ));
    } else if (node.kind === 'dfd-store') {
      // Store: swimlane with the band on the left (horizontal=1 rotates it).
      const bandW = 34;
      cells.push(cell(
        name,
        node.band,
        `swimlane;startSize=${bandW};horizontal=1;rounded=0;whiteSpace=wrap;html=1;` +
        `fillColor=#ffffff;swimlaneFillColor=${ENTITY_FILL};strokeColor=${STROKE};fontSize=11;` +
        'align=center;verticalAlign=middle;',
        rect,
      ));
      cells.push(cell(
        `${name}__body`,
        node.name,
        'text;html=1;align=left;verticalAlign=middle;resizable=0;points=[];autosize=1;strokeColor=none;fillColor=none;fontSize=11;',
        // Child geometry is relative to the parent swimlane.
        { x: bandW + 6, y: 2, w: Math.max(40, rect.w - bandW - 12), h: Math.max(20, rect.h - 4) },
        name,
      ));
    }
  }

  edges.forEach((e, i) => {
    if (!index.has(e.from) || !index.has(e.to)) return;
    cells.push(
      `<mxCell id="e${i + 1}" value="${xmlEsc(e.label)}" ` +
      'style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=block;endFill=1;strokeColor=#111111;fontSize=9;fontColor=#111111;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;" ' +
      `edge="1" parent="1" source="${xmlEsc(e.from)}" target="${xmlEsc(e.to)}">` +
      '<mxGeometry relative="1" as="geometry"/></mxCell>',
    );
  });

  const model =
    `<mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" ` +
    `pageWidth="1169" pageHeight="826" math="0" shadow="0">` +
    `<root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('')}</root></mxGraphModel>`;

  return `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="kapwa-diagrams" type="device" version="24.0.0">\n` +
    `  <diagram id="dfd-${xmlEsc(pageName).replace(/\s+/g, '-').toLowerCase()}" name="${xmlEsc(pageName)}">\n` +
    `    ${model}\n  </diagram>\n</mxfile>\n`;
}
