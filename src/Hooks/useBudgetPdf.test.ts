// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBudgetPDF } from "./useBudgetPdf";
import { DocumentType, JobStatus } from "../Types/apiTypes";
import type { Cars, Jobs } from "../Types/types";

/**
 * Que el número de documento no se queme sin que salga ningún PDF.
 *
 * La secuencia es: pedir el número —que se **commitea** en la base— y recién
 * después dibujar y guardar. Hay un `document:discard` para devolverlo, pero
 * sólo servía si la excepción llegaba al `catch`, y `doc.save()` de jsPDF no
 * informaba nada: cancelar el guardado o no poder escribir el archivo dejaban
 * el número tomado y ningún documento. Un hueco en el correlativo, que es justo
 * lo que toda esta maquinaria existe para evitar.
 *
 * El orden no se invirtió —el número va impreso en el PDF y en el nombre del
 * archivo—, así que lo que se prueba es que **toda** salida que no termine en
 * un archivo escrito devuelva el número.
 */

// Con el tipo del argumento declarado: sin eso `mock.calls[0]` es una tupla
// vacía y no se puede mirar con qué se dibujó.
const dibujado = vi.fn((params: Record<string, unknown>) => ({
  output: () =>
    new TextEncoder().encode(`%PDF ${String(params.docNumber)}`).buffer,
}));
vi.mock("../Utils/budgetPdf", () => ({
  renderBudgetDocument: (params: Record<string, unknown>) => dibujado(params),
}));
vi.mock("../Utils/plateFont", () => ({ getPlateFontBase64: () => "" }));

const emitido = {
  id: "doc-1",
  type: DocumentType.INVOICE,
  number: 7,
  formatted: "F-0007",
  licensePlate: "AB123CD",
  clientName: "Ana Gómez",
  total: 50_000,
  createdAt: "2026-01-01T09:00:00.000Z",
};

const car = {
  licensePlate: "AB123CD",
  brand: "Volkswagen",
  model: "Gol",
  year: 2016,
  kilometers: 90_000,
  owner: { fullname: "Ana Gómez", phone: "3515123456" },
} as unknown as Cars;

const jobs = [
  {
    id: "j1",
    description: "Cambio de aceite",
    status: JobStatus.COMPLETED,
    price: 50_000,
    isThirdParty: false,
    parts: [],
  },
] as unknown as Jobs[];

const issue = vi.fn(async () => ({
  status: "success",
  message: "ok",
  result: emitido,
}));
const discard = vi.fn(async () => ({ status: "success", message: "ok" }));
// Con el tipo del argumento declarado: sin eso `mock.calls[0]` es una tupla
// vacía y no se puede mirar qué nombre de archivo se propuso.
const savePdf = vi.fn(
  async (payload: { defaultName: string; bytes: Uint8Array }) => ({
    status: "success",
    message: "Documento guardado",
    result: { filePath: `C:/documentos/${payload.defaultName}` },
  })
);
const logError = vi.fn();

const copia = {
  title: "Factura de Trabajos",
  car: {
    licensePlate: "AB123CD",
    brand: "Volkswagen",
    model: "Gol",
    year: 2016,
    kilometers: 90_000,
    owner: {
      fullname: "Ana Gómez",
      phone: "3515123456",
      address: "San Martín 100",
      city: "Córdoba",
    },
  },
  jobs: [
    {
      id: "j1",
      description: "Cambio de aceite",
      price: 50_000,
      isThirdParty: false,
      parts: [],
    },
  ],
  totals: {
    laborTotal: 50_000,
    partsGrandTotal: 0,
    thirdPartyTotal: 0,
    ownTotal: 50_000,
    total: 50_000,
  },
};

const get = vi.fn(async (id: string) => ({
  status: "success",
  message: "",
  result: { ...emitido, id, snapshot: copia },
}));

beforeEach(() => {
  issue.mockClear();
  discard.mockClear();
  savePdf.mockClear();
  logError.mockClear();
  savePdf.mockResolvedValue({
    status: "success",
    message: "Documento guardado",
    result: { filePath: "C:/x/F-0007.pdf" },
  });
  dibujado.mockClear();
  get.mockClear();
  get.mockResolvedValue({
    status: "success",
    message: "",
    result: { ...emitido, snapshot: copia },
  });
  (window as unknown as { api: unknown }).api = {
    documents: { issue, discard, savePdf, get },
    global: { logError },
  };
});

afterEach(() => {
  (window as unknown as { api: unknown }).api = {
    documents: { issue, discard, savePdf, get },
    global: { logError },
  };
});

const emitir = async () => {
  const { result } = renderHook(() => useBudgetPDF());
  return await result.current.generatePDF(car, jobs, {
    type: DocumentType.INVOICE,
  });
};

