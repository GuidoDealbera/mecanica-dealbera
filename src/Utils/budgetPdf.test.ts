import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  computeTotals,
  eligibleJobsForDocument,
  renderBudgetDocument,
} from "./budgetPdf";
import { DocumentType, JobStatus } from "../Types/apiTypes";
import type { Cars, Jobs } from "../Types/types";

const car = {
  id: "car-1",
  licensePlate: "AB123CD",
  brand: "Volkswagen",
  model: "Amarok Highline V6 con un nombre muy largo para probar el recorte",
  year: 2021,
  kilometers: 128450,
  owner: {
    id: "cli-1",
    fullname: "Horacio Rodríguez de los Santos",
    phone: "3514567890",
    address: "Av. Colón 1234, Piso 5 Depto B",
    city: "Córdoba",
    email: "horacio@example.com",
    isActive: true,
  },
} as unknown as Cars;

const makeJob = (over: Partial<Jobs>): Jobs =>
  ({
    id: "j",
    description: "Trabajo",
    status: JobStatus.PENDING,
    price: 0,
    isThirdParty: false,
    parts: [],
    ...over,
  }) as unknown as Jobs;

const jobs: Jobs[] = [
  makeJob({
    id: "j1",
    description: "Cambio de aceite y filtros",
    status: JobStatus.COMPLETED,
    price: 85000,
    parts: [
      { name: "Aceite 5W30", price: 42000 },
      { name: "Filtro", price: 8500 },
    ],
  }),
  makeJob({
    id: "j2",
    description: "Rectificación de tambores",
    status: JobStatus.DELIVERED,
    price: 60000,
    isThirdParty: true,
  }),
  makeJob({
    id: "j3",
    description: "Alineación",
    status: JobStatus.IN_PROGRESS,
    price: 35000,
    parts: [{ name: "Rótula", price: 27000 }],
  }),
  makeJob({ id: "j4", description: "Revisión eléctrica", price: 20000 }),
];

const render = (over: Partial<Parameters<typeof renderBudgetDocument>[0]>) => {
  const included = over.jobs ?? jobs;
  return renderBudgetDocument({
    car,
    jobs: included,
    totals: computeTotals(included),
    docNumber: "PRE-000123",
    docType: DocumentType.BUDGET,
    title: "Presupuesto de Trabajo",
    ...over,
  });
};

const sizeOf = (doc: ReturnType<typeof renderBudgetDocument>) =>
  Buffer.from(doc.output("arraybuffer")).length;

describe("computeTotals", () => {
  it("suma mano de obra y repuestos, y separa los de terceros", () => {
    const t = computeTotals(jobs);
    expect(t.laborTotal).toBe(200000);
    expect(t.partsGrandTotal).toBe(77500);
    expect(t.total).toBe(277500);
    expect(t.thirdPartyTotal).toBe(60000);
    expect(t.ownTotal).toBe(140000);
  });

  it("devuelve todo en cero sin trabajos", () => {
    expect(computeTotals([])).toEqual({
      laborTotal: 0,
      partsGrandTotal: 0,
      thirdPartyTotal: 0,
      ownTotal: 0,
      total: 0,
    });
  });
});

describe("eligibleJobsForDocument", () => {
  it("la factura sólo admite trabajos completados", () => {
    const filtered = eligibleJobsForDocument(jobs, DocumentType.INVOICE);
    expect(filtered.map((j) => j.id)).toEqual(["j1"]);
  });

  it("el presupuesto admite todo menos los entregados", () => {
    const filtered = eligibleJobsForDocument(jobs, DocumentType.BUDGET);
    expect(filtered.map((j) => j.id)).toEqual(["j1", "j3", "j4"]);
  });

  it("nunca incluye trabajos entregados (ya cobrados)", () => {
    for (const type of [DocumentType.BUDGET, DocumentType.INVOICE]) {
      expect(
        eligibleJobsForDocument(jobs, type).some(
          (j) => j.status === JobStatus.DELIVERED
        )
      ).toBe(false);
    }
  });

  it("no rompe con una lista vacía", () => {
    expect(eligibleJobsForDocument([], DocumentType.INVOICE)).toEqual([]);
  });
});

describe("renderBudgetDocument", () => {
  it("genera un PDF de una página con los trabajos", () => {
    const doc = render({});
    expect(doc.getNumberOfPages()).toBe(1);
    expect(sizeOf(doc)).toBeGreaterThan(1000);
  });

  it("genera el PDF aunque no haya trabajos", () => {
    const doc = render({ jobs: [] });
    expect(doc.getNumberOfPages()).toBe(1);
    expect(sizeOf(doc)).toBeGreaterThan(1000);
  });

  it("pagina cuando hay muchos trabajos", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      makeJob({ id: `bulk-${i}`, description: `Trabajo ${i + 1}`, price: 1000 })
    );
    expect(render({ jobs: many }).getNumberOfPages()).toBeGreaterThan(1);
  });

  it("registra la fuente de patentes cuando se le pasa", () => {
    const plateFontBase64 = fs
      .readFileSync("src/assets/fonts/FE-FONT.TTF")
      .toString("base64");
    const withFont = render({ plateFontBase64 });
    // La fuente embebida hace crecer el documento respecto al fallback.
    expect(sizeOf(withFont)).toBeGreaterThan(sizeOf(render({})));
    expect(
      withFont.getFontList()["FEFONT"] ?? withFont.getFontList()["FE-FONT"]
    ).toBeDefined();
  });

  it("no falla si la fuente de patentes es inválida (cae al fallback)", () => {
    expect(() =>
      render({ plateFontBase64: "no-es-base64-de-una-fuente" })
    ).not.toThrow();
  });

  it("emite factura sin la nota de validez y presupuesto con ella", () => {
    const included = eligibleJobsForDocument(jobs, DocumentType.INVOICE);
    const invoice = render({
      docType: DocumentType.INVOICE,
      title: "Factura de Trabajos",
      jobs: included,
    });
    expect(invoice.getNumberOfPages()).toBe(1);
    // El presupuesto imprime una línea extra (validez), así que pesa más.
    const budget = render({ jobs: included });
    expect(sizeOf(budget)).toBeGreaterThan(sizeOf(invoice));
  });
});
