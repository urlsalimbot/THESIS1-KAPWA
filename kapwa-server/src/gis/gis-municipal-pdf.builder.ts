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
// The form is a fixed grid: every field owns a cell, values wrap and clip
// inside it, and nothing reflows — so no amount of loaded data can move a
// neighbouring block.
// ---------------------------------------------------------------------------

const LEFT = 20;
const RIGHT = 575.28;
const WIDTH = RIGHT - LEFT;

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

  /** Small caption printed under a value box (Apelyido, Unang Pangalan, …). */
  const caption = (value: string, x: number, y: number, w: number, size = 4.6) => {
    const used = fit(value, F.regular, w - 2, size);
    text(value, x + 1, y, { size: used, width: w - 2, align: "center", lineBreak: false });
  };

  /** Bordered cell holding a wrapped value. */
  const cell = (
    x: number,
    y: number,
    w: number,
    h: number,
    value: string,
    opts: { size?: number; align?: "left" | "center" | "right"; font?: string; pad?: number } = {},
  ) => {
    box(x, y, w, h);
    const pad = opts.pad ?? 2;
    if (value)
      text(value, x + pad, y + pad, {
        size: opts.size ?? 6.4,
        width: w - pad * 2,
        height: h - pad * 2,
        align: opts.align ?? "left",
        font: opts.font,
      });
  };

  /** Checkbox with a label — the form's dominant control. */
  const check = (
    x: number,
    y: number,
    label: string,
    checked: boolean,
    opts: { size?: number; maxWidth?: number; boxSize?: number } = {},
  ) => {
    const s = opts.boxSize ?? 6;
    doc.rect(x, y, s, s).lineWidth(0.6).strokeColor("#333").stroke();
    if (checked) doc.rect(x + 1.1, y + 1.1, s - 2.2, s - 2.2).fillColor("#111").fill();
    const maxW = opts.maxWidth ?? 130;
    const size = fit(label, F.regular, maxW, opts.size ?? 5.6);
    text(label, x + s + 2, y + 0.6, { size, width: maxW, lineBreak: false });
    return x + s + 2 + doc.widthOfString(label) + 2;
  };

  /** Section heading bar: "I. PERSONAL INFORMATION". */
  const section = (y: number, heading: string): number => {
    text(heading, LEFT + 1, y, { size: 7, font: F.bold });
    hline(y + 10.5, LEFT, RIGHT, 0.8);
    return y + 14;
  };

  hero: {
    // ---- letterhead -------------------------------------------------------
    const logoPath = path.join(__dirname, "assets", "norzagaray-bulacan-official-logo.png");
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
    ["MM", "DD", "YY"].forEach((cap, i) => {
      const x = dbX + i * (dbW + dbGap);
      const parts = [
        data.createdAt.getMonth() + 1,
        data.createdAt.getDate(),
        data.createdAt.getFullYear() % 100,
      ];
      cell(x, dbY, dbW, dbH, String(parts[i]).padStart(2, "0"), { align: "center", size: 7 });
      caption(cap, x, dbY + dbH + 0.5, dbW, 4.8);
    });

    hline(76);

    // Approved control number, printed under the title so the sheet is traceable.
    text(`Control No.: ${data.controlNo}`, titleX, 66, {
      size: 6,
      width: titleW,
      align: "center",
      lineBreak: false,
      color: "#333",
    });
  }

  // ---- I. PERSONAL INFORMATION -------------------------------------------
  let y = section(82, "I. PERSONAL INFORMATION");

  // 1. Kliyente — surname / first name / middle name, captions beneath.
  text("1. Kliyente", LEFT + 1, y + 3, { size: 6 });
  {
    const bx = LEFT + 66;
    const bw = (RIGHT - bx) / 3;
    const bh = 17;
    cell(bx, y, bw, bh, data.beneficiary.surname);
    cell(bx + bw, y, bw, bh, data.beneficiary.firstName);
    cell(bx + bw * 2, y, bw, bh, data.beneficiary.middleName ?? "");
    caption("Apelyido", bx, y + bh + 0.5, bw);
    caption("Unang Pangalan", bx + bw, y + bh + 0.5, bw);
    caption("Gitnang Apelyido", bx + bw * 2, y + bh + 0.5, bw);
    y += bh + 9;
  }

  // 2. Kasarian + Edad
  {
    const rowY = y;
    text("2. Kasarian", LEFT + 1, rowY + 2, { size: 6 });
    check(LEFT + 62, rowY, "Lalaki", data.beneficiary.sex.toLowerCase().startsWith("male"), {
      maxWidth: 34,
    });
    check(LEFT + 106, rowY, "Babae", data.beneficiary.sex.toLowerCase().startsWith("female"), {
      maxWidth: 34,
    });
    text("Edad:", LEFT + 168, rowY + 2, { size: 6 });
    cell(LEFT + 196, rowY - 1, 42, 14, data.beneficiary.age != null ? String(data.beneficiary.age) : "", {
      align: "center",
    });
    y += 18;
  }

  // 4a. Kaarawan (MM/DD/YY) + 4b. Birthplace
  {
    const rowY = y;
    text("4a. Kaarawan", LEFT + 1, rowY + 2, { size: 6 });
    const dob = data.beneficiary.dob;
    const parts = dob
      ? [
          String(dob.getMonth() + 1).padStart(2, "0"),
          String(dob.getDate()).padStart(2, "0"),
          String(dob.getFullYear() % 100).padStart(2, "0"),
        ]
      : ["", "", ""];
    const cols = ["MM", "DD", "YY"];
    let bx = LEFT + 66;
    parts.forEach((p, i) => {
      cell(bx, rowY - 1, 32, 14, p, { align: "center" });
      caption(cols[i], bx, rowY + 14, 32);
      bx += 36;
    });
    text("4b. Birthplace", LEFT + 190, rowY + 2, { size: 6 });
    cell(LEFT + 250, rowY - 1, RIGHT - (LEFT + 250), 14, data.beneficiary.placeOfBirth ?? "");
    y += 21;
  }

  // 5. Civil Status + 6. Telepono
  {
    const rowY = y;
    const civil = (data.beneficiary.civilStatus ?? "").toLowerCase();
    text("5. Civil Status", LEFT + 1, rowY + 2, { size: 6 });
    let cx = LEFT + 66;
    cx = check(cx, rowY, "Single", civil === "single", { maxWidth: 30 });
    cx = check(cx + 4, rowY, "Married", civil === "married", { maxWidth: 34 });
    check(cx + 4, rowY, "Other", civil !== "" && civil !== "single" && civil !== "married", {
      maxWidth: 28,
    });
    text("6. Telepono", LEFT + 300, rowY + 2, { size: 6 });
    cell(LEFT + 352, rowY - 1, RIGHT - (LEFT + 352), 14, data.beneficiary.phone ?? "");
    y += 19;
  }

  // 7. Tirahan (No./Building, Street, Barangay, Municipality, Province)
  {
    const rowY = y;
    text("7. Tirahan", LEFT + 1, rowY + 2, { size: 6 });
    const bx = LEFT + 66;
    const bw = RIGHT - bx;
    const bh = 16;
    // The captions below are the form's five address fields, so print each
    // value under its own caption instead of one pasted blob.
    const fieldW = bw / 5;
    const fields = ["", data.beneficiary.address.street, data.beneficiary.address.barangay, data.beneficiary.address.city, data.beneficiary.address.province];
    fields.forEach((v, i) => cell(bx + fieldW * i, rowY - 1, fieldW, bh, v));
    ["No./Building Name", "Street", "Barangay", "Municipality", "Province"].forEach((cap, i) =>
      caption(cap, bx + fieldW * i, rowY + bh + 0.5, fieldW),
    );
    y += bh + 9;
  }

  // 8. Provincial Address
  {
    const rowY = y;
    text("8. Provincial Address", LEFT + 1, rowY + 2, { size: 5.6 });
    cell(
      LEFT + 66,
      rowY - 1,
      RIGHT - (LEFT + 66),
      14,
      data.beneficiary.provincialAddress ?? "",
    );
    y += 19;
  }

  // 9. Natapos sa Pag-aaral + 10. Hanapbuhay
  {
    const rowY = y;
    text("9. Natapos sa Pag-aaral", LEFT + 1, rowY + 2, { size: 5.6 });
    cell(LEFT + 90, rowY - 1, 130, 14, "");
    text("10. Hanapbuhay", LEFT + 230, rowY + 2, { size: 5.6 });
    cell(LEFT + 296, rowY - 1, RIGHT - (LEFT + 296), 14, data.beneficiary.occupation ?? "");
    y += 19;
  }

  // 11. Estimated Monthly Income + 12. Mode of Admission
  {
    const rowY = y;
    text("11. Estimated Monthly Income", LEFT + 1, rowY + 2, { size: 5.6 });
    cell(
      LEFT + 108,
      rowY - 1,
      110,
      14,
      data.beneficiary.income != null ? `PHP ${data.beneficiary.income.toLocaleString()}` : "",
    );
    const referral = data.referrals.length > 0;
    text("12. Mode of Admission", LEFT + 230, rowY + 2, { size: 5.6 });
    let mx = LEFT + 316;
    mx = check(mx, rowY, "Walk-in", !referral, { maxWidth: 32 });
    check(mx + 4, rowY, "Referral", referral, { maxWidth: 32 });
    y += 19;
  }

  // 9/Philhealth No. + referring party (the paper form repeats the number 9 here)
  {
    const rowY = y;
    text("Philhealth No.", LEFT + 1, rowY + 2, { size: 5.6 });
    cell(LEFT + 66, rowY - 1, 150, 14, "");
    text("Address/Contact # of Referring Party", LEFT + 230, rowY + 2, { size: 5.6 });
    cell(
      LEFT + 356,
      rowY - 1,
      RIGHT - (LEFT + 356),
      14,
      data.referrals.map(r => r.reason).filter(Boolean).join(", "),
    );
    y += 22;
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
      text(c.label, cx + 2, y + 3.5, {
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
      let rx = LEFT;
      const values = m
        ? [
            m.fullName,
            m.age != null ? String(m.age) : "",
            m.relationship,
            m.occupation ?? "",
          ]
        : ["", "", "", ""];
      cols.forEach((c, ci) => {
        const w = ci === cols.length - 1 ? RIGHT - rx : c.frac * WIDTH;
        box(rx, y, w, rowH);
        if (values[ci])
          text(values[ci], rx + 2, y + 3, { size: 5.8, width: w - 4, lineBreak: false });
        rx += w;
      });
      y += rowH;
    }
    y += 6;
  }

  // ---- III. ASSESSMENT ----------------------------------------------------
  y = section(y, "III. ASSESSMENT");
  {
    const blockH = 92;
    const probW = WIDTH * 0.34;
    const assessW = WIDTH * 0.38;
    const catW = WIDTH - probW - assessW;

    // 13a. Problem/s Presented
    box(LEFT, y, probW, blockH);
    text("13a. Problem/s Presented", LEFT + 2, y + 3, { size: 5.4, font: F.bold });
    text(data.problemsPresented ?? "", LEFT + 3, y + 12, {
      size: 6,
      width: probW - 6,
      height: blockH - 16,
    });

    // 13b. Social Worker's Assessment
    const ax = LEFT + probW;
    box(ax, y, assessW, blockH);
    text("13b. Social Worker's Assessment", ax + 2, y + 3, { size: 5.4, font: F.bold });
    text(data.assessment ?? "", ax + 3, y + 12, {
      size: 6,
      width: assessW - 6,
      height: blockH - 16,
    });

    // 14. Client Category (check one only)
    const cx = ax + assessW;
    box(cx, y, catW, blockH);
    text("14. Client Category", cx + 2, y + 3, { size: 5.4, font: F.bold });
    text("(Check one only)", cx + 2, y + 9.5, { size: 4.6, font: F.italic, color: "#444" });
    const category = (data.clientCategory ?? "").toLowerCase();
    const cats: Array<[string, boolean]> = [
      ["Children in Need of Special Protection", /child/.test(category)],
      ["Youth in Need of Special Protection", /youth/.test(category)],
      ["Women in Especially Difficult Circumstances", /women|woman/.test(category)],
      ["Person with Disability", /disab|pwd/.test(category)],
      ["Senior Citizen", /senior|elder/.test(category)],
      ["Family head and other Needy Adult", /family|indigent|needy|head/.test(category)],
    ];
    let cy = y + 16;
    for (const [label, checked] of cats) {
      // Wrap the long category labels onto two lines inside the cell.
      doc.rect(cx + 3, cy, 6, 6).lineWidth(0.6).strokeColor("#333").stroke();
      if (checked) doc.rect(cx + 4.1, cy + 1.1, 3.8, 3.8).fillColor("#111").fill();
      text(label, cx + 11, cy - 0.4, { size: 5, width: catW - 14, height: 9 });
      cy += label.length > 28 ? 13.5 : 9.5;
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
      /financial|assistance|grant|medical|burial|transport|food|education|livelihood/.test(
        services,
      ) || amount > 0;

    let sy = topY + 10;
    check(LEFT + 4, sy, "Counseling", /counsel|psychosocial|parent|youth/.test(services), {
      maxWidth: 70,
    });
    check(LEFT + 96, sy, "Financial Assistance", isFinancial, { maxWidth: 90 });
    check(LEFT + 218, sy, "Legal Assistance", /legal|medico|pao|protection/.test(services), {
      maxWidth: 80,
    });

    // Financial assistance sub-items.
    sy += 12;
    const finItems: Array<[string, RegExp]> = [
      ["Food subsidy", /food/],
      ["Livelihood", /livelihood/],
      ["Educations", /education/],
      ["Medical", /medical|health/],
      ["Burial", /burial/],
      ["Transportation", /transport/],
    ];
    for (const [label, re] of finItems) {
      check(LEFT + 12, sy, label, re.test(services), { maxWidth: 90 });
      sy += 10.5;
    }

    // Other assistance.
    sy += 2;
    text("Other Assistance", LEFT + 1, sy, { size: 5.6, font: F.bold });
    sy += 10;
    const otherKeys = Object.keys(data.otherAssistance ?? {}).join(" ").toLowerCase();
    const otherItems: Array<[string, RegExp]> = [
      ["Food Pack", /food_pack|food pack/],
      ["Used Clothing", /used_clothing|clothing/],
      ["Hot Meal", /hot_meal|hot meal/],
      ["Assistive Devices", /assistive|device/],
      ["Other", /other/],
    ];
    for (const [label, re] of otherItems) {
      check(LEFT + 12, sy, label, re.test(otherKeys), { maxWidth: 90 });
      sy += 10.5;
    }

    // Right column — referral, amount, mode and fund source.
    let ry = topY + 10;
    text("Referral (Specify)", rightX, ry - 9, { size: 5.4 });
    cell(rightX, ry, rightW, 14, data.referrals.map(r => r.reason).filter(Boolean).join(", "));
    ry += 20;

    text("Amount of Financial Assistance to be Rendered", rightX, ry - 8, { size: 5.4 });
    cell(rightX, ry, rightW, 14, amount > 0 ? `PHP ${amount.toLocaleString()}` : "");
    ry += 20;

    text("Mode of Financial Assistance", rightX, ry, { size: 5.4 });
    const mode = `${data.modeFinancialAssistance ?? ""} ${data.interventions
      .map(i => i.modeOfDelivery ?? "")
      .join(" ")}`.toLowerCase();
    const cash = /cash/.test(mode) || data.interventions.some(i => i.modeOfDelivery === "Cash");
    const cheque = /check|cheque/.test(mode);
    ry += 9;
    check(rightX + 4, ry, "Cash", cash, { maxWidth: 40 });
    check(rightX + 58, ry, "Check", cheque, { maxWidth: 40 });
    ry += 12;
    check(rightX + 4, ry, "Guarantee Letter", /guarantee/.test(mode), { maxWidth: 100 });
    ry += 12;

    const fund = `${data.sourceOfFund ?? ""} ${data.legislatorSpecify ?? ""}`.toLowerCase();
    check(rightX + 4, ry, "Regular Funds", /regular/.test(fund), { maxWidth: 100 });
    ry += 10.5;
    check(rightX + 4, ry, "Donation", /donation/.test(fund), { maxWidth: 100 });
    ry += 10.5;
    check(rightX + 4, ry, "Priority Development Assistance Fund", /priority|pdaf/.test(fund), {
      maxWidth: 170,
    });
    ry += 10.5;
    text("Legislator", rightX + 12, ry, { size: 5.4 });
    cell(rightX + 46, ry - 1.5, rightW - 46, 12, /legislator/.test(fund) ? data.legislatorSpecify ?? "" : "");
    ry += 16;
    text("Others", rightX + 12, ry, { size: 5.4 });
    cell(rightX + 40, ry - 1.5, rightW - 40, 12, "");

    // The IV block is as tall as its longer column.
    y = Math.max(sy, ry) + 12;
  }

  // ---- signatures ---------------------------------------------------------
  {
    const sigY = Math.min(y + 6, 800);
    const colW = WIDTH / 3;

    // Lagda ng Kliyente
    hline(sigY, LEFT, LEFT + colW - 20, 0.6);
    text("Lagda ng Kliyente", LEFT, sigY + 2, { size: 5.2 });

    // Interviewed by
    const ix = LEFT + colW;
    hline(sigY, ix, ix + colW - 20, 0.6);
    text(data.assignedWorkerName ?? "", ix, sigY - 8, {
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
    text(MUNICIPAL_SIGNATORY_TITLE, rx, sigY - 8.5, {
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
