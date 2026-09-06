// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DocumentModal from "./DocumentModal";
import { DocumentType, JobStatus } from "../Types/apiTypes";
import type { Cars, Jobs } from "../Types/types";

/**
 * Qué trabajos deja incluir el modal de emisión.
 *
 * La regla que importa: **un trabajo entregado ya se cobró**, así que no puede
 * volver a entrar en un presupuesto ni en una factura. Está en
 * `eligibleJobsForDocument` y también se reaplica en el hook, pero acá se
 * verifica lo que ve el usuario, que es donde se rompió antes.
 */

const makeJob = (
  id: string,
  description: string,
  status: JobStatus,
  price: number
): Jobs => ({
  id,
  description,
  status,
  price,
  isThirdParty: false,
  parts: [],
});

const jobs = [
  makeJob("j1", "Cambio de aceite", JobStatus.COMPLETED, 85_000),
  makeJob("j2", "Alineación", JobStatus.IN_PROGRESS, 40_000),
  makeJob("j3", "Revisión general", JobStatus.PENDING, 20_000),
  makeJob("j4", "Cambio de correa", JobStatus.DELIVERED, 150_000),
];

const car = {
  licensePlate: "AB123CD",
  brand: "Volkswagen",
  model: "Gol",
  year: 2016,
  kilometers: 90000,
  owner: { fullname: "Ana Gómez", phone: "3510000001" },
  jobs,
} as unknown as Cars;

const renderModal = (onConfirm = vi.fn()) => {
  render(
    <DocumentModal
      isOpen
      onClose={vi.fn()}
      car={car}
      jobs={jobs}
      isGenerating={false}
      onConfirm={onConfirm}
    />
  );
  return { onConfirm };
};

describe("DocumentModal", () => {
  it("nunca ofrece un trabajo ya entregado", () => {
    renderModal();

    expect(screen.getByText(/cambio de aceite/i)).toBeInTheDocument();
    expect(screen.getByText(/alineación/i)).toBeInTheDocument();
    expect(screen.getByText(/revisión general/i)).toBeInTheDocument();

    // El entregado no está en la lista: ya se cobró, su lugar es el historial.
    expect(screen.queryByText(/cambio de correa/i)).not.toBeInTheDocument();
  });

  it("avisa cuántos entregados dejó afuera", () => {
    renderModal();
    // El aviso menciona que hay un trabajo excluido, para que no parezca que
    // falta algo por error.
    expect(screen.getByText(/entregad/i)).toBeInTheDocument();
  });

  it("en el presupuesto entran los tres estados abiertos", async () => {
    const { onConfirm } = renderModal();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /emitir|descargar/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const [tipo, seleccionados] = onConfirm.mock.calls[0] as [
      DocumentType,
      Jobs[],
    ];
    expect(tipo).toBe(DocumentType.BUDGET);
    expect(seleccionados.map((j) => j.id).sort()).toEqual(["j1", "j2", "j3"]);
  });

  it("la factura sólo admite completados", async () => {
    const { onConfirm } = renderModal();
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: /factura/i }));

    // Al cambiar de tipo, los que no son completados desaparecen de la lista.
    expect(screen.getByText(/cambio de aceite/i)).toBeInTheDocument();
    expect(screen.queryByText(/alineación/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/revisión general/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /emitir|descargar/i }));
    const [tipo, seleccionados] = onConfirm.mock.calls[0] as [
      DocumentType,
      Jobs[],
    ];
    expect(tipo).toBe(DocumentType.INVOICE);
    expect(seleccionados.map((j) => j.id)).toEqual(["j1"]);
  });

  it("muestra el total de lo seleccionado", () => {
    renderModal();
    // 85.000 + 40.000 + 20.000 = 145.000
    expect(screen.getByText(/145\.000/)).toBeInTheDocument();
  });
});
