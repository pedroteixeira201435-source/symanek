import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { college, formatN } from "./content";

// Builds the official approval / EFT-instruction letter as a PDF (A4).
// Server-only (called from /api/letter). Bank details come from college.bank —
// keep those real in lib/content.ts.
export async function buildApprovalLetter(opts: {
  reference: string;
  fullName: string;
  programme: string;
  amountDue: number;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 in points
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const petrol = rgb(0.145, 0.306, 0.451);
  const ink = rgb(0.12, 0.16, 0.2);
  const muted = rgb(0.42, 0.48, 0.53);
  const M = 56;
  let y = height - 64;

  const text = (s: string, x: number, yy: number, size: number, f = font, color = ink) =>
    page.drawText(s, { x, y: yy, size, font: f, color });

  // Header
  text(college.name, M, y, 20, bold, petrol);
  y -= 20;
  text(college.location, M, y, 10, font, muted);
  y -= 12;
  text(`${college.contact.emails[0]}  ·  ${college.contact.phones[0]}`, M, y, 10, font, muted);

  y -= 28;
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 1, color: rgb(0.85, 0.88, 0.9) });
  y -= 34;

  text("LETTER OF ADMISSION", M, y, 15, bold, ink);
  y -= 30;

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  text(today, M, y, 10, font, muted);
  y -= 28;

  text(`Dear ${opts.fullName},`, M, y, 12, font, ink);
  y -= 24;

  const para = (s: string) => {
    for (const line of wrap(s, 92)) {
      text(line, M, y, 11, font, ink);
      y -= 16;
    }
    y -= 8;
  };

  para(
    `Congratulations! We are pleased to offer you admission to the ${opts.programme} at ${college.name}. ` +
      `Your application has been reviewed and approved.`
  );
  para(
    `Your unique student reference is shown below. Please use this exact reference on your bank transfer (EFT) ` +
      `so that we can match your payment and confirm your enrolment.`
  );

  // Reference + amount box
  y -= 4;
  const boxH = opts.amountDue > 0 ? 92 : 64;
  page.drawRectangle({ x: M, y: y - boxH, width: width - 2 * M, height: boxH, color: rgb(0.96, 0.97, 0.98), borderColor: rgb(0.85, 0.88, 0.9), borderWidth: 1 });
  let by = y - 22;
  text("STUDENT REFERENCE", M + 16, by, 8, bold, muted);
  by -= 18;
  text(opts.reference, M + 16, by, 18, bold, petrol);
  if (opts.amountDue > 0) {
    by -= 26;
    text("AMOUNT DUE", M + 16, by, 8, bold, muted);
    by -= 16;
    text(formatN(opts.amountDue), M + 16, by, 14, bold, ink);
  }
  y -= boxH + 24;

  // Bank details
  text("Banking details for EFT payment", M, y, 12, bold, ink);
  y -= 20;
  const rows: [string, string][] = [
    ["Bank", college.bank.bankName],
    ["Account name", college.bank.accountName],
    ["Account number", college.bank.accountNumber],
    ["Branch code", college.bank.branchCode],
    ["SWIFT", college.bank.swift],
    ["Payment reference", opts.reference],
  ];
  for (const [k, v] of rows) {
    text(k, M, y, 11, font, muted);
    text(v, M + 150, y, 11, bold, ink);
    y -= 17;
  }

  y -= 16;
  para(
    `After payment, please allow 1–2 business days for confirmation. Once your fees are received you will be ` +
      `enrolled and given access to the student portal. If you have any questions, contact us at ` +
      `${college.contact.emails[0]}.`
  );

  y -= 4;
  text("Warm regards,", M, y, 11, font, ink);
  y -= 18;
  text("Admissions Office", M, y, 11, bold, ink);
  y -= 15;
  text(college.name, M, y, 11, font, muted);

  return doc.save();
}

function wrap(s: string, max: number): string[] {
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
