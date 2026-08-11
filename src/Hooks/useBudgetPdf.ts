import { useCallback, useState } from "react";
import { Cars, Jobs } from "../Types/types";
import { DocumentType, type IssuedDocument } from "../Types/apiTypes";
import {
  computeTotals,
  eligibleJobsForDocument,
  renderBudgetDocument,
} from "../Utils/budgetPdf";
import { getPlateFontBase64 } from "../Utils/plateFont";

/** Título impreso según el tipo de documento. */
export const DOCUMENT_TITLES: Record<DocumentType, string> = {
  [DocumentType.BUDGET]: "Presupuesto de Trabajo",
  [DocumentType.INVOICE]: "Factura de Trabajos",
};

export interface BudgetOptions {
  /** Tipo de documento a emitir (define la serie del correlativo). */
  type: DocumentType;
  /** Título impreso; por defecto, el que corresponde al tipo. */
  title?: string;
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
   * PDF. `jobs` son los trabajos ya elegidos por el usuario en el modal.
   * Devuelve el documento emitido para que el consumidor pueda mostrar el
   * número. Si algo falla, descarta el número y lanza el error.
   */
  const generatePDF = useCallback(
    async (
      car: Cars,
      jobs: Jobs[],
      options: BudgetOptions
    ): Promise<IssuedDocument> => {
      setIsGenerating(true);
      setError(null);

      let issuedId: string | null = null;
      try {
        const docType = options.type;
        const { title = DOCUMENT_TITLES[docType] } = options;

        // La elegibilidad se vuelve a aplicar acá (no sólo en la UI): ningún
        // documento debe poder incluir un trabajo ya entregado.
        const filteredJobs = eligibleJobsForDocument(jobs, docType);
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
