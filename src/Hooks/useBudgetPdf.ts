import { useCallback, useState } from "react";
import { Cars, Jobs } from "../Types/types";
import { DocumentType, type IssuedDocument } from "../Types/apiTypes";
import { computeTotals, eligibleJobsForDocument } from "../Utils/documentRules";
import type { VehicleSummary } from "../Utils/budgetPdf";

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
 *
 * El dibujo se carga con `import()` **en el momento de emitir**: jsPDF,
 * jspdf-autotable y la fuente de patentes embebida pesan ~500 kB, y con el
 * import estático entraban en el bundle de la ficha del vehículo, que es la
 * pantalla más usada. Ahora ese peso lo paga sólo quien emite un documento.
 */
export const useBudgetPDF = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Emite el documento: asigna su número correlativo en la DB, dibuja el PDF y
   * lo descarga. Si algo falla después de tomar el número, lo descarta para no
   * dejar un hueco en el correlativo.
   *
   * Emisión propiamente dicha. La comparten el documento de un vehículo y el
   * consolidado de un cliente: cambia **qué** se imprime, no cómo se numera,
   * se descarga ni se recupera de un error.
   */
  const emit = useCallback(
    async ({
      car,
      jobs,
      options,
      vehicles,
      jobPlates,
      plateForRecord,
      fileSuffix,
    }: {
      /** Vehículo de referencia; en el consolidado, de acá sale el titular. */
      car: Cars;
      jobs: Jobs[];
      options: BudgetOptions;
      vehicles?: VehicleSummary[];
      jobPlates?: Record<string, string>;
      /** Qué se guarda como patente en el registro del documento. */
      plateForRecord: string;
      /** Cola del nombre del archivo. */
      fileSuffix: string;
    }): Promise<IssuedDocument> => {
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
          licensePlate: plateForRecord,
          clientName: car.owner?.fullname ?? "",
          total: totals.total,
        });
        if (issued.status !== "success") {
          throw new Error(issued.message);
        }
        issuedId = issued.result.id;
        const docNumber = issued.result.formatted;

        const [{ renderBudgetDocument }, { getPlateFontBase64 }] =
          await Promise.all([
            import("../Utils/budgetPdf"),
            import("../Utils/plateFont"),
          ]);

        const doc = renderBudgetDocument({
          car,
          jobs: filteredJobs,
          totals,
          docNumber,
          docType,
          title,
          plateFontBase64: getPlateFontBase64(),
          vehicles,
          jobPlates,
        });

        // El nombre del archivo arranca con el número correlativo para que los
        // documentos queden ordenados en el explorador.
        const safeName = title
          .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, "_")
          .replace(/\s+/g, "_");
        doc.save(`${docNumber}_${safeName}_${fileSuffix}.pdf`);

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
        throw new Error(msg, { cause: err });
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  /**
   * Documento de un vehículo: el caso de siempre.
   */
  const generatePDF = useCallback(
    (car: Cars, jobs: Jobs[], options: BudgetOptions) =>
      emit({
        car,
        jobs,
        options,
        plateForRecord: car.licensePlate,
        fileSuffix: car.licensePlate,
      }),
    [emit]
  );

  /**
   * Documento **consolidado** de un cliente con varios vehículos.
   *
   * `cars` son los vehículos involucrados (los que aportan algún trabajo
   * elegido) y `jobs` los trabajos ya seleccionados, de todos ellos mezclados.
   *
   * En el registro del documento la patente pasa a ser la lista de patentes:
   * la columna es de texto y así el historial sigue diciendo a qué autos
   * corresponde, sin inventar una tabla de relación para un caso de borde.
   */
  const generateClientPDF = useCallback(
    (cars: Cars[], jobs: Jobs[], options: BudgetOptions) => {
      if (cars.length === 0) {
        throw new Error("No hay vehículos para emitir el documento");
      }

      const jobPlates: Record<string, string> = {};
      for (const car of cars) {
        for (const job of car.jobs ?? []) {
          jobPlates[job.id] = car.licensePlate;
        }
      }

      const plates = cars.map((car) => car.licensePlate);

      return emit({
        car: cars[0],
        jobs,
        options,
        vehicles: cars.map((car) => ({
          licensePlate: car.licensePlate,
          brand: car.brand,
          model: car.model,
          year: car.year,
          kilometers: car.kilometers,
        })),
        jobPlates,
        plateForRecord: plates.join(", "),
        // El nombre del archivo lleva el titular, no una ristra de patentes.
        fileSuffix: (cars[0].owner?.fullname ?? "cliente")
          .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, "_")
          .replace(/\s+/g, "_"),
      });
    },
    [emit]
  );

  return { generatePDF, generateClientPDF, isGenerating, error };
};
