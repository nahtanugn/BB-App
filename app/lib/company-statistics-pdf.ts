import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type TableRow = Array<string | number>;

export type CompanyStatisticsPdfInput = {
  companyName: string;
  year: number;
  submissionDate: string;
  membershipRows: TableRow;
  officerValues: Array<number>;
  totalMembership: number;
  associateRows: TableRow;
  ethnicityRows: TableRow;
  spiritualityRows: TableRow;
  captainName: string;
  chaplainName: string;
  receivedBy: string;
  dateReceived: string;
  dataEntryName: string;
  remarks: string;
  generatedOn: string;
};

const navy = rgb(0.035, 0.18, 0.34);
const paleBlue = rgb(0.89, 0.95, 1);
const palePurple = rgb(0.95, 0.87, 0.97);
const paleGold = rgb(1, 0.96, 0.77);
const paleCyan = rgb(0.82, 0.96, 0.97);
const white = rgb(1, 1, 1);
const ink = rgb(0.08, 0.1, 0.13);
const line = rgb(0.2, 0.24, 0.29);

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function drawTextInCell(page: PDFPage, text: string | number, x: number, y: number, width: number, height: number, font: PDFFont, size: number, align: "left" | "center" = "center") {
  const lines = wrap(String(text), font, size, width - 6).slice(0, 3);
  const lineHeight = size + 1;
  const totalHeight = lines.length * lineHeight;
  lines.forEach((value, index) => {
    const textWidth = font.widthOfTextAtSize(value, size);
    page.drawText(value, { x: align === "left" ? x + 4 : x + Math.max(3, (width - textWidth) / 2), y: y + (height + totalHeight) / 2 - (index + 1) * lineHeight + 1, size, font, color: ink });
  });
}

function drawTable(page: PDFPage, options: { x: number; top: number; widths: number[]; headers: TableRow; rows: TableRow; regular: PDFFont; bold: PDFFont; headerHeight?: number; rowHeight?: number; headerFill?: ReturnType<typeof rgb>; bodyFill?: ReturnType<typeof rgb>; firstColumnBold?: boolean }) {
  const { x, top, widths, headers, rows, regular, bold } = options;
  const headerHeight = options.headerHeight ?? 24;
  const rowHeight = options.rowHeight ?? 20;
  let currentY = top - headerHeight;
  let currentX = x;
  headers.forEach((header, index) => {
    page.drawRectangle({ x: currentX, y: currentY, width: widths[index], height: headerHeight, color: options.headerFill ?? paleBlue, borderColor: line, borderWidth: 0.7 });
    drawTextInCell(page, header, currentX, currentY, widths[index], headerHeight, bold, 6.6, index === 0 ? "left" : "center");
    currentX += widths[index];
  });
  rows.forEach((row) => {
    currentY -= rowHeight;
    currentX = x;
    row.forEach((value, index) => {
      page.drawRectangle({ x: currentX, y: currentY, width: widths[index], height: rowHeight, color: options.bodyFill ?? white, borderColor: line, borderWidth: 0.7 });
      drawTextInCell(page, value, currentX, currentY, widths[index], rowHeight, options.firstColumnBold && index === 0 ? bold : regular, 7.1, index === 0 ? "left" : "center");
      currentX += widths[index];
    });
  });
  return currentY;
}

function drawLabelValue(page: PDFPage, label: string, value: string, x: number, y: number, width: number, labelWidth: number, regular: PDFFont, bold: PDFFont) {
  page.drawRectangle({ x, y, width, height: 20, color: white, borderColor: line, borderWidth: 0.7 });
  page.drawLine({ start: { x: x + labelWidth, y }, end: { x: x + labelWidth, y: y + 20 }, color: line, thickness: 0.7 });
  drawTextInCell(page, label, x, y, labelWidth, 20, bold, 6.7, "left");
  drawTextInCell(page, value || " ", x + labelWidth, y, width - labelWidth, 20, regular, 7.1, "left");
}

