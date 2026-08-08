import { describe, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  computeTotals,
  filterJobsForDocument,
  renderBudgetDocument,
} from "./budgetPdf";
import { DocumentType, JobStatus } from "../Types/apiTypes";
import type { Cars, Jobs } from "../Types/types";

// Genera PDFs de muestra para revisar el diseño a ojo. Sólo corre cuando se
// define PDF_PREVIEW_DIR (no se ejecuta en la suite normal).
const OUT = process.env.PDF_PREVIEW_DIR;

const car = {
  licensePlate: "AB123CD",
  brand: "Volkswagen",
  model: "Amarok Highline V6",
  year: 2021,
  kilometers: 128450,
  owner: {
    fullname: "Horacio Rodríguez de los Santos",
    phone: "3514567890",
    address: "Av. Colón 1234, Piso 5 Depto B",
    city: "Córdoba",
  },
} as unknown as Cars;

const jobs = [
  {
    id: "j1",
    description: "Cambio de aceite y filtros (sintético 5W30)",
    status: JobStatus.COMPLETED,
    price: 85000,
    isThirdParty: false,
    parts: [
      { name: "Aceite 5W30", price: 42000 },
      { name: "Filtro", price: 8500 },
    ],
  },
  {
    id: "j2",
    description: "Rectificación de tambores traseros",
    status: JobStatus.DELIVERED,
    price: 60000,
    isThirdParty: true,
    parts: [],
  },
  {
    id: "j3",
    description: "Diagnóstico de tren delantero y alineación",
    status: JobStatus.IN_PROGRESS,
    price: 35000,
    isThirdParty: false,
    parts: [{ name: "Rótula", price: 27000 }],
  },
  {
    id: "j4",
    description: "Revisión del sistema eléctrico",
    status: JobStatus.PENDING,
    price: 20000,
    isThirdParty: false,
    parts: [],
  },
] as unknown as Jobs[];

describe.skipIf(!OUT)("muestras de PDF", () => {
  it("genera presupuesto y factura de muestra", () => {
    const plateFontBase64 = fs
      .readFileSync("src/assets/fonts/FE-FONT.TTF")
      .toString("base64");
    fs.mkdirSync(OUT!, { recursive: true });

    const cases = [
      {
        name: "presupuesto",
        docType: DocumentType.BUDGET,
        title: "Presupuesto de Trabajo",
        onlyCompleted: false,
        docNumber: "PRE-000123",
        jobs,
      },
      {
        name: "factura",
        docType: DocumentType.INVOICE,
        title: "Factura de Trabajos",
        onlyCompleted: true,
        docNumber: "FAC-000045",
        jobs,
      },
      {
        name: "sin-trabajos",
        docType: DocumentType.BUDGET,
        title: "Presupuesto de Trabajo",
        onlyCompleted: false,
        docNumber: "PRE-000124",
        jobs: [] as Jobs[],
      },
    ];

    for (const c of cases) {
      const included = filterJobsForDocument(c.jobs, c.onlyCompleted);
      const doc = renderBudgetDocument({
        car,
        jobs: included,
        totals: computeTotals(included),
        docNumber: c.docNumber,
        docType: c.docType,
        title: c.title,
        onlyCompleted: c.onlyCompleted,
        plateFontBase64,
      });
      fs.writeFileSync(
        path.join(OUT!, `${c.name}.pdf`),
        Buffer.from(doc.output("arraybuffer"))
      );
    }
  });
});
