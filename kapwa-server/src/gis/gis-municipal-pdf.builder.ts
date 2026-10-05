import * as path from "path";
import * as fs from "fs";
import { GisPdfData } from "./gis-export.types";
import { ORG_LOCATION, REPORT_FALLBACK_SIGNATORIES } from "../common/constants";

// ---------------------------------------------------------------------------
// Municipal General Intake Sheet — the MSWDO Norzagaray local form.
//
// This is the SECOND GIS variation. `gis-pdf.builder.ts` reproduces the
// national DSWD FO3 sheet (DSWD-PMB-GF-011); this file reproduces the
// municipal paper form the office actually uses day to day: Filipino field
// labels, sections I–IV, the client-category and recommended-service checkbox
// grids, and the MSWDO signatory block.
//
// Alignment rules the whole sheet obeys:
//   * one value column — every field value box starts at VALUE_X;
//   * one label gutter — labels live in LEFT..VALUE_X and shrink to fit;
//   * one row box — ROW_H tall, and every element in a row is drawn on the
//     row's vertical center (rowCenter), so labels, checkboxes and boxes never
//     stagger;
//   * checkbox grids step GRID_STEP down the page.
// ---------------------------------------------------------------------------

const LEFT = 20;
const RIGHT = 575.28;
const WIDTH = RIGHT - LEFT;
const ROW_H = 14;
const VALUE_X = LEFT + 66; // value boxes start here, in every row
const GRID_STEP = 11; // checkbox rows
const LABEL_GAP = 9.5; // label baseline above a box top

/** Printed on the form as the approving officer (matches the paper original). */
const MUNICIPAL_SIGNATORY_NAME = REPORT_FALLBACK_SIGNATORIES.notedBy;
const MUNICIPAL_SIGNATORY_TITLE = "MSWDO";

const HEADER_TITLE = "GENERAL INTAKE SHEET";

