import { describe, expect, it } from "vitest";
import {
  addMonths,
  computeNextService,
  daysBetween,
  estimateKmPerDay,
  evaluateReminder,
  formatDueSummary,
  projectKmDueDate,
} from "./serviceReminders";
import {
  DEFAULT_SERVICE_SETTINGS,
  ReminderStatus,
  ServiceSettings,
} from "../Types/apiTypes";

const TODAY = new Date("2026-06-15T12:00:00.000Z");

const evaluate = (over: Partial<Parameters<typeof evaluateReminder>[0]>) =>
  evaluateReminder({
    status: ReminderStatus.PENDING,
    dueDate: null,
    dueKm: null,
    snoozedUntil: null,
    currentKm: 100000,
    today: TODAY,
    ...over,
  });

describe("addMonths", () => {
  it("suma meses normalmente", () => {
    expect(addMonths(new Date("2026-01-15T00:00:00Z"), 6).getMonth()).toBe(6);
  });

  it("no desborda cuando el mes destino es más corto", () => {
    // 31 de enero + 1 mes debe caer en febrero, no en marzo.
    const result = addMonths(new Date(2026, 0, 31), 1);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(28);
  });
});

describe("daysBetween", () => {
  it("cuenta días completos y respeta el signo", () => {
    expect(daysBetween(TODAY, new Date("2026-06-25T12:00:00.000Z"))).toBe(10);
    expect(daysBetween(TODAY, new Date("2026-06-05T12:00:00.000Z"))).toBe(-10);
  });
});

describe("computeNextService", () => {
  it("usa los intervalos globales por defecto", () => {
    const next = computeNextService({
      fromDate: new Date("2026-01-10T00:00:00Z"),
      fromKm: 90000,
    });
    expect(next.dueDate.getMonth()).toBe(6); // enero + 6 meses = julio
    expect(next.dueKm).toBe(100000); // 90.000 + 10.000
  });

  it("prioriza los intervalos del vehículo", () => {
    const next = computeNextService({
      fromDate: new Date("2026-01-10T00:00:00Z"),
      fromKm: 90000,
      intervalMonths: 12,
      intervalKm: 20000,
    });
    expect(next.dueDate.getFullYear()).toBe(2027);
    expect(next.dueKm).toBe(110000);
  });

  it("ignora intervalos inválidos y cae al global", () => {
    const next = computeNextService({
      fromDate: new Date("2026-01-10T00:00:00Z"),
      fromKm: 0,
      intervalMonths: 0,
      intervalKm: -5,
    });
    expect(next.dueKm).toBe(DEFAULT_SERVICE_SETTINGS.intervalKm);
  });

  it("deja el vencimiento por km en null si no se conoce el kilometraje", () => {
    expect(
      computeNextService({ fromDate: TODAY, fromKm: null }).dueKm
    ).toBeNull();
  });
});

describe("estimateKmPerDay", () => {
  it("promedia el historial", () => {
    const kmPerDay = estimateKmPerDay([
      { km: 100000, date: "2026-01-01T00:00:00Z" },
      { km: 103000, date: "2026-01-31T00:00:00Z" },
    ]);
    expect(kmPerDay).toBeCloseTo(100, 5); // 3.000 km en 30 días
  });

  it("ordena el historial antes de calcular", () => {
    const kmPerDay = estimateKmPerDay([
      { km: 103000, date: "2026-01-31T00:00:00Z" },
      { km: 100000, date: "2026-01-01T00:00:00Z" },
    ]);
    expect(kmPerDay).toBeCloseTo(100, 5);
  });

  it("devuelve null sin datos suficientes o inconsistentes", () => {
    expect(estimateKmPerDay(undefined)).toBeNull();
    expect(estimateKmPerDay([])).toBeNull();
    expect(
      estimateKmPerDay([{ km: 100000, date: "2026-01-01T00:00:00Z" }])
    ).toBeNull();
    // Mismo día: no se puede dividir por cero días.
    expect(
      estimateKmPerDay([
        { km: 100000, date: "2026-01-01T00:00:00Z" },
        { km: 100500, date: "2026-01-01T00:00:00Z" },
      ])
    ).toBeNull();
    // Kilometraje que baja (dato erróneo): no se estima.
    expect(
      estimateKmPerDay([
        { km: 100000, date: "2026-01-01T00:00:00Z" },
        { km: 99000, date: "2026-02-01T00:00:00Z" },
      ])
    ).toBeNull();
  });

  it("ignora registros con fecha inválida", () => {
    expect(
      estimateKmPerDay([
        { km: 100000, date: "no-es-fecha" },
        { km: 103000, date: "2026-01-31T00:00:00Z" },
      ])
    ).toBeNull();
  });
});

