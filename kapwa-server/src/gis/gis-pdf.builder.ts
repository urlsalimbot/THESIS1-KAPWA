import * as path from "path";
import * as fs from "fs";
import { GisPdfData } from "./gis-export.types";
import { ORG_LOCATION } from "../common/constants";

// General Intake Sheet — single-page reproduction of DSWD FO3 form
// DSWD-PMB-GF-011 | REV 01 / 30 SEPT 2022.
//
// The printed form is a dense one-page grid: every field lives in a fixed cell
// whose label sits at the top and whose value sits beneath it. Labels are
// shrink-fitted to their cell and never wrap; values wrap and clip inside their
// own cell. Every cell owns a fixed height, so no two blocks can collide no
// matter how long the loaded data is.

const FORM_NUMBER = "DSWD-PMB-GF-011 | REV 01 / 30 SEPT 2022";
const BANNER_TEXT = "MAARING MAGPATULONG SUMAGOT SA DSWD PERSONNEL";
const RED_BANNER_TEXT =
  "Huwag susulatan ang DSWD lamang ang pwede gumamit! (Do not write below this part for DSWD’s use only)";
const DECLARATION_TEXT =
  "I declare under oath that I personally accomplished the GIS Form and all the " +
  "information herein stated is TRUE, CORRECT, VALID, and COMPLETE pursuant to " +
  "existing laws, rules, and regulations of the Philippines. I authorized the " +
  "Agency/Head of Local Cooperatives/entities to avail the contents listed in place " +
  "of my signature in consideration of the said complaint and/or information. I also " +
  "agree that any MISINTERPRETATION and/or information/s of GEFRAUD the government, " +
  "including attached documents, shall cause the filing of appropriate cases against me.";
const FOOTER_TEXT =
  "DSWD Field Office III, Diosdado Macapagal Government Center, Maimpis, City of San Fernando, Pampanga, Philippines 2000\n" +
  "Website: http://www.dswd.gov.ph Tel No. (045) 961-2143";

// Signing authority printed on the form.
const APPROVER_NAME = "MARLON A. MALLARI,RSW";
const APPROVER_ROLE = "SWO II / PTL";
const APPROVER_LIC = "LIC. No. 0020647";

const LEFT = 24;
const RIGHT = 571.28;
const WIDTH = RIGHT - LEFT;

export function fmtDate(v?: Date | string): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

interface CellSpec {
  frac: number;
  label: string;
  value: string;
  size?: number;
}

