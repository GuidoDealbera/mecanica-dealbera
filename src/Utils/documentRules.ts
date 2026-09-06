import { Jobs } from "../Types/types";
import { DocumentType, JobStatus } from "../Types/apiTypes";

/**
 * Reglas del documento (presupuesto/factura) que **no** dibujan nada.
 *
 * Viven aparte de `budgetPdf.ts` a propósito: ese módulo importa jsPDF,
 * jspdf-autotable y la fuente de patentes embebida, unos 500 kB que sólo hacen
 * falta al emitir un documento. Cualquier pantalla que necesitara saber qué
 * trabajos son elegibles o cuánto suman se llevaba todo ese peso puesto.
 */

/** Días de validez que se imprimen en los presupuestos. */
export const BUDGET_VALIDITY_DAYS = 15;

export interface BudgetTotals {
  laborTotal: number;
  partsGrandTotal: number;
  thirdPartyTotal: number;
  ownTotal: number;
  total: number;
}

/** Calcula los totales del documento a partir de los trabajos incluidos. */
export const computeTotals = (jobs: Jobs[]): BudgetTotals => {
  const laborTotal = jobs.reduce((acc, j) => acc + (j.price ?? 0), 0);
  const partsGrandTotal = jobs.reduce(
    (acc, j) => acc + (j.parts ?? []).reduce((s, p) => s + p.price, 0),
    0
  );
  const thirdPartyTotal = jobs
    .filter((j) => j.isThirdParty)
    .reduce((acc, j) => acc + (j.price ?? 0), 0);
  return {
    laborTotal,
    partsGrandTotal,
    thirdPartyTotal,
    ownTotal: laborTotal - thirdPartyTotal,
    total: laborTotal + partsGrandTotal,
  };
};

/**
 * Trabajos que pueden entrar en un documento según su tipo.
 *
 * Los **entregados quedan siempre afuera**: un trabajo entregado ya se cobró, así
 * que volver a presupuestarlo o facturarlo sería cobrarlo dos veces. Su lugar es
 * el historial del vehículo.
 *
 * - **Presupuesto**: sin comenzar, en progreso y completados (lo que todavía se
 *   va a cobrar).
 * - **Factura**: sólo completados (es lo que ya se hizo y se puede cobrar).
 */
export const eligibleJobsForDocument = (
  jobs: Jobs[],
  type: DocumentType
): Jobs[] =>
  type === DocumentType.INVOICE
    ? jobs.filter((j) => j.status === JobStatus.COMPLETED)
    : jobs.filter((j) => j.status !== JobStatus.DELIVERED);
