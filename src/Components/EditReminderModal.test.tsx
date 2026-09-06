// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EditReminderModal from "./EditReminderModal";
import {
  ReminderStatus,
  type SaveReminderBody,
  type ServiceReminderView,
} from "../Types/apiTypes";

/**
 * Reglas del modal que ajusta el próximo service.
 *
 * Lo que se verifica acá es lo que ningún test de backend puede ver: que la
 * fecha llegue al endpoint apuntando al día correcto, que no se pueda guardar
 * un recordatorio sin ningún criterio, y que los campos no arrastren los datos
 * del recordatorio anterior.
 *
 * Se afirma `toBeInTheDocument` y no `toBeVisible`: el modal de HeroUI se pinta
 * en un portal con estilos de superposición que jsdom no resuelve, así que la
 * visibilidad daría falsos negativos. Lo que importa es que el aviso se
 * renderice.
 */

const save = vi.fn();

const reminder = (overrides: Partial<ServiceReminderView> = {}) =>
  ({
    id: "r1",
    status: ReminderStatus.PENDING,
    dueDate: null,
    dueKm: null,
    snoozedUntil: null,
    contactedAt: null,
    notes: "",
    car: {
      licensePlate: "AB123CD",
      brand: "Volkswagen",
      model: "Gol",
      year: 2016,
      kilometers: 90000,
    },
    owner: { fullname: "Ana Gómez", phone: "3510000001" },
    kmPerDay: 0,
    ...overrides,
  }) as ServiceReminderView;

const renderModal = (
  props: Partial<React.ComponentProps<typeof EditReminderModal>> = {}
) => {
  const onSaved = vi.fn();
  const onResult = vi.fn();
  const onClose = vi.fn();
  render(
    <EditReminderModal
      isOpen
      onClose={onClose}
      licensePlate="AB123CD"
      reminder={reminder()}
      currentKm={90000}
      onSaved={onSaved}
      onResult={onResult}
      {...props}
    />
  );
  return { onSaved, onResult, onClose };
};

/** Lo que el modal terminó mandando al endpoint. */
const cuerpoGuardado = (): SaveReminderBody =>
  save.mock.calls[0][0] as SaveReminderBody;

beforeEach(() => {
  save.mockReset();
  save.mockResolvedValue({ status: "success", message: "ok" });
  vi.stubGlobal("api", undefined);
  Object.defineProperty(window, "api", {
    configurable: true,
    writable: true,
    value: { service: { save } },
  });
});

describe("EditReminderModal", () => {
  it("no deja guardar sin fecha ni kilometraje", async () => {
    renderModal({ reminder: reminder({ dueDate: null, dueKm: null }) });

    expect(
      screen.getByText(/al menos una fecha o un kilometraje/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guardar/i })).toBeDisabled();
  });

  it("manda la fecha apuntando al día elegido, no al anterior", async () => {
    const user = userEvent.setup();
    renderModal({ reminder: reminder({ dueDate: null, dueKm: null }) });

    const fecha = screen.getByLabelText(/vence el/i);
    await user.clear(fecha);
    await user.type(fecha, "2027-03-15");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    // Se manda como mediodía local: con medianoche, pasar a ISO en un huso
    // negativo como el nuestro corre la fecha al día anterior. Se comprueba
    // sobre el instante reconstruido, no sobre el texto.
    const enviado = new Date(cuerpoGuardado().dueDate as string);
    expect(enviado.getFullYear()).toBe(2027);
    expect(enviado.getMonth()).toBe(2); // marzo
    expect(enviado.getDate()).toBe(15);
  });

  it("permite un recordatorio sólo por kilometraje", async () => {
    const user = userEvent.setup();
    renderModal({ reminder: reminder({ dueDate: null, dueKm: null }) });

    await user.type(screen.getByLabelText(/vence a los/i), "120000");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    const body = cuerpoGuardado();
    expect(body.dueKm).toBe(120000);
    expect(body.dueDate).toBeNull();
  });

  it("avisa si el kilometraje objetivo ya quedó atrás", async () => {
    const user = userEvent.setup();
    renderModal({ reminder: reminder({ dueKm: null }), currentKm: 90000 });

    await user.type(screen.getByLabelText(/vence a los/i), "80000");

    expect(screen.getByText(/ya pasó ese kilometraje/i)).toBeInTheDocument();
  });

  it("rechaza un kilometraje negativo", async () => {
    const user = userEvent.setup();
    renderModal({ reminder: reminder({ dueKm: null }) });

    await user.type(screen.getByLabelText(/vence a los/i), "-5");

    expect(screen.getByRole("button", { name: /guardar/i })).toBeDisabled();
  });

  it("conserva el id al editar, para no crear uno nuevo", async () => {
    const user = userEvent.setup();
    renderModal({ reminder: reminder({ id: "r-existente", dueKm: 120000 }) });

    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(cuerpoGuardado().id).toBe("r-existente");
  });

  it("sin recordatorio previo no manda id, que es como se crea uno", async () => {
    const user = userEvent.setup();
    renderModal({ reminder: null });

    await user.type(screen.getByLabelText(/vence a los/i), "100000");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(cuerpoGuardado().id).toBeUndefined();
    expect(cuerpoGuardado().licensePlate).toBe("AB123CD");
  });

  it("cierra y avisa hacia arriba sólo si el backend aceptó", async () => {
    const user = userEvent.setup();
    save.mockResolvedValue({ status: "failed", message: "no se pudo" });
    const { onSaved, onClose, onResult } = renderModal({
      reminder: reminder({ dueKm: 120000 }),
    });

    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" })
    );
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