export async function buildGisPdf(data: GisPdfData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PDFDocument = require("pdfkit");
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 18, bottom: 18, left: LEFT, right: 595.28 - RIGHT },
    info: {
      Title: `GIS-${data.controlNo}`,
      Author:
        data.officeName ?? "Municipal Social Welfare and Development Office",
      Subject: "General Intake Sheet",
    },
  });
  const buffers: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => buffers.push(chunk));
  const done = new Promise<Buffer>((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(buffers))),
  );

  // ---- font size bump ----------------------------------------------------
  // Add 1pt to every font size used on the form. Patching doc.fontSize keeps
  // every call site (labels, values, headers, shrink-to-fit) consistent.
  const baseFontSize = doc.fontSize.bind(doc);
  doc.fontSize = (size?: number) => baseFontSize(size == null ? size : size + 1);

  // ---- fonts ------------------------------------------------------------
  // The printed DSWD sheet is set in the Arial family. Liberation Sans is the
  // metric-compatible, open-license replacement (same widths), so these TTF
  // files are the ones shipped in src/gis/assets (mirrored to dist via
  // nest-cli.json) — they resolve from src (ts-jest), dist (runtime) and
  // .preview-build (live preview). Liberation Sans has no "Black" weight, so
  // the black role maps to its Bold face. If a file is missing the builder
  // falls back to the base-14 Helvetica family so the document still renders.
  const registerFont = (name: string, file: string): string | null => {
    const p = path.join(__dirname, "assets", file);
    try {
      if (fs.existsSync(p)) {
        doc.registerFont(name, p);
        return name;
      }
    } catch {
      /* missing/corrupt font — fall back */
    }
    return null;
  };
  const F = {
    regular:
      registerFont("LiberationSans", "LiberationSans-Regular.ttf") ??
      "Helvetica",
    bold:
      registerFont("LiberationSans-Bold", "LiberationSans-Bold.ttf") ??
      "Helvetica-Bold",
    black:
      registerFont("LiberationSans-Black", "LiberationSans-Bold.ttf") ??
      "Helvetica-Bold",
    italic:
      registerFont("LiberationSans-Italic", "LiberationSans-Italic.ttf") ??
      "Helvetica-Oblique",
  };

  // ---- primitives -------------------------------------------------------

  const hline = (y: number, x1 = LEFT, x2 = RIGHT, lw = 0.5) =>
    doc.moveTo(x1, y).lineTo(x2, y).lineWidth(lw).strokeColor("#333").stroke();
  const vline = (x: number, y1: number, y2: number, lw = 0.5) =>
    doc.moveTo(x, y1).lineTo(x, y2).lineWidth(lw).strokeColor("#333").stroke();

  // Shrink-to-fit: returns a font size at which `text` fits `maxWidth` on a
  // single line. Labels are never allowed to wrap, so they can never reach a
  // neighbouring cell.
  const fit = (
    text: string,
    font: string,
    maxWidth: number,
    size: number,
    min = 3.4,
  ): number => {
    doc.font(font).fontSize(size);
    while (size > min && doc.widthOfString(text) > maxWidth) {
      size -= 0.2;
      doc.font(font).fontSize(size);
    }
    return size;
  };

  // Field cell: tiny label on top, value below, both clipped to the cell.
  const cells = (
    y: number,
    h: number,
    specs: CellSpec[],
    useVline = true,
    useBVline = true,
    useHline = true,
  ) => {
    let x = LEFT;
    specs.forEach((s, i) => {
      const w = i === specs.length - 1 ? RIGHT - x : s.frac * WIDTH;
      const labelSize = fit(s.label, "Helvetica", w - 4, 4.6);
      const l = y + 20;
      doc
        .font("Helvetica")
        .fontSize(labelSize)
        .fillColor("#000")
        .text(s.label, x + 2, l, {
          width: w,
          lineBreak: false,
          align: "center",
        });
      doc
        .font("Helvetica")
        .fontSize(s.size ?? 7)
        .fillColor("#111")
        .text(s.value, x + 2, y + 6 + (h - (s.size ?? 7) * 1.5) / 2, {
          width: w - 4,
          height: h - 2,
          align: "center",
          ellipsis: true,
        });
      if (i > 0 && useVline === true) vline(x, y, y + h);
      x += w;
    });
    // hline(y);
    if (useHline) hline(y + h);
    if (useBVline) {
      vline(LEFT, y, y + h);
      vline(RIGHT, y, y + h);
    }
  };

  const banner = (
    y: number,
    h: number,
    text: string,
    kind: "gray" | "red",
    size = 6,
    align: "center" | "left",
    w = 0,
  ) => {
    // Changed gray to dark gray (#4a4a4a) and text to white (#fff)
    const bgColor = kind === "red" ? "#b3202c" : "#4a4a4a";
    const textColor = "#fff";

    doc
      .rect(LEFT + w / 2, y, WIDTH - w, h)
      .fillColor(bgColor)
      .fill();
    const used = fit(text, F.bold, WIDTH - 8, size);
    doc
      .font(F.bold)
      .fontSize(used)
      .fillColor(textColor)
      .text(text, LEFT + 3, y + (h - used - 1) / 1 - 1, {
        width: WIDTH - 6,
        align: align,
        lineBreak: false,
      });
  };

  const checkbox = (
    x: number,
    y: number,
    label: string,
    checked: boolean,
    labelSize = 5.4,
    maxWidth = 130,
  ) => {
    doc.rect(x, y, 6, 6).lineWidth(0.5).strokeColor("#111").stroke();
    if (checked)
      doc
        .rect(x + 1, y + 1, 4, 4)
        .fillColor("#111")
        .fill();
    const used = fit(label, "Helvetica", maxWidth, labelSize);
    doc
      .font("Helvetica")
      .fontSize(used)
      .fillColor("#111")
      .text(label, x + 8, y + 0.5, { lineBreak: false });
  };

  // Radio button: a circle with a filled centre when selected. Same footprint
  // (6x6) and label handling as checkbox(), used for mutually exclusive
  // choices such as On-Site / Off-Site.
  const radio = (
    x: number,
    y: number,
    label: string,
    checked: boolean,
    labelSize = 5.4,
    maxWidth = 130,
  ) => {
    const r = 3;
    doc
      .circle(x + r, y + r, r)
      .lineWidth(0.5)
      .strokeColor("#111")
      .stroke();
    if (checked)
      doc
        .circle(x + r, y + r, r - 1.2)
        .fillColor("#111")
        .fill();
    const used = fit(label, "Helvetica", maxWidth, labelSize);
    doc
      .font("Helvetica")
      .fontSize(used)
      .fillColor("#111")
      .text(label, x + 8, y + 0.5, { lineBreak: false });
  };

  // ---- header -----------------------------------------------------------
  const logoPath = path.join(__dirname, "assets", "DSWD-Banner.png");
  const logoY = 26;
  const logoH = 60;

  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, LEFT + 4, logoY, { fit: [110, logoH] });
    } catch {
      /* header renders without the seal */
    }
  }

  // ------------------------------------
  doc
    .font("Times-Roman")
    .fontSize(8)
    .fillColor("#111")
    .text("PROTECTIVE SERVICES DIVISION", RIGHT - 200, 28, {
      width: 240,
      align: "center",
      lineBreak: false,
    })
    .text("FIELD OFFICE III", RIGHT - 200, 37, {
      width: 240,
      align: "center",
      lineBreak: false,
    });
  doc
    .font("Helvetica")
    .fontSize(5.5)
    .fillColor("#333")
    .text(FORM_NUMBER, RIGHT - 200, 46, {
      width: 240,
      align: "center",
      lineBreak: false,
    });
  let y = 44;
  doc
    .font(F.black)
    .fontSize(12)
    .fillColor("#111")
    .text("GENERAL INTAKE SHEET", LEFT, y + 23, {
      width: WIDTH,
      align: "center",
    });
  banner(y + 38, 11, BANNER_TEXT, "gray", 6.5, "center", 250);

  // ---- case identification strip ----------------------------------------

  y += 53;
  const box = (x: number, w: number) =>
    doc
      .rect(x, y + 1, w, 13)
      .lineWidth(0.5)
      .strokeColor("#333")
      .stroke();
  doc.font("Helvetica").fontSize(6).fillColor("#111");
  doc.text("QN", LEFT + 2, y + 5, { lineBreak: false });
  box(LEFT + 16, 46);
  doc.text("PCN", LEFT + 68, y + 5, { lineBreak: false });
  box(LEFT + 84, 150);
  // doc
  //   .font("Helvetica")
  //   .fontSize(6)
  //   .fillColor("#111")
  //   .text(data.controlNo, LEFT + 87, y + 5, {
  //     width: 144,
  //     lineBreak: false,
  //     ellipsis: true,
  //   });
  doc.text("Time Start:", LEFT + 250, y + 5, { lineBreak: false });
  box(LEFT + 284, 46);
  // Date cluster — right-aligned: label → date box → year box, anchored to
  // the strip's right margin.
  const dateYearX = RIGHT - 47; // year box (44 wide) leaves a 3pt right margin
  const dateBoxX = dateYearX - 86; // 84-wide date box, 2pt gap before the year
  doc.text("Date:", dateBoxX - 23, y + 5, {
    width: 20,
    align: "right",
    lineBreak: false,
  });
  box(dateBoxX, 84);
  doc
    .font("Helvetica")
    .fontSize(6)
    .fillColor("#111")
    .text(fmtDate(data.createdAt), dateBoxX + 2, y + 5, {
      width: 80,
      align: "right",
      lineBreak: false,
    });
  box(dateYearX, 44);
  doc
    .font("Helvetica")
    .fontSize(6)
    .fillColor("#111")
    .text(String(data.createdAt.getFullYear()), dateYearX + 3, y + 5, {
      width: 38,
      lineBreak: false,
    });
  // hline(y + 15);
  y += 15;

  // ---- walk-in checkboxes ------------------------------------------------

  checkbox(LEFT + 80, y + 3, "New", !data.hasRenewal);
  checkbox(LEFT + 110, y + 3, "Returning", data.hasRenewal);
  radio(LEFT + 18 + 170, y + 3, "On-Site", data.referrals.length === 0);
  checkbox(LEFT + 18 + 210, y + 3, "Walk-in", false);
  checkbox(LEFT + 18 + 240, y + 3, "Referral", data.referrals.length > 0);
  radio(LEFT + 18 + 280, y + 3, "Off-Site", data.referrals.length > 0);
  // hline(y + 14);
  y += 14;

  // ---- beneficiary / representative blocks -------------------------------

  const personBlock = (
    heading: string,
    p: GisPdfData["beneficiary"],
    opts: { relationship?: string; unangBisita?: string } = {},
  ) => {
    banner(y, 11, heading, "gray", 8, "left");
    y += 6;
    cells(
      y,
      19,
      [
        { frac: 0.3, label: "Apelyido (Last Name)", value: p.surname },
        { frac: 0.3, label: "Unang Pangalan (First Name)", value: p.firstName },
        {
          frac: 0.28,
          label: "Gitnang Pangalan (Middle Name)",
          value: p.middleName ?? "",
        },
        { frac: 0.12, label: "Ext. (Jr./Sr.)", value: p.extension ?? "" },
      ],
      false,
      false,
    );
    y += 19;
    cells(
      y,
      19,
      [
        {
          frac: 0.24,
          label: "House No./Street/Purok (Blg No./Kalye)",
          value: p.address.street,
        },
        { frac: 0.2, label: "Barangay (Brgy)", value: p.address.barangay },
        {
          frac: 0.2,
          label: "City/Municipality (Bayan)",
          value: p.address.city,
        },
        {
          frac: 0.2,
          label: "Province/District (Distrito)",
          value: p.address.province,
        },
        {
          frac: 0.16,
          label: "Region (Rehiyon)",
          value: p.address.region || ORG_LOCATION.region,
        },
      ],
      false,
      false,
    );
    y += 19;
    cells(
      y,
      19,
      [
        {
          frac: 0.16,
          label: "Numero ng Telepono (Mobile No.)",
          value: p.phone ?? "",
        },
        {
          frac: 0.16,
          label: "Kapanganakan (Birthdate)",
          value: p.dob ? fmtDate(p.dob) : "",
        },
        {
          frac: 0.08,
          label: "Edad (Age)",
          value: p.age != null ? String(p.age) : "",
        },
        { frac: 0.1, label: "Kasarian (Sex)", value: p.sex },
        {
          frac: 0.13,
          label: "Civil Status (Katayuan)",
          value: p.civilStatus ?? "",
        },
        {
          frac: 0.18,
          label: "Trabaho (Occupation)",
          value: p.occupation ?? "",
        },
        {
          frac: 0.19,
          label: "Buwanang Kita (Monthly Salary)",
          value: p.income != null ? String(p.income) : "",
        },
      ],
      false,
      false,
    );
    // y += 13;
    // cells(
    //   y,
    //   19,
    //   [
    //     {
    //       frac: 0.26,
    //       label: "Lugar ng Kapanganakan (Place of Birth)",
    //       value: p.placeOfBirth ?? "",
    //     },
    //     {
    //       frac: 0.26,
    //       label: "Kalagayan ng Kalusugan (Health Status)",
    //       value: "",
    //     },
    //     {
    //       frac: 0.24,
    //       label: "Unang Bisita (First Visit)",
    //       value: opts.unangBisita ?? "",
    //     },
    //     { frac: 0.24, label: "Time Start", value: "" },
    //   ],
    //   false,false
    // );
    y += 19;
    if (opts.relationship !== undefined) {
      cells(
        y,
        17,
        [
          {
            frac: 0.3,
            label: "Relasyon sa Benepisyaryo (Relationship to the Beneficiary)",
            value: opts.relationship,
          },
          { frac: 0.4, label: "", value: "" },
        ],
        false,
        false,
      );
      y += 32;
    }
  };

  personBlock(
    "IMPORMASYON NG BENEPISYARYO (Beneficiary’s Identifying Information)",
    data.beneficiary,
    { unangBisita: fmtDate(data.createdAt) },
  );
  y += 12;
  personBlock(
    "IMPORMASYON NG KINATAWAN (Representative’s Identifying Information)",
    data.claimant,
    {
      relationship: data.claimant.relationshipToBeneficiary ?? "",
      unangBisita: fmtDate(data.createdAt),
    },
  );

  banner(y, 11, RED_BANNER_TEXT, "red", 8, "center");
  y += 13;

  // ---- beneficiary category + social worker's assessment -----------------

  const catTop = y;
  const catH = 84;
  const catW = 236;
  doc
    .rect(LEFT, catTop, catW, catH)
    .lineWidth(0.5)
    .strokeColor("#333")
    .stroke();
  doc
    .rect(LEFT + catW, catTop, WIDTH - catW, catH)
    .lineWidth(0.5)
    .strokeColor("#333")
    .stroke();
  doc
    .font("Helvetica-Bold")
    .fontSize(6.5)
    .fillColor("#111")
    .text("Beneficiary Category", LEFT, catTop + 3, {
      width: catW,
      lineBreak: false,
      align: "center",
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(6.5)
    .fillColor("#111")
    .text("Social worker's Assessment", LEFT + catW + 4, catTop + 3, {
      lineBreak: false,
    });
  vline(LEFT + 78, catTop + 12, catTop + catH);
  hline(catTop + 12, LEFT, RIGHT);
  doc
    .font("Helvetica-Bold")
    .fontSize(5)
    .fillColor("#333")
    .text("Target Sector", LEFT + 3, catTop + 14, { lineBreak: false })
    .text("Specify Sub-Category", LEFT + 81, catTop + 14, { lineBreak: false });

  const sectors = ["FHONA", "SC", "WEDC", "YNSP", "PWD", "PLHIV", "CNSP"];
  sectors.forEach((s, i) =>
    checkbox(
      LEFT + 8,
      catTop + 18 + i * 7,
      s,
      data.clientCategory === s,
      5.2,
      62,
    ),
  );

  const subCategories = [
    "Solo Parents",
    "Indigent People",
    "Recovering Person who used drugs",
    "4PS DSWD Beneficiary",
    "Street Dwellers",
    "Psychosocial/Mental/Learning Disability",
    "Stateless Person/Asylum Seekers/Refugees",
    "Others:",
  ];
  subCategories.forEach((s, i) =>
    checkbox(
      LEFT + 82,
      catTop + 18 + i * 7,
      s,
      data.clientCategory === s,
      5.2,
      142,
    ),
  );

  // ---- problems presented + assessment (from case data) ------------------
  // The right half of this section is the "Social worker's Assessment" box.
  // Fill it with the case's problems-presented and assessment text from the
  // database (cases.problems_presented / cases.social_worker_assessment),
  // wrapped and clipped inside the box like every other cell on this form.
  const assessmentText = (data.assessment ?? "").trim();
  if (assessmentText) {
    const abx = LEFT + catW + 4;
    const abw = WIDTH - catW - 8;
    doc
      .font(F.bold)
      .fontSize(6)
      .fillColor("#111")
      .text("Assessment:", abx, catTop + 14, {
        width: abw,
        lineBreak: false,
        ellipsis: true,
      });
    doc
      .font(F.regular)
      .fontSize(6)
      .fillColor("#111")
      .text(assessmentText || "—", abx, catTop + 22, {
        width: abw,
        height: catTop + catH - 26,
        lineGap: 1,
        ellipsis: true,
      });
  }

  y = catTop + catH;

  // ---- family composition ------------------------------------------------

  banner(
    y,
    11,
    "KOMPOSISYON NG PAMILYA (Family Composition)",
    "gray",
    6.5,
    "left",
  );
  y += 11;
  const famCols: CellSpec[] = [
    { frac: 0.30, label: "Buong Pangalan\n(Complete Name)", value: "" },
    {
      frac: 0.27,
      label: "Relasyon sa Benepisyaryo\n(Relationship to the Beneficiary)",
      value: "",
    },
    { frac: 0.09, label: "Edad\n(Age)", value: "" },
    { frac: 0.17, label: "Trabaho\n(Occupation)", value: "" },
    { frac: 0.17, label: "Buwanang Kita \n(Monthly Salary)", value: "" },
  ];
  // Header row: one- or two-line labels centred per column. Kept lines are the
  // header underline and the outer border vlines of the whole block only.
  const famHeaderH = 18;
  const famRowH = 16;
  const famRowCount = 3;
  const famTop = y;
  {
    let x = LEFT;
    famCols.forEach((s, i) => {
      const w = s.frac * WIDTH;
      const lines = s.label.split("\n");
      const used = Math.min(
        ...lines.map((ln) => fit(ln, "Helvetica-Bold", w - 4, 5)),
      );
      lines.forEach((ln, li) => {
        doc
          .font("Helvetica-Bold")
          .fontSize(used)
          .fillColor("#222")
          .text(ln, x, y + (lines.length === 1 ? 6 : 2 + li * 6), {
            width: w,
            align: "center",
            lineBreak: false,
          });
      });
      x += w;
    });
    hline(y + famHeaderH); // header bottom line only
  }
  y += famHeaderH;
  const members = (data.familyMembers ?? []).slice(0, famRowCount);
  for (let i = 0; i < famRowCount; i++) {
    const m = members[i];
    cells(
      y,
      famRowH,
      [
        { frac: 0.30, label: "", value: m?.fullName ?? "" },
        { frac: 0.27, label: "", value: m?.relationship ?? "" },
        { frac: 0.09, label: "", value: m?.age != null ? String(m.age) : "" },
        { frac: 0.17, label: "", value: m?.occupation ?? "" },
        {
          frac: 0.17,
          label: "",
          value: m?.income != null ? String(m.income) : "",
        },
      ],
      false,
      false,
      false,
    );
    y += famRowH;
  }
  // Border vlines only — the block's outer edges, header through last row.
  vline(LEFT, famTop, y);
  vline(RIGHT, famTop, y);
  hline(y); // bottom rule closes the family composition block

  // ---- needs assessment ---------------------------------------------------
  const needsH = 56; // shortened assistance-type box
  const needsCols: Array<{ title: string; items: string[] }> = [
    {
      title: "Financial Assistance",
      items: [
        "Medical",
        "Funeral",
        "Transportation",
        "Educational",
        "Food Assistance",
        "Cash Assistance for \nOther Support \nServices",
      ],
    },
    {
      title: "Material Assistance",
      items: [
        "Family Food Packs",
        "Other Food Items",
        "Hygiene & Sleeping Kits",
        "Assistive Device & Technologies",
      ],
    },
    {
      title: "Psychosocial Support",
      items: ["Psychosocial First Aid (PFA)", "Social Work Counseling"],
    },
    { title: "Referral", items: ["Other Support Services", "", "", ""] }, // 3 added fill-in lines
  ];
  const needsW = WIDTH / needsCols.length;

  const needsTop = y;
  needsCols.forEach((c, ci) => {
    const x = LEFT + ci * needsW;
    // doc.rect(x, y, needsW, needsH).lineWidth(0.5).strokeColor("#333").stroke();

    // Render title as a checkbox
    checkbox(x + 3, y + 3, c.title + ":", false, 5.5, needsW - 15);

    const startY = y + 16;
    // Extra vertical breathing room for the Psychosocial Support column.
    const pitch = c.title === "Psychosocial Support" ? 12 : 8;
    c.items.forEach((it, ii) => {
      if (c.title === "Referral") {
        // Fill-in lines: Other Support Services + 3 blank slots.
        doc
          .moveTo(x + 3, startY + ii * 8 + 5)
          .lineTo(x + needsW - 3, startY + ii * 8 + 5)
          .lineWidth(0.5)
          .strokeColor("#333")
          .stroke();
      } else if (ci === 0 && ii >= 4) {
        // Food Assistance / Cash Assistance sit on the RIGHT side of the
        // first four options (Medical, Funeral, Transportation, Educational).
        const rx = x + needsW / 2 + 7;
        const ry = startY + (ii - 4) * 14;
        doc.rect(rx - 7, ry, 6, 6).lineWidth(0.5).strokeColor("#111").stroke();
        const lines = it.split("\n");
        lines.forEach((ln, li) => {
          const used = fit(ln, "Helvetica", needsW / 2 - 24, 5.2);
          doc
            .font("Helvetica")
            .fontSize(used)
            .fillColor("#111")
            .text(ln, rx + 1, ry + li * 4.2, { lineBreak: false });
        });
      } else {
        checkbox(x + 7, startY + ii * pitch, it, false, 5.2, needsW - 15);
      }
    });
  });
  // Border vlines for the type-of-assistance block (outer edges only).
  vline(LEFT, needsTop, needsTop + needsH);
  vline(RIGHT, needsTop, needsTop + needsH);
  y += needsH;

  // ---- assistance rendered ------------------------------------------------
  const renderCols: CellSpec[] = [
    { frac: 0.08, label: "", value: "" },
    { frac: 0.44, label: "Provided", value: "" },
    { frac: 0.24, label: "Amount", value: "" },
    { frac: 0.24, label: "Fund Source", value: "" },
  ];
  {
    // Merged header cell spanning the No. and Provided columns; the remaining
    // headers are centred in their own cells so they align with the centred
    // row values below.
    const mergedW = (renderCols[0].frac + renderCols[1].frac) * WIDTH;
    const rest = renderCols.slice(2);
    doc.rect(LEFT, y, mergedW, 13).lineWidth(0.5).strokeColor("#333").stroke();
    // Centre "Provided" over the Provided column itself (not the merged cell)
    // so the header lines up with the centred values below.
    const nameColX = LEFT + renderCols[0].frac * WIDTH;
    const nameColW = renderCols[1].frac * WIDTH;
    doc
      .font("Helvetica-Bold")
      .fontSize(fit("Provided", "Helvetica-Bold", nameColW - 4, 5))
      .fillColor("#222")
      .text("Provided", nameColX, y + 4, {
        width: nameColW,
        align: "center",
        lineBreak: false,
      });
    let x = LEFT + mergedW;
    rest.forEach((s, i) => {
      const w = i === rest.length - 1 ? RIGHT - x : s.frac * WIDTH;
      vline(x, y, y + 13);
      doc
        .font("Helvetica-Bold")
        .fontSize(fit(s.label, "Helvetica-Bold", w - 4, 5))
        .fillColor("#222")
        .text(s.label, x, y + 4, {
          width: w,
          align: "center",
          lineBreak: false,
        });
      x += w;
    });
    hline(y);
    hline(y + 13);
    vline(LEFT, y, y + 13);
    vline(RIGHT, y, y + 13);
  }
  y += 13;
  const rows = (data.interventions ?? []).slice(0, 3);
  for (let i = 0; i < 3; i++) {
    const r = rows[i];
    cells(y, 14, [
      { frac: 0.08, label: "", value: String(i + 1) },
      { frac: 0.44, label: "", value: r?.provided ?? "" },
      {
        frac: 0.24,
        label: "",
        value:
          r?.amount != null ? Number(r.amount).toLocaleString("en-PH") : "",
      },
      { frac: 0.24, label: "", value: r?.fundSource ?? "" },
    ]);
    y += 14;
  }

  // ---- declaration + signatures -------------------------------------------
  // Three signature slots line the bottom edge (claimant, social worker,
  // approving authority). The slots are disjoint and every caption is
  // shrink-fitted to its slot, so nothing can collide or run off the page.

  const blockH = 96;
  const midX = LEFT + WIDTH / 2; // single middle vline: client | DSWD
  const capY = y + blockH - 18; // signature rule inside each slot
  const slotA = { x: LEFT, w: WIDTH / 2 }; // client signature (left half)
  const rw = WIDTH / 2; // right half (social worker + approving authority)
  const xL = midX + 4;
  const wL = rw / 2 - 8; // left stack of the right half (Social Worker)
  const cxL = midX + rw / 4;
  const xR = midX + rw / 2 + 4;
  const wR = rw / 2 - 8; // right stack (Approving Authority)
  const cxR = midX + (3 * rw) / 4;

  // Envelope: one border around the whole signatories block, split in the
  // middle by ONE vertical divider (client | DSWD). The DSWD side has no
  // divider between Social Worker and Approving Authority.
  doc
    .rect(LEFT, y, WIDTH, blockH)
    .lineWidth(0.5)
    .strokeColor("#333")
    .stroke();
  vline(midX, y, y + blockH);
  doc
    .font("Helvetica")
    .fontSize(5.2)
    .fillColor("#333")
    .text(DECLARATION_TEXT, slotA.x + 3, y + 9, {
      width: slotA.w - 66,
      align: "center",
      height: blockH - 40,
      lineGap: 1,
      ellipsis: true,
    });
  doc
    .rect(slotA.x + slotA.w - 62, y + 12, 58, blockH - 34)
    .lineWidth(0.5)
    .strokeColor("#999")
    .stroke();

  // DSWD side — left stack: Interviewed by (centred with the Social Worker
  // caption below it).
  doc
    .font("Helvetica")
    .fontSize(fit("Interviewed by", "Helvetica", wL - 8, 6))
    .fillColor("#111")
    .text("Interviewed by", xL, y + 12, {
      width: wL,
      align: "center",
      lineBreak: false,
    });
  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor("#111")
    .text(data.assignedWorkerName ?? "", xL, capY - 13, {
      width: wL,
      align: "center",
      height: 10,
      ellipsis: true,
    });

  // DSWD side — right stack: Reviewed & Approved by (centred with the
  // Approving Authority caption below it).
  doc
    .font("Helvetica")
    .fontSize(fit("Reviewed & Approved by", "Helvetica", wR - 8, 6))
    .fillColor("#111")
    .text("Reviewed & Approved by", xR, y + 12, {
      width: wR,
      align: "center",
      lineBreak: false,
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(fit(APPROVER_NAME, "Helvetica-Bold", wR - 8, 7))
    .fillColor("#111")
    .text(APPROVER_NAME, xR, capY - 28, {
      width: wR,
      align: "center",
      lineBreak: false,
    });
  doc
    .font("Helvetica")
    .fontSize(fit(APPROVER_ROLE, "Helvetica-Bold", wR - 8, 5.5))
    .fillColor("#333")
    .text(APPROVER_ROLE, xR, capY - 18, {
      width: wR,
      align: "center",
      lineBreak: false,
    });
  doc
    .font("Helvetica")
    .fontSize(fit(APPROVER_LIC, "Helvetica-Bold", wR - 8, 5.5))
    .fillColor("#333")
    .text(APPROVER_LIC, xR, capY - 8, {
      width: wR,
      align: "center",
      lineBreak: false,
    });



  // Signature rules + captions INSIDE each cell near the bottom — the border
  // closes below the subtext, and the labels are centred in their slots.
  const cap = (slot: { x: number; w: number }, top: string) => {
    hline(capY, slot.x + 4, slot.x + slot.w - 4);
    doc
      .font("Helvetica-Bold")
      .fontSize(fit(top, "Helvetica-Bold", slot.w - 8, 5.6))
      .fillColor("#111")
      .text(top, slot.x + 4, capY + 2, {
        width: slot.w - 8,
        align: "center",
        lineBreak: false,
      });
    doc
      .font("Helvetica")
      .fontSize(
        fit("(Signature over Printed Name)", "Helvetica", slot.w - 8, 4.6),
      )
      .fillColor("#666")
      .text("(Signature over Printed Name)", slot.x + 4, capY + 9, {
        width: slot.w - 8,
        align: "center",
        lineBreak: false,
      });
  };
  cap(slotA, "Buong Pangalan at Pirma");
  cap({ x: xL, w: wL }, "Social Worker");
  cap({ x: xR, w: wR }, "Approving Authority");



  // The envelope ends below the subtext; the footer rule follows 22pt later.
  y = y + blockH + 22;
  hline(y,LEFT+20, RIGHT-20);
  doc
    .font("Times-Bold")
    .fontSize(5)
    .fillColor("#555")
    .text(FOOTER_TEXT, LEFT, y + 3, {
      width: WIDTH,
      align: "center",
      lineBreak: false,
      ellipsis: true,
    });
  
  // SOCOTECH logo — drawn LAST so it sits on top of everything in this
  // section's print order, centred under the approver details.
  const socotechPath = path.join(__dirname, "assets", "socotech.jpg");
  if (fs.existsSync(socotechPath)) {
    try {
      doc.image(socotechPath, cxR - 20, y-24, {
        fit: [60, 36],
      });
    } catch { /* logo omitted */ }
  }

  doc.end();
  return done;
}
