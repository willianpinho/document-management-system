/**
 * Real file generators used by the seed script. Every document seeded
 * uploads bytes produced here, so name / mimeType / metadata always
 * describe the actual uploaded content — never a stub.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function generatePDF(title: string, content: string, pages = 1): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const contentPages = content.split('\f'); // form-feed separates page content

  for (let i = 0; i < pages; i++) {
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    page.drawText(title, {
      x: 50,
      y: height - 50,
      size: 22,
      font: boldFont,
      color: rgb(0.13, 0.13, 0.13),
    });
    page.drawText(`Page ${i + 1} of ${pages}`, {
      x: width - 100,
      y: 30,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    const pageContent = contentPages[i] ?? '';
    let yPosition = height - 100;
    for (const line of pageContent.split('\n')) {
      if (yPosition < 50) break;
      page.drawText(line.substring(0, 90), { x: 50, y: yPosition, size: 11, font });
      yPosition -= 18;
    }
  }

  return Buffer.from(await pdfDoc.save());
}

export function generateTextFile(content: string): Buffer {
  return Buffer.from(content, 'utf-8');
}

export function generateCSV(headers: string[], rows: string[][]): Buffer {
  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  return Buffer.from(csvContent, 'utf-8');
}