export async function buildMunicipalGisPdf(data: GisPdfData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PDFDocument = require("pdfkit");
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 18, bottom: 16, left: LEFT, right: 595.28 - RIGHT },
    info: {
      Title: `Municipal-GIS-${data.controlNo}`,
      Author:
        data.officeName ??
        "Municipal Social Welfare and Development Office",
      Subject: "General Intake Sheet (Municipal)",
    },
  });
  const buffers: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => buffers.push(chunk));
  const done = new Promise<Buffer>((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(buffers))),
  );

  // ---- fonts --------------------------------------------------------------
  const registerFont = (name: string, file: string): string | null => {
    const p = path.join(__dirname, "assets", file);
    try {
      if (fs.existsSync(p)) {
        doc.registerFont(name, p);
        return name;
      }
    } catch {
      /* missing font — fall back to base-14 */
    }
    return null;
  };
  const F = {
    regular:
      registerFont("MuniRegular", "LiberationSans-Regular.ttf") ?? "Helvetica",
    bold:
      registerFont("MuniBold", "LiberationSans-Bold.ttf") ?? "Helvetica-Bold",
    italic:
      registerFont("MuniItalic", "LiberationSans-Italic.ttf") ?? "Helvetica-Oblique",
  };

  // ---- primitives ---------------------------------------------------------
  const hline = (y: number, x1 = LEFT, x2 = RIGHT, lw = 0.7) =>
    doc.moveTo(x1, y).lineTo(x2, y).lineWidth(lw).strokeColor("#333").stroke();
  const vline = (x: number, y1: number, y2: number, lw = 0.6) =>
    doc.moveTo(x, y1).lineTo(x, y2).lineWidth(lw).strokeColor("#333").stroke();
  const box = (x: number, y: number, w: number, h: number, lw = 0.6) =>
    doc.rect(x, y, w, h).lineWidth(lw).strokeColor("#333").stroke();

  // Shrink-to-fit on one line (labels never wrap into a neighbour).
  const fit = (
    text: string,
    font: string,
    maxWidth: number,
    size: number,
    min = 3.2,
  ): number => {
    doc.font(font).fontSize(size);
    while (size > min && doc.widthOfString(text) > maxWidth) {
      size -= 0.2;
      doc.font(font).fontSize(size);
    }
    return size;
  };

  const text = (
    value: string,
    x: number,
    y: number,
    opts: {
      size?: number;
      font?: string;
      width?: number;
      align?: "left" | "center" | "right";
      color?: string;
      lineBreak?: boolean;
      height?: number;
    } = {},
  ) => {
    doc
      .font(opts.font ?? F.regular)
      .fontSize(opts.size ?? 6)
      .fillColor(opts.color ?? "#111")
      .text(value, x, y, {
        width: opts.width,
        align: opts.align ?? "left",
        lineBreak: opts.lineBreak ?? true,
        height: opts.height,
        ellipsis: true,
      });
  };

  /** Vertical center of a ROW_H row — every element lines up on this line. */
  const rowCenter = (rowTop: number): number => rowTop + ROW_H / 2;

  /**
   * Label inside the LEFT..VALUE_X gutter, shrink-fitted and vertically
   * centered on the row so it can never stagger against its value box.
   */
  const rowLabel = (label: string, rowTop: number, size = 5.6): void => {
    const center = rowCenter(rowTop);
    const used = fit(label, F.regular, VALUE_X - LEFT - 4, size);
    text(label, LEFT + 1, center - used * 0.36, {
      size: used,
      width: VALUE_X - LEFT - 3,
      lineBreak: false,
      height: used + 2,
    });
  };

  /** Label that sits ABOVE a box (Referral, Amount, …) with a fixed gap. */
  const aboveLabel = (label: string, x: number, boxTop: number, size = 5.4): void => {
    const used = fit(label, F.regular, RIGHT - x - 4, size);
    text(label, x, boxTop - LABEL_GAP - used * 0.36, {
      size: used,
      width: RIGHT - x,
      lineBreak: false,
      height: used + 1,
    });
  };

  /** Bordered cell holding a value, centered inside the row. */
  const cell = (
    x: number,
    rowTop: number,
    w: number,
    value: string,
    opts: { size?: number; align?: "left" | "center" | "right"; font?: string; pad?: number } = {},
  ) => {
    box(x, rowTop, w, ROW_H);
    const pad = opts.pad ?? 2;
    if (value)
      text(value, x + pad, rowTop + (ROW_H - (opts.size ?? 6.4) * 1.1) / 2 - 0.4, {
        size: opts.size ?? 6.4,
        width: w - pad * 2,
        height: ROW_H - 1,
        align: opts.align ?? "left",
        font: opts.font,
      });
  };

  /** Small caption printed under a value box (Apelyido, Unang Pangalan, …). */
  const caption = (value: string, x: number, y: number, w: number, size = 4.6) => {
    const used = fit(value, F.regular, w - 2, size);
    text(value, x + 1, y, { size: used, width: w - 2, align: "center", lineBreak: false });
  };

  /**
   * Checkbox + label, both centered on `center`. The box is drawn at
   * center - 3 so its middle line matches the text's middle line exactly.
   */
  const checkAt = (
    x: number,
    center: number,
    label: string,
    checked: boolean,
    opts: { size?: number; maxWidth?: number } = {},
  ) => {
    const s = 6;
    doc.rect(x, center - s / 2, s, s).lineWidth(0.6).strokeColor("#333").stroke();
    if (checked) doc.rect(x + 1.1, center - s / 2 + 1.1, s - 2.2, s - 2.2).fillColor("#111").fill();
    const maxW = opts.maxWidth ?? 130;
    const size = fit(label, F.regular, maxW, opts.size ?? 5.6);
    text(label, x + s + 2, center - size * 0.4, {
      size,
      width: maxW,
      lineBreak: false,
      height: size + 1,
    });
    return x + s + 2 + doc.widthOfString(label) + 3;
  };

  /** Section heading bar: "I. PERSONAL INFORMATION". */
  const section = (y: number, heading: string): number => {
    text(heading, LEFT + 1, y, { size: 7, font: F.bold });
    hline(y + 12, LEFT, RIGHT, 0.8);
    return y + 15;
  };

  // ---- letterhead ---------------------------------------------------------
  {
    const logoPath = path.join(__dirname, "assets", "DSWD-Logo.png");
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, LEFT, 20, { width: 50, height: 50 });
      } catch {
        /* unsupported image — header still renders */
      }
    }

    const hx = LEFT + 58;
    text(ORG_LOCATION.country, hx, 20, { size: 5.4, font: F.italic });
    text(`Province of ${ORG_LOCATION.province}`, hx, 27.5, { size: 8, font: F.bold });
    text(`Municipality of ${ORG_LOCATION.municipality}`, hx, 37.5, { size: 8, font: F.bold });
    text(data.officeName ?? "MUNICIPAL SOCIAL WELFARE & DEVELOPMENT OFFICE", hx, 47.5, {
      size: 8,
      font: F.bold,
    });

    // Title + date boxes (MM / DD / YY), matching the paper form's top right.
    const titleW = 210;
    const titleX = RIGHT - titleW;
    text(HEADER_TITLE, titleX, 30, {
      size: 11,
      font: F.bold,
      width: titleW,
      align: "center",
      lineBreak: false,
    });

    const dbW = 32;
    const dbH = 15;
    const dbGap = 4;
    const dbX = RIGHT - (dbW * 3 + dbGap * 2);
    const dbY = 46;
    const parts = [
      String(data.createdAt.getMonth() + 1).padStart(2, "0"),
      String(data.createdAt.getDate()).padStart(2, "0"),
      String(data.createdAt.getFullYear() % 100).padStart(2, "0"),
    ];
    ["MM", "DD", "YY"].forEach((cap, i) => {
      const x = dbX + i * (dbW + dbGap);
      box(x, dbY, dbW, dbH);
      text(parts[i], x, dbY + (dbH - 7) / 2 - 0.6, {
        size: 7,
        width: dbW,
        align: "center",
        lineBreak: false,
      });
      caption(cap, x, dbY + dbH + 0.5, dbW, 4.8);
    });

    hline(76);
    text(`Control No.: ${data.controlNo}`, titleX, 66, {
      size: 6,
      width: titleW,
      align: "center",
      lineBreak: false,
      color: "#333",
    });
  }

  // ---- I. PERSONAL INFORMATION -------------------------------------------
  let y = section(84, "I. PERSONAL INFORMATION");

  // 1. Kliyente — surname / first name / middle name, captions beneath.
  {
    const rowTop = y;
    rowLabel("1. Kliyente", rowTop);
    const bw = (RIGHT - VALUE_X) / 3;
    cell(VALUE_X, rowTop, bw, data.beneficiary.surname);
    cell(VALUE_X + bw, rowTop, bw, data.beneficiary.firstName);
    cell(VALUE_X + bw * 2, rowTop, bw, data.beneficiary.middleName ?? "");
    const capY = rowTop + ROW_H + 0.5;
    caption("Apelyido", VALUE_X, capY, bw);
    caption("Unang Pangalan", VALUE_X + bw, capY, bw);
    caption("Gitnang Apelyido", VALUE_X + bw * 2, capY, bw);
    y = rowTop + ROW_H + 9;
  }

  // 2. Kasarian + Edad — every element on one row center.
  {
    const rowTop = y;
    const center = rowCenter(rowTop);
    rowLabel("2. Kasarian", rowTop);
    checkAt(VALUE_X, center, "Lalaki", data.beneficiary.sex.toLowerCase().startsWith("male"), { maxWidth: 34 });
    checkAt(VALUE_X + 52, center, "Babae", data.beneficiary.sex.toLowerCase().startsWith("female"), { maxWidth: 34 });
    text("Edad:", VALUE_X + 118, center - 5.6 * 0.36, { size: 5.6, lineBreak: false });
    const edadX = VALUE_X + 150;
    box(edadX, rowTop, 42, ROW_H);
    text(
      data.beneficiary.age != null ? String(data.beneficiary.age) : "",
      edadX,
      rowTop + (ROW_H - 7) / 2 - 0.6,
      { size: 7, width: 42, align: "center", lineBreak: false },
    );
    y = rowTop + ROW_H + 4;
  }

  // 4a. Kaarawan (MM/DD/YY) + 4b. Birthplace
  {
    const rowTop = y;
    const center = rowCenter(rowTop);
    rowLabel("4a. Kaarawan", rowTop);
    const dob = data.beneficiary.dob;
    const parts = dob
      ? [
          String(dob.getMonth() + 1).padStart(2, "0"),
          String(dob.getDate()).padStart(2, "0"),
          String(dob.getFullYear() % 100).padStart(2, "0"),
        ]
      : ["", "", ""];
    const cols = ["MM", "DD", "YY"];
    let bx = VALUE_X;
    parts.forEach((p, i) => {
      box(bx, rowTop, 32, ROW_H);
      text(p, bx, center - 7 * 0.36, { size: 7, width: 32, align: "center", lineBreak: false });
      caption(cols[i], bx, rowTop + ROW_H + 0.5, 32);
      bx += 36;
    });
    text("4b. Birthplace", VALUE_X + 124, center - 5.6 * 0.36, { size: 5.6, lineBreak: false });
    cell(VALUE_X + 184, rowTop, RIGHT - (VALUE_X + 184), data.beneficiary.placeOfBirth ?? "");
    y = rowTop + ROW_H + 8;
  }

  // 5. Civil Status + 6. Telepono
  {
    const rowTop = y;
    const center = rowCenter(rowTop);
    rowLabel("5. Civil Status", rowTop);
    const civil = (data.beneficiary.civilStatus ?? "").toLowerCase();
    let cx = VALUE_X;
    cx = checkAt(cx, center, "Single", civil === "single", { maxWidth: 30 });
    cx = checkAt(cx + 2, center, "Married", civil === "married", { maxWidth: 34 });
    checkAt(cx + 2, center, "Other", civil !== "" && civil !== "single" && civil !== "married", { maxWidth: 28 });
    text("6. Telepono", VALUE_X + 176, center - 5.6 * 0.36, { size: 5.6, lineBreak: false });
    cell(VALUE_X + 226, rowTop, RIGHT - (VALUE_X + 226), data.beneficiary.phone ?? "");
    y = rowTop + ROW_H + 5;
  }

  // 7. Tirahan — the five address fields share the value column.
  {
    const rowTop = y;
    rowLabel("7. Tirahan", rowTop);
    const bw = (RIGHT - VALUE_X) / 5;
    const fields = [
      "",
      data.beneficiary.address.street,
      data.beneficiary.address.barangay,
      data.beneficiary.address.city,
      data.beneficiary.address.province,
    ];
    fields.forEach((v, i) => cell(VALUE_X + bw * i, rowTop, bw, v));
    const capY = rowTop + ROW_H + 0.5;
    ["No./Building Name", "Street", "Barangay", "Municipality", "Province"].forEach((cap, i) =>
      caption(cap, VALUE_X + bw * i, capY, bw),
    );
    y = rowTop + ROW_H + 8;
  }

  // 8. Provincial Address
  {
    const rowTop = y;
    rowLabel("8. Provincial Address", rowTop, 5.2);
    cell(VALUE_X, rowTop, RIGHT - VALUE_X, data.beneficiary.provincialAddress ?? "");
    y = rowTop + ROW_H + 5;
  }

  // 9. Natapos sa Pag-aaral + 10. Hanapbuhay — value boxes back on VALUE_X.
  {
    const rowTop = y;
    const center = rowCenter(rowTop);
    rowLabel("9. Natapos sa Pag-aaral", rowTop, 5.2);
    cell(VALUE_X, rowTop, 140, "");
    text("10. Hanapbuhay", VALUE_X + 150, center - 5.6 * 0.36, { size: 5.6, lineBreak: false });
    cell(VALUE_X + 214, rowTop, RIGHT - (VALUE_X + 214), data.beneficiary.occupation ?? "");
    y = rowTop + ROW_H + 5;
  }

  // 11. Estimated Monthly Income + 12. Mode of Admission
  {
    const rowTop = y;
    const center = rowCenter(rowTop);
    rowLabel("11. Estimated Monthly Income", rowTop, 5.2);
    cell(VALUE_X, rowTop, 140, data.beneficiary.income != null ? `PHP ${data.beneficiary.income.toLocaleString()}` : "");
    const referral = data.referrals.length > 0;
    text("12. Mode of Admission", VALUE_X + 150, center - 5.6 * 0.36, { size: 5.6, lineBreak: false });
    let mx = VALUE_X + 230;
    mx = checkAt(mx, center, "Walk-in", !referral, { maxWidth: 34 });
    checkAt(mx + 2, center, "Referral", referral, { maxWidth: 34 });
    y = rowTop + ROW_H + 5;
  }

  // Philhealth No. + Address/Contact # of Referring Party
  {
    const rowTop = y;
    rowLabel("Philhealth No.", rowTop, 5.2);
    cell(VALUE_X, rowTop, 140, "");
    text("Address/Contact # of Referring Party", VALUE_X + 150, rowCenter(rowTop) - 5.6 * 0.36, {
      size: 5.6,
      lineBreak: false,
    });
    cell(VALUE_X + 284, rowTop, RIGHT - (VALUE_X + 284), data.referrals.map(r => r.reason).filter(Boolean).join(", "));
    y = rowTop + ROW_H + 8;
  }

  // ---- II. FAMILY COMPOSITION --------------------------------------------
  y = section(y, "II. FAMILY COMPOSITION");
  {
    const cols = [
      { label: "Pangalan", frac: 0.4 },
      { label: "Edad", frac: 0.12 },
      { label: "Relasyon", frac: 0.24 },
      { label: "Trabaho", frac: 0.24 },
    ];
    const headerH = 13;
    let cx = LEFT;
    cols.forEach((c, i) => {
      const w = i === cols.length - 1 ? RIGHT - cx : c.frac * WIDTH;
      box(cx, y, w, headerH);
      text(c.label, cx + 2, y + (headerH - 6) / 2, {
        size: 6,
        font: F.bold,
        width: w - 4,
        align: "center",
        lineBreak: false,
      });
      cx += w;
    });
    y += headerH;
    const rowH = 13;
    const minRows = 6;
    const rows = data.familyMembers.slice(0, Math.max(minRows, data.familyMembers.length));
    for (let i = 0; i < Math.max(rows.length, minRows); i++) {
      const m = rows[i];
      const values = m
        ? [
            m.fullName,
            m.age != null ? String(m.age) : "",
            m.relationship,
            m.occupation ?? "",
          ]
        : ["", "", "", ""];
      let rx = LEFT;
      cols.forEach((c, ci) => {
        const w = ci === cols.length - 1 ? RIGHT - rx : c.frac * WIDTH;
        box(rx, y, w, rowH);
        if (values[ci])
          text(values[ci], rx + 2, y + (rowH - 5.8 * 1.1) / 2 - 0.4, {
            size: 5.8,
            width: w - 4,
            height: rowH - 1,
            lineBreak: false,
          });
        rx += w;
      });
      y += rowH;
    }
    y += 8;
  }

  // ---- III. ASSESSMENT ----------------------------------------------------
  y = section(y, "III. ASSESSMENT");
  {
    const blockH = 92;
    const probW = WIDTH * 0.34;
    const assessW = WIDTH * 0.38;
    const catW = WIDTH - probW - assessW;

    // 13a. Problem/s Presented — heading on one line, body below it.
    box(LEFT, y, probW, blockH);
    text("13a. Problem/s Presented", LEFT + 3, y + 3.5, { size: 5.4, font: F.bold });
    text(data.problemsPresented ?? "", LEFT + 3, y + 13, {
      size: 6,
      width: probW - 6,
      height: blockH - 17,
    });

    // 13b. Social Worker's Assessment
    const ax = LEFT + probW;
    box(ax, y, assessW, blockH);
    text("13b. Social Worker's Assessment", ax + 3, y + 3.5, { size: 5.4, font: F.bold });
    text(data.assessment ?? "", ax + 3, y + 13, {
      size: 6,
      width: assessW - 6,
      height: blockH - 17,
    });

    // 14. Client Category (check one only) — uniform row rhythm.
    const cx = ax + assessW;
    box(cx, y, catW, blockH);
    text("14. Client Category", cx + 3, y + 3.5, { size: 5.4, font: F.bold });
    text("(Check one only)", cx + 3, y + 10, { size: 4.6, font: F.italic, color: "#444" });
    const category = (data.clientCategory ?? "").toLowerCase();
    const cats: Array<[string, boolean]> = [
      ["Children in Need of Special Protection", /child/.test(category)],
      ["Youth in Need of Special Protection", /youth/.test(category)],
      ["Women in Especially Difficult Circumstances", /women|woman/.test(category)],
      ["Person with Disability", /disab|pwd/.test(category)],
      ["Senior Citizen", /senior|elder/.test(category)],
      ["Family head and other Needy Adult", /family|indigent|needy|head/.test(category)],
    ];
    let step = y + 20;
    for (const [label, checked] of cats) {
      checkAt(cx + 4, step + 3, label, checked, { size: 5, maxWidth: catW - 14 });
      step += GRID_STEP;
    }
    y += blockH + 8;
  }

  // ---- IV. RECOMMENDED SERVICES AND ASSISTANCE ----------------------------
  y = section(y, "IV. RECOMMENDED SERVICES AND ASSISTANCE");
  {
    const topY = y;
    const leftW = WIDTH * 0.55;
    const rightX = LEFT + leftW + 8;
    const rightW = RIGHT - rightX;

    // 15. Nature of Service/Assistance
    text("15. Nature of Service/Assistance", LEFT + 1, topY, { size: 5.6, font: F.bold });

    const services = [
      ...(data.natureOfService ?? []),
      ...data.interventions.map(i => i.provided),
    ]
      .join(" ")
      .toLowerCase();
    const amount = data.interventions.reduce((sum, i) => sum + (i.amount ?? 0), 0);
    const isFinancial =
      /financial|assistance|grant|medical|burial|transport|food|education|livelihood/.test(services) ||
      amount > 0;

    // Top row of the three service kinds — one center for the whole row.
    let sy = topY + 16;
    let center = sy;
    checkAt(LEFT + 4, center, "Counseling", /counsel|psychosocial|parent|youth/.test(services), { maxWidth: 70 });
    checkAt(LEFT + 104, center, "Financial Assistance", isFinancial, { maxWidth: 92 });
    checkAt(LEFT + 236, center, "Legal Assistance", /legal|medico|pao|protection/.test(services), { maxWidth: 80 });

    // Financial assistance sub-items — uniform GRID_STEP.
    sy += GRID_STEP + 2;
    const finItems: Array<[string, RegExp]> = [
      ["Food subsidy", /food/],
      ["Livelihood", /livelihood/],
      ["Educations", /education/],
      ["Medical", /medical|health/],
      ["Burial", /burial/],
      ["Transportation", /transport/],
    ];
    for (const [label, re] of finItems) {
      checkAt(LEFT + 14, sy, label, re.test(services), { maxWidth: 92 });
      sy += GRID_STEP;
    }

    // Other assistance — label with the same gap the grid uses, then the items.
    sy += 4;
    text("Other Assistance", LEFT + 1, sy - 3.6, { size: 5.6, font: F.bold });
    sy += GRID_STEP + 3;
    const otherKeys = Object.keys(data.otherAssistance ?? {}).join(" ").toLowerCase();
    const otherItems: Array<[string, RegExp]> = [
      ["Food Pack", /food_pack|food pack/],
      ["Used Clothing", /used_clothing|clothing/],
      ["Hot Meal", /hot_meal|hot meal/],
      ["Assistive Devices", /assistive|device/],
      ["Other", /other/],
    ];
    for (const [label, re] of otherItems) {
      checkAt(LEFT + 14, sy, label, re.test(otherKeys), { maxWidth: 92 });
      sy += GRID_STEP;
    }

    // Right column — referral, amount, mode and fund source.
    // Every box starts at rightX (one column); every label sits LABEL_GAP
    // above its box; checkbox rows step GRID_STEP like the left column.
    let boxTop = topY + 8;
    aboveLabel("Referral (Specify)", rightX, boxTop);
    cell(rightX, boxTop, rightW, data.referrals.map(r => r.reason).filter(Boolean).join(", "));
    boxTop += ROW_H + LABEL_GAP + 7;

    aboveLabel("Amount of Financial Assistance to be Rendered", rightX, boxTop);
    cell(rightX, boxTop, rightW, amount > 0 ? `PHP ${amount.toLocaleString()}` : "");
    boxTop += ROW_H + LABEL_GAP + 7;

    text("Mode of Financial Assistance", rightX, boxTop, { size: 5.4, lineBreak: false });
    const mode = `${data.modeFinancialAssistance ?? ""} ${data.interventions
      .map(i => i.modeOfDelivery ?? "")
      .join(" ")}`.toLowerCase();
    const cash = /cash/.test(mode) || data.interventions.some(i => i.modeOfDelivery === "Cash");
    const cheque = /check|cheque/.test(mode);
    let ry = boxTop + 12;
    checkAt(rightX, ry, "Cash", cash, { maxWidth: 40 });
    checkAt(rightX + 62, ry, "Check", cheque, { maxWidth: 40 });
    ry += GRID_STEP;
    checkAt(rightX, ry, "Guarantee Letter", /guarantee/.test(mode), { maxWidth: 110 });
    ry += GRID_STEP;

    const fund = `${data.sourceOfFund ?? ""} ${data.legislatorSpecify ?? ""}`.toLowerCase();
    checkAt(rightX, ry, "Regular Funds", /regular/.test(fund), { maxWidth: 110 });
    ry += GRID_STEP;
    checkAt(rightX, ry, "Donation", /donation/.test(fund), { maxWidth: 110 });
    ry += GRID_STEP;
    checkAt(rightX, ry, "Priority Development Assistance Fund", /priority|pdaf/.test(fund), {
      maxWidth: 190,
    });
    ry += GRID_STEP + 2;

    // Legislator + Others — labels in one gutter, boxes on one left edge.
    const ind = rightX + 66;
    text("Legislator", rightX + 4, ry - 3.6, { size: 5.4, lineBreak: false });
    cell(ind, ry, RIGHT - ind, /legislator/.test(fund) ? data.legislatorSpecify ?? "" : "");
    ry += ROW_H + 6;
    text("Others", rightX + 4, ry - 3.6, { size: 5.4, lineBreak: false });
    cell(ind, ry, RIGHT - ind, "");

    y = Math.max(sy, ry + ROW_H) + 12;
  }

  // ---- signatures ---------------------------------------------------------
  {
    const sigY = Math.min(y + 6, 800);
    const colW = WIDTH / 3;

    // Lagda ng Kliyente
    hline(sigY, LEFT, LEFT + colW - 20, 0.6);
    text("Lagda ng Kliyente", LEFT, sigY + 2, { size: 5.2 });

    // Interviewed by — name above the rule, caption below.
    const ix = LEFT + colW;
    hline(sigY, ix, ix + colW - 20, 0.6);
    text(data.assignedWorkerName ?? "", ix, sigY - 8.5, {
      size: 6.6,
      font: F.bold,
      width: colW - 20,
      align: "center",
      lineBreak: false,
    });
    text("Interviewed by: (Name/Signature)", ix, sigY + 2, { size: 5.2 });

    // Reviewed and approved by
    const rx = LEFT + colW * 2;
    hline(sigY, rx, RIGHT, 0.6);
    text(MUNICIPAL_SIGNATORY_NAME, rx, sigY - 17, {
      size: 6.6,
      font: F.bold,
      width: RIGHT - rx,
      align: "center",
      lineBreak: false,
    });
    text(MUNICIPAL_SIGNATORY_TITLE, rx, sigY - 9.5, {
      size: 5.6,
      width: RIGHT - rx,
      align: "center",
      lineBreak: false,
    });
    text("Reviewed and Approved by:", rx, sigY + 2, { size: 5.2 });
  }

  doc.end();
  return done;
}