describe("projectKmDueDate", () => {
  it("proyecta la fecha en la que alcanzaría el km objetivo", () => {
    const projected = projectKmDueDate(100000, 101000, 100, TODAY);
    expect(daysBetween(TODAY, projected!)).toBe(10);
  });

  it("devuelve null si ya alcanzó el km o falta información", () => {
    expect(projectKmDueDate(101000, 101000, 100, TODAY)).toBeNull();
    expect(projectKmDueDate(100000, null, 100, TODAY)).toBeNull();
    expect(projectKmDueDate(100000, 101000, null, TODAY)).toBeNull();
    expect(projectKmDueDate(100000, 101000, 0, TODAY)).toBeNull();
  });
});

describe("evaluateReminder", () => {
  it("marca vencido por fecha", () => {
    const result = evaluate({ dueDate: "2026-06-01T00:00:00Z" });
    expect(result.urgency).toBe("overdue");
    expect(result.isDue).toBe(true);
    expect(result.daysUntilDue).toBeLessThan(0);
  });

  it("marca vencido por kilometraje aunque la fecha no haya llegado", () => {
    const result = evaluate({
      dueDate: "2027-01-01T00:00:00Z",
      dueKm: 99000,
      currentKm: 100000,
    });
    expect(result.urgency).toBe("overdue");
    expect(result.kmRemaining).toBe(-1000);
  });

  it("marca 'vence pronto' dentro de la ventana de días", () => {
    expect(evaluate({ dueDate: "2026-07-01T00:00:00Z" }).urgency).toBe(
      "due-soon"
    );
  });

  it("marca 'vence pronto' dentro de la ventana de kilómetros", () => {
    const result = evaluate({
      dueDate: "2027-01-01T00:00:00Z",
      dueKm: 100500,
      currentKm: 100000,
    });
    expect(result.urgency).toBe("due-soon");
  });

  it("marca 'al día' cuando falta mucho por ambos criterios", () => {
    const result = evaluate({
      dueDate: "2027-01-01T00:00:00Z",
      dueKm: 110000,
      currentKm: 100000,
    });
    expect(result.urgency).toBe("upcoming");
    expect(result.isDue).toBe(false);
  });

  it("respeta un postergado vigente y lo reactiva al vencer el plazo", () => {
    const vigente = evaluate({
      status: ReminderStatus.SNOOZED,
      dueDate: "2026-01-01T00:00:00Z",
      snoozedUntil: "2026-07-01T00:00:00Z",
    });
    expect(vigente.urgency).toBe("snoozed");
    expect(vigente.isDue).toBe(false);

    const reactivado = evaluate({
      status: ReminderStatus.SNOOZED,
      dueDate: "2026-01-01T00:00:00Z",
      snoozedUntil: "2026-06-01T00:00:00Z",
    });
    expect(reactivado.urgency).toBe("overdue");
    expect(reactivado.isDue).toBe(true);
  });

  it("no evalúa los recordatorios cerrados", () => {
    for (const status of [ReminderStatus.DONE, ReminderStatus.DISMISSED]) {
      const result = evaluate({ status, dueDate: "2020-01-01T00:00:00Z" });
      expect(result.isDue).toBe(false);
    }
  });

  it("respeta umbrales configurados", () => {
    const settings: ServiceSettings = {
      ...DEFAULT_SERVICE_SETTINGS,
      soonDays: 5,
    };
    // A 16 días: con la ventana por defecto (30) vencería pronto; con 5, no.
    const dueDate = "2026-07-01T00:00:00Z";
    expect(evaluate({ dueDate }).urgency).toBe("due-soon");
    expect(evaluate({ dueDate, settings }).urgency).toBe("upcoming");
  });

  it("tolera un recordatorio sin vencimientos definidos", () => {
    const result = evaluate({});
    expect(result.urgency).toBe("upcoming");
    expect(result.daysUntilDue).toBeNull();
    expect(result.kmRemaining).toBeNull();
  });

  it("ignora fechas inválidas", () => {
    expect(evaluate({ dueDate: "no-es-fecha" }).daysUntilDue).toBeNull();
  });
});

describe("formatDueSummary", () => {
  it("describe un vencimiento pasado por fecha y km", () => {
    const text = formatDueSummary(
      evaluate({ dueDate: "2026-06-05T12:00:00Z", dueKm: 99000 })
    );
    expect(text).toContain("venció hace 10 días");
    expect(text).toContain("1.000 km pasados");
  });

  it("describe un vencimiento futuro", () => {
    const text = formatDueSummary(
      evaluate({ dueDate: "2026-06-25T12:00:00Z", dueKm: 101000 })
    );
    expect(text).toContain("en 10 días");
    expect(text).toContain("faltan 1.000 km");
  });

  it("expresa plazos largos en meses", () => {
    expect(
      formatDueSummary(evaluate({ dueDate: "2026-12-15T12:00:00Z" }))
    ).toContain("meses");
  });

  it("avisa cuando vence hoy", () => {
    expect(
      formatDueSummary(evaluate({ dueDate: TODAY.toISOString() }))
    ).toContain("vence hoy");
  });

  it("tiene un texto para el caso sin vencimiento", () => {
    expect(formatDueSummary(evaluate({}))).toBe("Sin vencimiento definido");
  });
});
