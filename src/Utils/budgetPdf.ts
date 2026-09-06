import jsPDF from "jspdf";
import autotable from "jspdf-autotable";
import { Cars, Jobs } from "../Types/types";
import { DocumentType, STATUS_LABELS } from "../Types/apiTypes";
import { formatARS, formatLicence } from "../Utils/utils";
import {
  PDF_COLORS as CO,
  PDF_LAYOUT as L,
  PDF_TEXT as T,
  STATUS_CHIP,
} from "./pdfTheme";

/**
 * Render del documento (presupuesto / factura). Es un módulo **puro**: recibe
 * los datos y devuelve el `jsPDF` armado, sin tocar estado de React ni la DB.
 * El hook `useBudgetPDF` se encarga de emitir el número y de descargarlo.
 *
 * El diseño sigue los mismos tokens que la interfaz (ver `pdfTheme.ts`): bandas
 * y encabezados de tabla en `primary-800`, títulos de sección como "pills" en
 * `primary-700`, tarjetas con borde `default-200` y chips de estado con el mismo
 * color semántico que la tabla de trabajos de la app.
 */

/** `jspdf-autotable` agrega `lastAutoTable` al documento tras dibujar la tabla. */
type WithLastAutoTable = jsPDF & { lastAutoTable?: { finalY?: number } };

/** Nombre interno de la fuente de patentes una vez registrada en el documento. */
const PLATE_FONT = "FEFONT";

// Las reglas puras (totales y elegibilidad) viven en `documentRules.ts` para
// que las pantallas puedan usarlas sin arrastrar jsPDF. Se reexportan porque
// forman parte del mismo contrato de dominio.
export {
  BUDGET_VALIDITY_DAYS,
  computeTotals,
  eligibleJobsForDocument,
} from "./documentRules";
export type { BudgetTotals } from "./documentRules";
import { BUDGET_VALIDITY_DAYS } from "./documentRules";
import type { BudgetTotals } from "./documentRules";

export interface RenderBudgetParams {
  car: Cars;
  jobs: Jobs[];
  totals: BudgetTotals;
  /** Número correlativo ya emitido (ej. "PRE-000123"). */
  docNumber: string;
  docType: DocumentType;
  title: string;
  /**
   * Fuente de patentes (FE-FONT) en base64, para dibujar la patente igual que
   * en la app. Si no se pasa, se usa la tipografía estándar del documento.
   */
  plateFontBase64?: string;
}