describe("emitir un documento", () => {
  it("guarda el PDF con el número en el nombre del archivo", async () => {
    const issued = await emitir();

    expect(issued?.formatted).toBe("F-0007");
    // El nombre arranca con el correlativo para que los documentos queden
    // ordenados en el explorador.
    expect(savePdf.mock.calls[0][0].defaultName).toMatch(/^F-0007_/);
    expect(savePdf.mock.calls[0][0].defaultName).toMatch(/\.pdf$/);
    // Y el número queda: no hay nada que devolver.
    expect(discard).not.toHaveBeenCalled();
  });

  it("cancelar el guardado devuelve el número", async () => {
    savePdf.mockResolvedValue({
      status: "cancelled",
      message: "Emisión cancelada",
    } as never);

    const issued = await emitir();

    // Cancelar no es un error: no se lanza nada, y la pantalla no muestra un
    // cartel rojo por algo que el usuario hizo a propósito.
    expect(issued).toBeNull();
    // Pero el número ya estaba tomado, así que hay que devolverlo o queda un
    // hueco en el correlativo.
    expect(discard).toHaveBeenCalledWith("doc-1");
  });

  it("si no se pudo escribir el archivo, devuelve el número y avisa", async () => {
    savePdf.mockResolvedValue({
      status: "failed",
      message: "No se pudo guardar el documento en D:/pendrive",
    } as never);

    await expect(emitir()).rejects.toThrow(/no se pudo guardar/i);
    expect(discard).toHaveBeenCalledWith("doc-1");
  });

  it("si el descarte falla, queda registrado en vez de perderse", async () => {
    // Era un `catch {}` vacío: cuando el descarte fallaba quedaba un hueco en
    // el correlativo y ningún rastro de por qué.
    savePdf.mockResolvedValue({
      status: "cancelled",
      message: "Emisión cancelada",
    } as never);
    discard.mockResolvedValue({
      status: "failed",
      message: "ya se emitieron documentos posteriores",
    });

    await emitir();

    expect(logError).toHaveBeenCalled();
    expect(logError.mock.calls[0][0]).toMatchObject({
      scope: "document:discard",
    });
  });

  it("no toma ningún número si la emisión misma falla", async () => {
    issue.mockResolvedValueOnce({
      status: "failed",
      message: "No se pudo emitir el documento",
    } as never);

    await expect(emitir()).rejects.toThrow(/no se pudo emitir/i);
    // No hay nada que descartar: nunca se llegó a tomar un número.
    expect(discard).not.toHaveBeenCalled();
    expect(savePdf).not.toHaveBeenCalled();
  });
});

describe("reimprimir un documento ya emitido", () => {
  const reimprimir = async (id = "doc-1") => {
    const { result } = renderHook(() => useBudgetPDF());
    return await result.current.reimprimir(id);
  };

  it("vuelve a dibujar la copia guardada sin emitir nada", async () => {
    const hecho = await reimprimir();

    expect(hecho?.formatted).toBe("F-0007");
    // Lo que no tiene que pasar: tomar un número nuevo. El documento ya existe;
    // reimprimirlo es sacar otra copia del mismo papel, no emitir otro.
    expect(issue).not.toHaveBeenCalled();
    expect(discard).not.toHaveBeenCalled();
    // Y se dibuja con lo guardado, no con los trabajos de hoy: si el trabajo se
    // editó o se borró desde entonces, el comprobante tiene que seguir diciendo
    // lo que decía.
    expect(dibujado.mock.calls[0][0]).toMatchObject({
      docNumber: "F-0007",
      title: "Factura de Trabajos",
      jobs: [{ description: "Cambio de aceite" }],
    });
    expect(savePdf.mock.calls[0][0].defaultName).toMatch(/^F-0007_/);
  });

  it("un documento viejo sin copia no se reimprime, y lo dice", async () => {
    // Los emitidos antes de que se guardara la copia. No se reconstruye desde
    // los trabajos actuales: daría un papel distinto del que firmó el cliente.
    get.mockResolvedValue({
      status: "success",
      message: "",
      result: { ...emitido, snapshot: null },
    } as never);

    await expect(reimprimir()).rejects.toThrow(/no se puede reimprimir/i);
    expect(savePdf).not.toHaveBeenCalled();
  });

  it("cancelar el guardado no es un error", async () => {
    savePdf.mockResolvedValue({
      status: "cancelled",
      message: "Emisión cancelada",
    } as never);

    expect(await reimprimir()).toBeNull();
    // Y sobre todo: no descarta el documento, que sigue existiendo.
    expect(discard).not.toHaveBeenCalled();
  });
});