function drawOfficerTable(page: PDFPage, x: number, top: number, contentWidth: number, values: number[], regular: PDFFont, bold: PDFFont) {
  const firstWidth = 136;
  const leafWidth = (contentWidth - firstWidth) / 12;
  const headerRowHeight = 12;
  const headerHeight = headerRowHeight * 3;
  const dataHeight = 19;
  const headerBottom = top - headerHeight;
  const cell = (label: string, cellX: number, cellY: number, width: number, height: number, fill = paleBlue, align: "left" | "center" = "center") => {
    page.drawRectangle({ x: cellX, y: cellY, width, height, color: fill, borderColor: line, borderWidth: 0.7 });
    drawTextInCell(page, label, cellX, cellY, width, height, bold, 6.2, align);
  };

  cell("(C) Officers", x, headerBottom, firstWidth, headerHeight, paleBlue, "left");
  let currentX = x + firstWidth;
  const drawGenderPair = (group: string, columns: number, subgroups?: string[]) => {
    cell(group, currentX, top - headerRowHeight, leafWidth * columns, headerRowHeight);
    if (subgroups) {
      subgroups.forEach((subgroup) => {
        cell(subgroup, currentX, top - headerRowHeight * 2, leafWidth * 2, headerRowHeight);
        cell("M", currentX, headerBottom, leafWidth, headerRowHeight);
        cell("F", currentX + leafWidth, headerBottom, leafWidth, headerRowHeight);
        currentX += leafWidth * 2;
      });
    } else {
      cell("M", currentX, headerBottom, leafWidth, headerRowHeight * 2);
      cell("F", currentX + leafWidth, headerBottom, leafWidth, headerRowHeight * 2);
      currentX += leafWidth * 2;
    }
  };
  drawGenderPair("SSgt", 2);
  drawGenderPair("Warrant Officer", 4, ["Working", "Studying"]);
  drawGenderPair("Officer (Lieutenant and above)", 4, ["Working", "Studying"]);
  drawGenderPair("Total", 2);

  const dataY = headerBottom - dataHeight;
  cell("Count", x, dataY, firstWidth, dataHeight, white, "left");
  values.forEach((value, index) => {
    page.drawRectangle({ x: x + firstWidth + leafWidth * index, y: dataY, width: leafWidth, height: dataHeight, color: white, borderColor: line, borderWidth: 0.7 });
    drawTextInCell(page, value, x + firstWidth + leafWidth * index, dataY, leafWidth, dataHeight, regular, 7.1);
  });
}

