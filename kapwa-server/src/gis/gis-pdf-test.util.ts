import * as zlib from 'zlib';

// Shared test utility: extract the text of a pdfkit-generated PDF.
//
// pdfkit stores page content in FlateDecode streams. Text is written as
// hex-encoded TJ arrays: standard fonts (Helvetica/Times) use 1-byte WinAnsi
// codes, while embedded fonts (the Liberation/Arial family) use Identity-H
// 2-byte glyph codes with a /ToUnicode CMap. Decode both: follow Tf font
// switches, translate embedded-font codes through the font's ToUnicode map,
// and fall back to latin1 for the base-14 fonts.
//
// Used by the GIS builder specs (national + municipal).

type ToUnicodeMap = Map<number, string>;

function utf16beToString(hex: string): string {
  const b = Buffer.from(hex, 'hex');
  let out = '';
  for (let i = 0; i + 1 < b.length; i += 2) {
    out += String.fromCharCode((b[i] << 8) | b[i + 1]);
  }
  return out;
}

function parseToUnicode(data: string): ToUnicodeMap {
  const map = new Map<number, string>();
  for (const block of data.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) {
    for (const m of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      map.set(parseInt(m[1], 16), utf16beToString(m[2]));
    }
  }
  for (const block of data.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
    for (const m of block.matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([\s\S]*?)\])/g,
    )) {
      const start = parseInt(m[1], 16);
      const end = parseInt(m[2], 16);
      if (m[3] !== undefined) {
        const base = parseInt(m[3], 16);
        const width = m[3].length;
        for (let k = 0; k <= end - start; k++) {
          map.set(start + k, utf16beToString((base + k).toString(16).padStart(width, '0')));
        }
      } else if (m[4] !== undefined) {
        const items = [...m[4].matchAll(/<([0-9A-Fa-f]+)>/g)].map(x => x[1]);
        items.forEach((hex, k) => map.set(start + k, utf16beToString(hex)));
      }
    }
  }
  return map;
}

function decodeHex(hex: string, toUnicode?: ToUnicodeMap): string {
  if (!toUnicode || toUnicode.size === 0) return Buffer.from(hex, 'hex').toString('latin1');
  let out = '';
  let i = 0;
  while (i < hex.length) {
    if (i + 4 <= hex.length) {
      const two = parseInt(hex.slice(i, i + 4), 16);
      const ch = toUnicode.get(two);
      if (ch !== undefined) { out += ch; i += 4; continue; }
      const one = parseInt(hex.slice(i, i + 2), 16);
      const ch1 = toUnicode.get(one);
      if (ch1 !== undefined) { out += ch1; i += 2; continue; }
      out += '?'; i += 4; continue;
    }
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    i += 2;
  }
  return out;
}

/** Raw document + decoded page text, so specs can assert either. */
export function searchableText(buf: Buffer): string {
  const raw = buf.toString('latin1');
  // Parse each "N 0 obj ... endobj" by its FULL body: dict fragments are
  // nested (e.g. /Resources << /Font << ... >> >>), so a naive first->> match
  // truncates them. Match keys against the whole body instead.
  const objRe = /(\d+) 0 obj([\s\S]*?)endobj/g;
  const bodies = new Map<number, string>();
  const streamData = new Map<number, string>();
  let m: RegExpExecArray | null;
  while ((m = objRe.exec(raw)) !== null) {
    const obj = Number(m[1]);
    const body = m[2];
    bodies.set(obj, body);
    const sm = body.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
    if (sm) {
      try {
        streamData.set(obj, zlib.inflateSync(Buffer.from(sm[1], 'latin1')).toString('latin1'));
      } catch {
        streamData.set(obj, sm[1]);
      }
    }
  }

  const fontInfo = new Map<number, { name: string; toUnicode: ToUnicodeMap }>();
  for (const [obj, body] of bodies) {
    const tu = /\/ToUnicode\s+(\d+)\s+0\s+R/.exec(body);
    if (/\/Type\s*\/Font\b/.test(body) && tu) {
      fontInfo.set(obj, {
        name: /\/BaseFont\s+\/([^\s/]+)/.exec(body)?.[1] ?? '',
        toUnicode: parseToUnicode(streamData.get(Number(tu[1])) ?? ''),
      });
    }
  }

  const pageBody = [...bodies.values()].find(b => /\/Type\s*\/Page\b/.test(b)) ?? '';
  // pdfkit puts /Resources in a separate object (e.g. /Resources 6 0 R);
  // follow the reference to find the /Font dictionary.
  const resRef = /\/Resources\s+(\d+)\s+0\s+R/.exec(pageBody);
  const resBody = resRef ? (bodies.get(Number(resRef[1])) ?? pageBody) : pageBody;
  const fontResource = new Map<string, number>();
  const fontsSec = /\/Font\s*<<([\s\S]*?)>>/.exec(resBody)?.[1];
  if (fontsSec) {
    for (const fm of fontsSec.matchAll(/\/F(\d+)\s+(\d+)\s+0\s+R/g)) {
      fontResource.set(`F${fm[1]}`, Number(fm[2]));
    }
  }

  let out = '';
  for (const cm of pageBody.matchAll(/\/Contents\s+(\d+)\s+0\s+R/g)) {
    const content = streamData.get(Number(cm[1]));
    if (!content) continue;
    let cur: string | null = null;
    const tokenRe = /\/F(\d+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]+)>|\(((?:[^()\\]|\\.)*)\)/g;
    let t: RegExpExecArray | null;
    while ((t = tokenRe.exec(content)) !== null) {
      if (t[1] !== undefined) { cur = `F${t[1]}`; continue; }
      const info = cur ? fontInfo.get(fontResource.get(cur) ?? -1) : undefined;
      if (t[2] !== undefined) out += decodeHex(t[2], info?.toUnicode);
      else if (t[3] !== undefined) out += t[3];
    }
  }
  return raw + '\n' + out;
}

/** Number of page objects in the document. */
export function pageCount(buf: Buffer): number {
  return (buf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;
}
