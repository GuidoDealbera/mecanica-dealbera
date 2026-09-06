import { describe, expect, it } from "vitest";
import { computeTotals, renderBudgetDocument } from "./budgetPdf";
import { DocumentType, JobStatus } from "../Types/apiTypes";
import type { Cars, Jobs } from "../Types/types";

/**
 * Documento consolidado de un cliente con varios vehículos.
 *
 * No se puede verificar cómo *se ve* un PDF desde un test, pero sí su
 * estructura: `jspdf-autotable` deja la tabla que dibujó en `lastAutoTable`, y
 * ahí se puede comprobar que aparece la columna de patente, que cada fila lleva
 * la que le corresponde y que el modo de un solo vehículo no cambió.
 */

const owner = {
  fullname: "Ana Gómez",
  phone: "3510000001",
  address: "San Martín 100",
  city: "Córdoba",
};

const makeJob = (id: string, description: string, price: number): Jobs => ({
  id,
  description,
  status: JobStatus.COMPLETED,
  price,
  isThirdParty: false,
  parts: [],
});

const amarokJobs = [
  makeJob("j1", "Cambio de aceite y filtros", 85000),
  makeJob("j2", "Alineación y balanceo", 40000),
];

const golJobs = [makeJob("j3", "Cambio de correa de distribución", 150000)];

const amarok = {
  licensePlate: "AB123CD",
  brand: "Volkswagen",
  model: "Amarok",
  year: 2021,
  kilometers: 128450,
  owner,
  jobs: amarokJobs,
} as unknown as Cars;

const gol = {
  licensePlate: "XY789ZW",
  brand: "Volkswagen",
  model: "Gol Trend",
  year: 2016,
  kilometers: 90000,
  owner,
  jobs: golJobs,
} as unknown as Cars;

/** La tabla que `jspdf-autotable` dejó dibujada en el documento. */
const lastTable = (doc: unknown) =>
  (
    doc as {
      lastAutoTable?: {
        columns?: { index: number }[];
        body?: { cells: Record<number, { text: string[] }> }[];
      };
    }
  ).lastAutoTable;

const vehicles = [amarok, gol].map((car) => ({
  licensePlate: car.licensePlate,
  brand: car.brand,
  model: car.model,
  year: car.year,
  kilometers: car.kilometers,
}));

const jobPlates = {
  j1: amarok.licensePlate,
  j2: amarok.licensePlate,
  j3: gol.licensePlate,
};

describe("documento consolidado", () => {
  const jobs = [...amarokJobs, ...golJobs];

  it("agrega la columna de patente y la completa por trabajo", () => {
    const doc = renderBudgetDocument({
      car: amarok,
      jobs,
      totals: computeTotals(jobs),
      docNumber: "PRE-000001",
      docType: DocumentType.BUDGET,
      title: "Presupuesto de Trabajo",
      vehicles,
      jobPlates,
    });

    const table = lastTable(doc);
    expect(table?.columns).toHaveLength(6);

    const plates = table?.body?.map((row) => row.cells[0].text.join(""));
    expect(plates).toEqual(["AB123CD", "AB123CD", "XY789ZW"]);
  });

  it("con un solo vehículo mantiene el formato de siempre", () => {
    const doc = renderBudgetDocument({
      car: amarok,
      jobs: amarokJobs,
      totals: computeTotals(amarokJobs),
      docNumber: "PRE-000002",
      docType: DocumentType.BUDGET,
      title: "Presupuesto de Trabajo",
      vehicles: [vehicles[0]],
      jobPlates,
    });

    // Cinco columnas: sin la de patente. Un cliente con un solo auto no
    // necesita que le repitan la patente en cada fila.
    expect(lastTable(doc)?.columns).toHaveLength(5);
  });

  it("sin `vehicles` se comporta como el documento de un vehículo", () => {
    const doc = renderBudgetDocument({
      car: amarok,
      jobs: amarokJobs,
      totals: computeTotals(amarokJobs),
      docNumber: "PRE-000003",
      docType: DocumentType.BUDGET,
      title: "Presupuesto de Trabajo",
    });

    expect(lastTable(doc)?.columns).toHaveLength(5);
  });

  it("el total suma los trabajos de todos los vehículos", () => {
    expect(computeTotals(jobs).total).toBe(85000 + 40000 + 150000);
  });
});