export const renderBudgetDocument = ({
  car,
  jobs,
  totals,
  docNumber,
  docType,
  title,
  plateFontBase64,
}: RenderBudgetParams): jsPDF => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const { margin } = L;
  const contentW = pageW - margin * 2;

  // Fuente de la patente: si no se puede usar se sigue con la estándar (el
  // documento nunca debe romperse por un tema tipográfico).
  //
  // Ojo: `addFont` no valida el contenido — con datos corruptos no falla acá,
  // sino más tarde al medir o dibujar texto. Por eso se prueba a usarla en el
  // momento del registro y se deja la fuente estándar activa.
  let hasPlateFont = false;
  if (plateFontBase64) {
    try {
      doc.addFileToVFS("FE-FONT.ttf", plateFontBase64);
      doc.addFont("FE-FONT.ttf", PLATE_FONT, "normal");
      doc.setFont(PLATE_FONT, "normal");
      doc.getTextWidth("AB123CD");
      hasPlateFont = true;
    } catch {
      hasPlateFont = false;
    } finally {
      doc.setFont("helvetica", "normal");
    }
  }

  const today = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  /** Recorta un texto con elipsis para que no se desborde de su ancho. */
  const fitText = (value: string, maxW: number): string => {
    if (doc.getTextWidth(value) <= maxW) return value;
    let cut = value;
    while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > maxW) {
      cut = cut.slice(0, -1);
    }
    return `${cut}…`;
  };

  // ─── ENCABEZADO ──────────────────────────────────────────────────────
  doc.setFillColor(...CO.primaryDeep);
  doc.rect(0, 0, pageW, L.headerHeight, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(T.brand);
  doc.setTextColor(...CO.onPrimary);
  doc.text("MECÁNICA DEALBERA", margin, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(T.small);
  doc.setTextColor(...CO.primarySoft);
  doc.text("Servicio técnico automotriz", margin, 20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(T.docTitle);
  doc.setTextColor(...CO.onPrimary);
  doc.text(title.toUpperCase(), pageW - margin, 13, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(T.body);
  doc.text(`N° ${docNumber}`, pageW - margin, 20, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(T.small);
  doc.setTextColor(...CO.primarySoft);
  doc.text(today, pageW - margin, 26, { align: "right" });

  // ─── PATENTE ─────────────────────────────────────────────────────────
  let y = L.headerHeight + 8;
  const plateBoxH = 26;
  doc.setFillColor(...CO.paper);
  doc.setDrawColor(...CO.border);
  doc.setLineWidth(L.borderWidth);
  doc.roundedRect(margin, y, contentW, plateBoxH, L.radius, L.radius, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(T.small);
  doc.setTextColor(...CO.textMuted);
  doc.text("PATENTE DEL VEHÍCULO", pageW / 2, y + 7, { align: "center" });

  // La patente se dibuja con la misma tipografía que en la app (FE-FONT).
  doc.setTextColor(...CO.text);
  if (hasPlateFont) {
    doc.setFont(PLATE_FONT, "normal");
    doc.setFontSize(T.plate);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(T.plate - 2);
  }
  doc.text(formatLicence(car.licensePlate), pageW / 2, y + 20, {
    align: "center",
  });

  // ─── DATOS DEL VEHÍCULO Y DEL TITULAR ────────────────────────────────
  y += plateBoxH + L.gap;
  const colW = (contentW - L.gap) / 2;
  const cardH = 42;

  const drawInfoCard = (
    x: number,
    cardTitle: string,
    rows: [string, string][]
  ) => {
    doc.setFillColor(...CO.surface);
    doc.setDrawColor(...CO.border);
    doc.setLineWidth(L.borderWidth);
    doc.roundedRect(x, y, colW, cardH, L.radius, L.radius, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(T.sectionTitle);
    doc.setTextColor(...CO.primaryStrong);
    doc.text(cardTitle, x + 5, y + 8);

    const labelX = x + 5;
    const valueX = x + 30;
    rows.forEach(([label, value], i) => {
      const rowY = y + 16 + i * 6.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(T.label);
      doc.setTextColor(...CO.textMuted);
      doc.text(label, labelX, rowY);

      doc.setTextColor(...CO.text);
      doc.text(fitText(value, colW - 35), valueX, rowY);
    });
  };

  drawInfoCard(margin, "VEHÍCULO", [
    ["Marca", car.brand ?? "---"],
    ["Modelo", car.model ?? "---"],
    ["Año", String(car.year ?? "---")],
    ["Kilometraje", `${(car.kilometers ?? 0).toLocaleString("es-AR")} km`],
  ]);

  drawInfoCard(margin + colW + L.gap, "TITULAR", [
    ["Nombre", car.owner?.fullname ?? "---"],
    ["Teléfono", car.owner?.phone ?? "---"],
    ["Dirección", car.owner?.address ?? "---"],
    ["Localidad", car.owner?.city ?? "---"],
  ]);

  // ─── DETALLE DE TRABAJOS ─────────────────────────────────────────────
  y += cardH + 10;

  // Título de sección con el mismo look que los "pills" de la app
  // (fondo primary-700, texto blanco, esquinas redondeadas).
  const pillLabel = "DETALLE DE TRABAJOS";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(T.sectionTitle);
  const pillW = doc.getTextWidth(pillLabel) + 10;
  doc.setFillColor(...CO.primaryStrong);
  doc.roundedRect(margin, y - 5.5, pillW, 8, 2, 2, "F");
  doc.setTextColor(...CO.onPrimary);
  doc.text(pillLabel, margin + 5, y);
  y += 6;

  if (jobs.length === 0) {
    doc.setFillColor(...CO.surface);
    doc.setDrawColor(...CO.border);
    doc.setLineWidth(L.borderWidth);
    doc.roundedRect(margin, y, contentW, 18, L.radius, L.radius, "FD");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(T.body);
    doc.setTextColor(...CO.textMuted);
    doc.text(
      docType === DocumentType.INVOICE
        ? "No hay trabajos completados para facturar."
        : "No hay trabajos para presupuestar en este vehículo.",
      pageW / 2,
      y + 11,
      { align: "center" }
    );
    y += 18;
  } else {
    // El estado se dibuja como chip en `didDrawCell`, así que la celda va vacía
    // y el estado de cada fila se toma de este array paralelo.
    const rowStatuses = jobs.map((j) => j.status);

    autotable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [
        ["Descripción", "Estado", "Terceros", "Repuestos", "Mano de obra"],
      ],
      body: jobs.map((job) => {
        const partsTotal = (job.parts ?? []).reduce(
          (acc, p) => acc + p.price,
          0
        );
        // La observación para el cliente va debajo de la descripción, en la
        // misma celda: como fila aparte rompería la grilla de la tabla y el
        // cálculo de totales por columna.
        const clientNote = job.clientNote?.trim();
        return [
          clientNote
            ? `${job.description ?? ""}\n${clientNote}`
            : (job.description ?? ""),
          "",
          job.isThirdParty ? "Sí" : "No",
          partsTotal > 0 ? formatARS(partsTotal) : "---",
          formatARS(job.price ?? 0),
        ];
      }),
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: T.body,
        cellPadding: 2.5,
        lineColor: CO.border,
        lineWidth: L.borderWidth,
        textColor: CO.text,
      },
      headStyles: {
        fillColor: CO.primaryDeep,
        textColor: CO.onPrimary,
        fontStyle: "bold",
        fontSize: T.body,
        cellPadding: 3,
        lineColor: CO.primaryDeep,
      },
      bodyStyles: { fillColor: CO.surfaceAlt },
      alternateRowStyles: { fillColor: CO.surface },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 26, halign: "center" },
        2: { cellWidth: 19, halign: "center" },
        3: { cellWidth: 28, halign: "right" },
        4: { cellWidth: 30, halign: "right" },
      },
      // Chip de estado, con el mismo color semántico que en la app.
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index !== 1) return;
        const status = rowStatuses[data.row.index];
        const chip = STATUS_CHIP[status];
        if (!chip) return;

        const label = STATUS_LABELS[status] ?? status;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(T.tiny);
        const chipW = Math.min(
          doc.getTextWidth(label) + 5,
          data.cell.width - 3
        );
        const chipH = 5;
        const chipX = data.cell.x + (data.cell.width - chipW) / 2;
        const chipY = data.cell.y + (data.cell.height - chipH) / 2;

        doc.setFillColor(...chip.bg);
        doc.roundedRect(chipX, chipY, chipW, chipH, 1.5, 1.5, "F");
        doc.setTextColor(...chip.text);
        doc.text(label, chipX + chipW / 2, chipY + 3.6, { align: "center" });
      },
    });

    y = (doc as WithLastAutoTable).lastAutoTable?.finalY ?? y + 20;
  }

  // ─── TOTALES ─────────────────────────────────────────────────────────
  y += 8;
  const boxW = 88;
  const boxX = pageW - margin - boxW;

  const subtotalRows: [string, number][] = [];
  if (totals.thirdPartyTotal > 0) {
    subtotalRows.push(["Mano de obra propia", totals.ownTotal]);
    subtotalRows.push(["Mano de obra terceros", totals.thirdPartyTotal]);
  }
  if (totals.partsGrandTotal > 0) {
    subtotalRows.push(["Repuestos", totals.partsGrandTotal]);
  }

  if (subtotalRows.length > 0) {
    const subtotalH = subtotalRows.length * 7 + 6;
    doc.setFillColor(...CO.surface);
    doc.setDrawColor(...CO.border);
    doc.setLineWidth(L.borderWidth);
    doc.roundedRect(boxX, y, boxW, subtotalH, L.radius, L.radius, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(T.body);
    subtotalRows.forEach(([label, value], i) => {
      const rowY = y + 7 + i * 7;
      doc.setTextColor(...CO.textMuted);
      doc.text(label, boxX + 4, rowY);
      doc.setTextColor(...CO.text);
      doc.text(formatARS(value), pageW - margin - 4, rowY, { align: "right" });
    });
    y += subtotalH + 2;
  }

  // Bloque del total, en el color de marca (como los botones primarios).
  const totalH = 15;
  doc.setFillColor(...CO.primaryDeep);
  doc.roundedRect(boxX, y, boxW, totalH, L.radius, L.radius, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(T.docTitle);
  doc.setTextColor(...CO.onPrimary);
  doc.text("TOTAL", boxX + 5, y + 10);
  doc.text(formatARS(totals.total), pageW - margin - 4, y + 10, {
    align: "right",
  });

  // Validez: sólo aplica a los presupuestos (una factura no "vence").
  if (docType === DocumentType.BUDGET) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(T.small);
    doc.setTextColor(...CO.textSubtle);
    doc.text(
      `Presupuesto válido por ${BUDGET_VALIDITY_DAYS} días desde la fecha de emisión.`,
      margin,
      y + 10
    );
  }

  // ─── PIE DE PÁGINA (todas las páginas) ───────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...CO.primaryDeep);
    doc.rect(0, pageH - L.footerHeight, pageW, L.footerHeight, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(T.tiny);
    doc.setTextColor(...CO.primarySoft);
    doc.text(
      "Mecánica Dealbera — Servicio técnico automotriz",
      margin,
      pageH - 5
    );
    doc.text(`Página ${i} de ${totalPages}`, pageW / 2, pageH - 5, {
      align: "center",
    });
    doc.text(`${docNumber} · ${today}`, pageW - margin, pageH - 5, {
      align: "right",
    });
  }

  return doc;
};
