// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReminderActions from "./ReminderActions";
import {
  DEFAULT_SERVICE_SETTINGS,
  ReminderStatus,
  type ServiceReminderView,
} from "../../Types/apiTypes";
import { evaluateReminder } from "../../Utils/serviceReminders";

/**
 * Qué acciones ofrece la barra según el estado del recordatorio.
 *
 * Las reglas viven en `getReminderActions` y ya tienen tests propios; lo que se
 * verifica acá es que el componente **las respete**, que es donde se rompió
 * antes: la interfaz ofrecía posponer un service que estaba al día, y posponer
 * no cambia el vencimiento —sólo lo escondía—.
 */

const baseReminder = (
  overrides: Partial<ServiceReminderView> = {}
): ServiceReminderView => ({
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
});

const diasDesdeHoy = (dias: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString();
};

const renderActions = (reminder: ServiceReminderView, onRun = vi.fn()) => {
  const evaluation = evaluateReminder({
    status: reminder.status,
    dueDate: reminder.dueDate,
    dueKm: reminder.dueKm,
    snoozedUntil: reminder.snoozedUntil,
    currentKm: reminder.car.kilometers,
    kmPerDay: reminder.kmPerDay,
    settings: DEFAULT_SERVICE_SETTINGS,
  });
  render(
    <ReminderActions
      reminder={reminder}
      evaluation={evaluation}
      isBusy={false}
      onRun={onRun}
    />
  );
  return { onRun };
};

/** Los botones se identifican por su texto visible, como los ve el usuario. */
const boton = (nombre: RegExp) =>
  screen.queryByRole("button", { name: nombre });

describe("ReminderActions", () => {
  it("un service vencido se puede posponer, completar y descartar", () => {
    renderActions(baseReminder({ dueDate: diasDesdeHoy(-30) }));

    expect(boton(/posponer/i)).toBeInTheDocument();
    expect(boton(/hecho|complet/i)).toBeInTheDocument();
    expect(boton(/descartar/i)).toBeInTheDocument();
  });

  it("un service al día NO se puede posponer", () => {
    renderActions(baseReminder({ dueDate: diasDesdeHoy(180) }));

    // Posponer no mueve el vencimiento: sobre algo que todavía no vence, lo
    // único que hace es esconderlo. El botón puede estar, pero deshabilitado.
    const posponer = boton(/posponer/i);
    if (posponer) expect(posponer).toBeDisabled();
  });

  it("un service postergado se reactiva en vez de volver a posponerse", () => {
    renderActions(
      baseReminder({
        status: ReminderStatus.SNOOZED,
        dueDate: diasDesdeHoy(-10),
        snoozedUntil: diasDesdeHoy(5),
      })
    );

    expect(boton(/reactivar/i)).toBeInTheDocument();
    const posponer = boton(/posponer/i);
    if (posponer) expect(posponer).toBeDisabled();
  });

  it("un service ya hecho no admite ninguna acción", () => {
    renderActions(
      baseReminder({
        status: ReminderStatus.DONE,
        dueDate: diasDesdeHoy(-40),
      })
    );

    // El componente muestra los botones pero deshabilitados, no los esconde:
    // la barra mantiene la misma forma en todos los estados. Lo que importa es
    // que ninguno se pueda ejecutar.
    for (const accion of [/posponer/i, /hecho|complet/i, /descartar/i]) {
      const encontrado = boton(accion);
      if (encontrado) expect(encontrado).toBeDisabled();
    }
  });

  it("al confirmar una acción se la delega hacia arriba", async () => {
    const user = userEvent.setup();
    const { onRun } = renderActions(
      baseReminder({ dueDate: diasDesdeHoy(-30) })
    );

    const completar = boton(/hecho|complet/i);
    expect(completar).toBeInTheDocument();
    await user.click(completar!);

    expect(onRun).toHaveBeenCalledTimes(1);
  });
});
