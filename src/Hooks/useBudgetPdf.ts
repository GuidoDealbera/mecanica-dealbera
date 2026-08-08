import { useCallback, useState } from "react";
import { Cars, Jobs } from "../Types/types";
import { DocumentType, type IssuedDocument } from "../Types/apiTypes";
import {
  computeTotals,
  filterJobsForDocument,
  renderBudgetDocument,
} from "../Utils/budgetPdf";
import { getPlateFontBase64 } from "../Utils/plateFont";

export interface BudgetOptions {
  onlyCompleted?: boolean;
  title?: string;
  /**
   * Tipo de documento a emitir (define la serie del correlativo). Si no se
   * pasa, se deduce: sólo-completados = factura, resto = presupuesto.
   */
  type?: DocumentType;
}

/**
 * Orquesta la emisión de un documento: pide el número correlativo a la DB,
 * delega el dibujo en `renderBudgetDocument` (módulo puro) y lo descarga.
 */
export const useBudgetPDF = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Emite el documento (asigna su número correlativo en la DB) y descarga el
   * PDF. Devuelve el documento emitido para que el consumidor pueda mostrar el
   * número. Si algo falla, descarta el número y lanza el error.
   */
  const generatePDF = useCallback(
    async (
      car: Cars,
      jobs: Jobs[],
      options: BudgetOptions = {}
    ): Promise<IssuedDocument> => {
      setIsGenerating(true);
      setError(null);

      let issuedId: string | null = null;
      try {
        const { title = "Presupuesto de Trabajo", onlyCompleted = false } =
          options;
        const docType =
          options.type ??
          (onlyCompleted ? DocumentType.INVOICE : DocumentType.BUDGET);

        const filteredJobs = filterJobsForDocument(jobs, onlyCompleted);
        // Los totales se calculan antes de emitir: el total forma parte del
        // registro del documento (snapshot de lo que se entregó).
        const totals = computeTotals(filteredJobs);

        // El número lo asigna la DB (transaccional, por tipo de documento), no
        // el frontend: así es correlativo y queda registrado qué se emitió.
        const issued = await window.api.documents.issue({
          type: docType,
          licensePlate: car.licensePlate,
          clientName: car.owner?.fullname ?? "",
          total: totals.total,
        });
        if (issued.status !== "success") {
          throw new Error(issued.message);
        }
        issuedId = issued.result.id;
        const docNumber = issued.result.formatted;

        const doc = renderBudgetDocument({
          car,
          jobs: filteredJobs,
          totals,
          docNumber,
          docType,
          title,
          onlyCompleted,
          plateFontBase64: getPlateFontBase64(),
        });

        // El nombre del archivo arranca con el número correlativo para que los
        // documentos queden ordenados en el explorador.
        const safeName = title
          .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, "_")
          .replace(/\s+/g, "_");
        doc.save(`${docNumber}_${safeName}_${car.licensePlate}.pdf`);

        return issued.result;
      } catch (err) {
        // Si algo falló después de tomar el número, se descarta el documento
        // para no dejar un hueco en el correlativo.
        if (issuedId) {
          try {
            await window.api.documents.discard(issuedId);
          } catch {
            /* no se pudo descartar: se deja el registro y se sigue */
          }
        }
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
