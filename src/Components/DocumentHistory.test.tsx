// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DocumentHistory from "./DocumentHistory";
import { DocumentType, type IssuedDocument } from "../Types/apiTypes";

/**
 * Historial de documentos emitidos.
 *
 * Lo que importa acá no es el dibujo sino el contrato con el proceso principal:
 * qué filtros se le mandan, que se vuelva a pedir cuando avisan que cambiaron
 * los datos, y que la suscripción se dé de baja al desmontar —eso último ya se
 * pagó una vez con los avisos duplicados del auto-updater—.
 */

const list = vi.fn();
const unsubscribe = vi.fn();
// El parámetro está tipado a propósito: sin él, `mock.calls[0][0]` es una
// tupla vacía y no se puede invocar el aviso desde el test.
const onDataChanged = vi.fn((callback: () => void) => {
  void callback;
  return unsubscribe;
});

const doc = (overrides: Partial<IssuedDocument> = {}): IssuedDocument => ({
  id: "d1",
  type: DocumentType.BUDGET,
  number: 1,
  formatted: "PRE-000001",
  licensePlate: "AB123CD",
  clientName: "Ana Gómez",
  total: 125000,
  createdAt: new Date(2026, 8, 6, 10, 30).toISOString(),
  hasSnapshot: true,
  ...overrides,
});

/** El envelope de una lectura exitosa, que es lo que devuelve el canal. */
const ok = <T,>(result: T) => ({ status: "success", message: "", result });

beforeEach(() => {
  list.mockReset();
  onDataChanged.mockClear();
  unsubscribe.mockClear();
  list.mockResolvedValue(ok([]));
  Object.defineProperty(window, "api", {
    configurable: true,
    writable: true,
    value: {
      documents: { list, get: vi.fn(), savePdf: vi.fn() },
      onDataChanged,
    },
  });
});

describe("DocumentHistory", () => {
  it("muestra el estado vacío cuando no hay nada emitido", async () => {
    render(<DocumentHistory emptyText="Nada emitido todavía." />);

    expect(
      await screen.findByText("Nada emitido todavía.")
    ).toBeInTheDocument();
  });

  it("pasa los filtros tal cual al proceso principal", async () => {
    render(
      <DocumentHistory filters={{ licensePlate: "AB123CD", limit: 10 }} />
    );

    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(list).toHaveBeenCalledWith({
      type: undefined,
      licensePlate: "AB123CD",
      limit: 10,
    });
  });

  it("muestra número, titular y total de cada documento", async () => {
    list.mockResolvedValue(
      ok([
        doc(),
        doc({
          id: "d2",
          type: DocumentType.INVOICE,
          formatted: "FAC-000007",
          clientName: "Carlos Bravo",
          total: 89000,
        }),
      ])
    );

    render(<DocumentHistory />);

    expect(await screen.findByText("PRE-000001")).toBeInTheDocument();
    expect(screen.getByText("FAC-000007")).toBeInTheDocument();
    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.getByText("Carlos Bravo")).toBeInTheDocument();
    // Presupuesto y factura se distinguen con su etiqueta.
    expect(screen.getByText("Presupuesto")).toBeInTheDocument();
    expect(screen.getByText("Factura")).toBeInTheDocument();
  });

  it("sólo muestra la patente cuando se le pide", async () => {
    list.mockResolvedValue(ok([doc()]));

    const { unmount } = render(<DocumentHistory />);
    expect(await screen.findByText("PRE-000001")).toBeInTheDocument();
    // Dentro de la ficha de un vehículo repetir su patente es ruido.
    expect(screen.queryByText("AB123CD")).not.toBeInTheDocument();
    unmount();

    render(<DocumentHistory showPlate />);
    expect(await screen.findByText("AB123CD")).toBeInTheDocument();
  });

  it("se vuelve a pedir cuando avisan que cambiaron los datos", async () => {
    list.mockResolvedValue(ok([doc()]));
    render(<DocumentHistory />);

    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    // Emitir un documento invalida la caché del dashboard, y ese aviso es el
    // que tiene que refrescar este listado.
    const avisar = onDataChanged.mock.calls[0][0];
    avisar();

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it("se da de baja del aviso al desmontarse", async () => {
    render(<DocumentHistory />).unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it("si el listado falla no rompe la pantalla", async () => {
    list.mockRejectedValue(new Error("IPC caído"));

    render(<DocumentHistory emptyText="Sin documentos." />);

    expect(await screen.findByText("Sin documentos.")).toBeInTheDocument();
  });
});