export async function generateCompanyStatisticsPdf(input: CompanyStatisticsPdfInput) {
  const document = await PDFDocument.create();
  document.setTitle(`Company Statistics ${input.year}`);
  document.setAuthor(input.companyName);
  document.setSubject(`Annual company statistics for ${input.year}`);
  const page = document.addPage([841.89, 595.28]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const margin = 32;
  const contentWidth = page.getWidth() - margin * 2;

  page.drawText("COMPANY STATISTICS", { x: margin, y: 548, size: 8, font: bold, color: navy });
  page.drawText(input.companyName, { x: margin, y: 527, size: 15, font: bold, color: ink });
  page.drawText(`Annual return as at ${input.year}`, { x: margin, y: 513, size: 8, font: regular, color: ink });
  const dateLabel = `Submission date: ${input.submissionDate || "-"}`;
  page.drawText(dateLabel, { x: page.getWidth() - margin - regular.widthOfTextAtSize(dateLabel, 8), y: 519, size: 8, font: regular, color: ink });

  const membershipHeaders = ["Membership", "Pre-Junior M", "Pre-Junior F", "Junior M", "Junior F", "Senior M", "Senior F", "Primer M", "Primer F", "Total M", "Total F"];
  const membershipWidths = [172, ...Array(10).fill((contentWidth - 172) / 10)];
  drawTable(page, { x: margin, top: 495, widths: membershipWidths, headers: membershipHeaders, rows: input.membershipRows, regular, bold, headerHeight: 26, rowHeight: 20, bodyFill: palePurple, firstColumnBold: true });

  drawOfficerTable(page, margin, 400, contentWidth, input.officerValues, regular, bold);

  page.drawRectangle({ x: margin, y: 315, width: 256, height: 22, color: paleCyan, borderColor: line, borderWidth: 0.7 });
  page.drawText(`TOTAL MEMBERSHIP AS AT ${input.year} (A+B+C)`, { x: margin + 6, y: 322, size: 7.2, font: bold, color: ink });
  page.drawRectangle({ x: margin + 256, y: 315, width: 38, height: 22, color: white, borderColor: line, borderWidth: 0.7 });
  drawTextInCell(page, input.totalMembership, margin + 256, 315, 38, 22, bold, 8);

  const gap = 24;
  const columnWidth = (contentWidth - gap) / 2;
  page.drawText("ASSOCIATE MEMBERS AND ALUMNI", { x: margin, y: 307, size: 7.4, font: bold, color: navy });
  drawTable(page, { x: margin, top: 298, widths: [164, ...Array(4).fill((columnWidth - 164) / 4)], headers: ["Category", "Working M", "Working F", "Studying M", "Studying F"], rows: input.associateRows, regular, bold, headerHeight: 25, rowHeight: 20, firstColumnBold: true });

  const rightX = margin + columnWidth + gap;
  page.drawText("ETHNICITY BREAKDOWN", { x: rightX, y: 307, size: 7.4, font: bold, color: navy });
  drawTable(page, { x: rightX, top: 298, widths: [102, ...Array(5).fill((columnWidth - 102) / 5)], headers: ["Section", "Chinese", "Indian", "Bumi", "Others", "Total"], rows: input.ethnicityRows, regular, bold, headerHeight: 25, rowHeight: 20, firstColumnBold: true });

  page.drawText("SPIRITUALITY", { x: margin, y: 216, size: 7.4, font: bold, color: navy });
  drawTable(page, { x: margin, top: 207, widths: [100, ...Array(3).fill((columnWidth - 100) / 3)], headers: ["Section", "Accepted Christ", "Baptised", "Non-Believer"], rows: input.spiritualityRows, regular, bold, headerHeight: 25, rowHeight: 20, firstColumnBold: true });

  page.drawText("DECLARATION", { x: margin, y: 130, size: 7.4, font: bold, color: navy });
  page.drawText("We confirm that the information provided is true and correct.", { x: margin, y: 115, size: 7.4, font: regular, color: ink });
  drawLabelValue(page, "Captain's name", input.captainName, margin, 84, columnWidth, 92, regular, bold);
  drawLabelValue(page, "Chaplain's name", input.chaplainName, margin, 62, columnWidth, 92, regular, bold);
  drawLabelValue(page, "Submission date", input.submissionDate, margin, 40, columnWidth, 92, regular, bold);

  page.drawRectangle({ x: rightX, y: 108, width: columnWidth, height: 22, color: paleGold, borderColor: line, borderWidth: 0.7 });
  drawTextInCell(page, "FOR OFFICER USE ONLY", rightX, 108, columnWidth, 22, bold, 7.4);
  drawLabelValue(page, "Received by", input.receivedBy, rightX, 84, columnWidth, 82, regular, bold);
  drawLabelValue(page, "Date received", input.dateReceived, rightX, 62, columnWidth, 82, regular, bold);
  drawLabelValue(page, "Data entry", input.dataEntryName, rightX, 40, columnWidth / 2, 64, regular, bold);
  drawLabelValue(page, "Remarks", input.remarks, rightX + columnWidth / 2, 40, columnWidth / 2, 54, regular, bold);

  const note = `Computer-generated document - no signature required. Generated ${input.generatedOn}.`;
  page.drawText(note, { x: (page.getWidth() - regular.widthOfTextAtSize(note, 6.6)) / 2, y: 18, size: 6.6, font: regular, color: ink });
  return document.save();
}
