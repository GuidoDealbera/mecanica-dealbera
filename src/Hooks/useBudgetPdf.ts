import { useCallback, useState } from "react";
import { Cars, Jobs } from "../Types/types";
import { JobStatus, STATUS_LABELS } from "../Types/apiTypes";
import jsPDF from 'jspdf'
import autotable from 'jspdf-autotable'
import { formatARS, formatLicence } from "../Utils/utils";

export interface BudgetOptions {
  onlyCompleted?: boolean;
  title?: string;
}

type RGB = [number, number, number];

const C = {
  primaryDark:  [37, 99, 235]   as RGB,
  primaryLight: [219, 234, 254] as RGB,
  white:        [255, 255, 255] as RGB,
  black:        [15, 23, 42]    as RGB,
  gray:         [100, 116, 139] as RGB,
  grayLight:    [248, 250, 252] as RGB,
  grayBorder:   [226, 232, 240] as RGB,
  success:      [34, 197, 94]   as RGB,
  infoBlue:     [190, 210, 255] as RGB,
  purple:       [139, 92, 246]  as RGB,
};


export const useBudgetPDF = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePDF = useCallback(
    async (car: Cars, jobs: Jobs[], options: BudgetOptions = {}) => {
      setIsGenerating(true);
      setError(null);

      try {
        const {
          title = "Presupuesto de Trabajo",
          onlyCompleted = false,
        } = options;

        const filteredJobs = onlyCompleted
          ? jobs.filter(
              (j) =>
                j.status === JobStatus.COMPLETED ||
                j.status === JobStatus.DELIVERED
            )
          : jobs;

        const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
        });

        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 18;

        // ─── ENCABEZADO ────────────────────────────────────────────────
        doc.setFillColor(...C.primaryDark);
        doc.rect(0, 0, pageW, 26, "F");

        doc.setTextColor(...C.white);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("MECÁNICA DEALBERA", margin, 11);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...C.infoBlue);
        doc.text("Servicio técnico automotriz", margin, 19);

        doc.setTextColor(...C.white);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(title.toUpperCase(), pageW - margin, 11, { align: "right" });

        const today = new Date().toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...C.infoBlue);
        doc.text(`Fecha: ${today}`, pageW - margin, 19, { align: "right" });

        const docNum = `N° ${car.id.slice(0, 6).toUpperCase()}-${Date.now()
          .toString()
          .slice(-5)}`;
        doc.text(docNum, pageW - margin, 20, { align: "right" });

        // ─── PATENTE DESTACADA ─────────────────────────────────────────
        let y = 38;
        doc.setFillColor(...C.primaryLight);
        doc.roundedRect(margin, y - 7, pageW - margin * 2, 28, 4, 4, "F");

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...C.gray);
        doc.text("Patente del vehículo", pageW / 2, y - 2, { align: "center" });

        doc.setTextColor(...C.primaryDark);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(26);
        doc.text(formatLicence(car.licensePlate), pageW / 2, y + 10, {
          align: "center",
        });

        // ─── DATOS DEL VEHÍCULO Y TITULAR ─────────────────────────────
        y += 36;
        const colW = (pageW - margin * 2 - 6) / 2;

        const drawInfoBox = (
          boxX: number,
          boxY: number,
          boxTitle: string,
          rows: [string, string][]
        ) => {
          doc.setFillColor(...C.grayLight);
          doc.setDrawColor(...C.grayBorder);
          doc.setLineWidth(0.3);
          doc.roundedRect(boxX, boxY, colW, 46, 3, 3, "FD");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(...C.primaryDark);
          doc.text(boxTitle, boxX + 4, boxY + 7);

          rows.forEach(([label, value], i) => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(...C.gray);
            doc.text(label, boxX + 4, boxY + 16 + i * 8);

            doc.setFont("helvetica", "normal");
            doc.setTextColor(...C.black);
            const maxW = colW - 28;
            const textW = doc.getTextWidth(value);
            const safeValue =
              textW > maxW
                ? value.slice(
                    0,
                    Math.max(
                      1,
                      Math.floor(value.length * (maxW / textW)) - 1
                    )
                  ) + "…"
                : value;
            doc.text(safeValue, boxX + 28, boxY + 16 + i * 8);
          });
        };

        drawInfoBox(margin, y, "DATOS DEL VEHÍCULO", [
          ["Marca:", car.brand ?? "---"],
          ["Modelo:", car.model ?? "---"],
          ["Año:", String(car.year ?? "---")],
          [
            "Kilometraje:",
            `${(car.kilometers ?? 0).toLocaleString("es-AR")} km`,
          ],
        ]);

        drawInfoBox(margin + colW + 6, y, "DATOS DEL TITULAR", [
          ["Nombre:", car.owner?.fullname ?? "---"],
          ["Teléfono:", car.owner?.phone ?? "---"],
          ["Dirección:", car.owner?.address ?? "---"],
          ["Localidad:", car.owner?.city ?? "---"],
        ]);

        // ─── TABLA DE TRABAJOS ─────────────────────────────────────────
        y += 56;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...C.primaryDark);
        doc.text("DETALLE DE TRABAJOS", margin, y);
        y += 5;

        if (filteredJobs.length === 0) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(9);
          doc.setTextColor(...C.gray);
          doc.text(
            onlyCompleted
              ? "No hay trabajos completados o entregados para este vehículo."
              : "No hay trabajos registrados para este vehículo.",
            margin,
            y + 10
          );
          y += 22;
        } else {
          autotable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [["Descripción", "Estado", "Terceros", "Precio"]],
            body: filteredJobs.map((job) => [
              job.description ?? "",
              STATUS_LABELS[job.status] ?? job.status,
              job.isThirdParty ? "Sí" : "No",
              formatARS(job.price ?? 0),
            ]),
            headStyles: {
              fillColor: C.primaryDark,
              textColor: C.white,
              fontStyle: "bold",
              fontSize: 9,
              cellPadding: 4,
            },
            bodyStyles: {
              fontSize: 9,
              cellPadding: 3,
              textColor: C.black,
            },
            alternateRowStyles: {
              fillColor: C.grayLight,
            },
            columnStyles: {
              0: { cellWidth: "auto" },
              1: { cellWidth: 30, halign: "center" },
              2: { cellWidth: 22, halign: "center" },
              3: { cellWidth: 32, halign: "right" },
            },
            didDrawPage: (data) => {
              if (data.cursor) y = data.cursor.y;
            },
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          y = (doc as any).lastAutoTable?.finalY ?? y + filteredJobs.length * 10 + 20;
        }

        // ─── TOTALES ───────────────────────────────────────────────────
        y += 8;
        const total = filteredJobs.reduce(
          (acc, j) => acc + (j.price ?? 0),
          0
        );
        const thirdPartyTotal = filteredJobs
          .filter((j) => j.isThirdParty)
          .reduce((acc, j) => acc + (j.price ?? 0), 0);
        const ownTotal = total - thirdPartyTotal;

        const boxW = 82;
        const boxX = pageW - margin - boxW;
        const hasThirdParty = thirdPartyTotal > 0;

        if (hasThirdParty) {
          doc.setFillColor(...C.grayLight);
          doc.setDrawColor(...C.grayBorder);
          doc.setLineWidth(0.3);
          doc.roundedRect(boxX, y, boxW, 22, 3, 3, "FD");

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(...C.gray);
          doc.text("Trabajos propios:", boxX + 4, y + 8);
          doc.setTextColor(...C.black);
          doc.text(formatARS(ownTotal), pageW - margin - 4, y + 8, {
            align: "right",
          });

          doc.setTextColor(...C.gray);
          doc.text("Trabajos de terceros:", boxX + 4, y + 17);
          doc.setTextColor(...C.black);
          doc.text(formatARS(thirdPartyTotal), pageW - margin - 4, y + 17, {
            align: "right",
          });

          y += 24;
        }

        // Bloque total principal
        doc.setFillColor(...C.primaryDark);
        doc.roundedRect(boxX, y, boxW, 16, 3, 3, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...C.white);
        doc.text("TOTAL:", boxX + 5, y + 11);
        doc.text(formatARS(total), pageW - margin - 4, y + 11, {
          align: "right",
        });

        // ─── PIE DE PÁGINA (todas las páginas) ─────────────────────────
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFillColor(...C.primaryDark);
          doc.rect(0, pageH - 11, pageW, 11, "F");

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(...C.infoBlue);
          doc.text(
            "Mecánica Dealbera — Servicio técnico automotriz",
            margin,
            pageH - 4
          );
          doc.text(`Generado el ${today}`, pageW - margin, pageH - 4, {
            align: "right",
          });
          doc.text(`Página ${i} de ${totalPages}`, pageW / 2, pageH - 4, {
            align: "center",
          });
        }

        // ─── GUARDAR ───────────────────────────────────────────────────
        const safeName = title.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, "_").replace(/\s+/g, "_");
        const filename = `${safeName}_${car.licensePlate}_${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`;

        doc.save(filename);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Error desconocido al generar el PDF";
        setError(msg);
        throw new Error(msg);
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  return { generatePDF, isGenerating, error };
};