import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";
import { ReminderStatus } from "../../../src/Types/apiTypes";

/**
 * `service:save`: crear o corregir a mano el próximo service de un vehículo.
 *
 * Es el endpoint que sostiene la invariante del sistema —**un solo recordatorio
 * vigente por vehículo**— y el que la rompía: con un `id` tomaba ese
 * recordatorio sin mirar de qué auto era ni si había otro activo.
 *
 * Que la invariante ya se rompió una vez está en el historial: la migración
 * `SimplifyServiceType` tuvo que recorrer la base real colapsando los múltiples
 * recordatorios activos por vehículo que había.
 */

const stub = vi.hoisted(() => ({
  dir: "",
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));

vi.mock("electron", () => ({
  app: { getPath: () => stub.dir, getVersion: () => "2.0.0" },
  ipcMain: {
    handle: (canal: string, handler: (...args: unknown[]) => unknown) => {
      stub.handlers.set(canal, handler);
    },
  },
  dialog: {
    showErrorBox: vi.fn(),
    showMessageBox: vi.fn(async () => ({ response: 1 })),
  },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
}));

let dir: string;
let ds: DataSource;

const invocar = async <T>(canal: string, ...args: unknown[]): Promise<T> => {
  const handler = stub.handlers.get(canal);
  if (!handler) throw new Error(`No se registró el canal ${canal}`);
  return (await handler({}, ...args)) as T;
};

type Respuesta = { status: string; message: string; result?: unknown };

/** Arranca una base al día y deja los endpoints de service registrados. */
const preparar = async () => {
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.handlers.clear();
  vi.resetModules();

  const dataSource = await import("../dataSource");
  const cache = await import("../dashboardCache");
  await dataSource.AppDataSource.initialize();
  await dataSource.applyPendingMigrations();
  await import("./service.endpoints");

  ds = dataSource.AppDataSource;
  return { ...dataSource, ...cache };
};

/** Un vehículo con titular, insertado directo para no depender de otro endpoint. */
const crearAuto = async (patente: string, sufijo: string) => {
  await ds.query(
    `INSERT INTO client (id, fullname, phone, address, city, isActive, createdAt)
     VALUES (?, ?, ?, 'Calle 1', 'Córdoba', 1, '2026-01-01 09:00:00')`,
    [`cli-${sufijo}`, `Titular ${sufijo}`, `35100000${sufijo}`]
  );
  await ds.query(
    `INSERT INTO car (id, licensePlate, model, brand, year, kilometers, kmHistory, createdAt, updatedAt, ownerId)
     VALUES (?, ?, 'GOL', 'Volkswagen', 2016, 90000, '[]', '2026-01-01 09:00:00', '2026-01-01 09:00:00', ?)`,
    [`auto-${sufijo}`, patente, `cli-${sufijo}`]
  );
  return `auto-${sufijo}`;
};

/** Recordatorios de un vehículo, con su estado. */
const recordatorios = async (carId: string) =>
  (await ds.query(
    "SELECT id, status FROM service_reminder WHERE carId = ? ORDER BY id",
    [carId]
  )) as { id: string; status: string }[];

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-service-"));
});

afterEach(async () => {
  if (ds?.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("service:save", () => {
  it("avisa que cambiaron los datos, para que el badge y el dashboard no queden viejos", async () => {
    const { onDashboardStatsInvalidated } = await preparar();
    await crearAuto("AB123CD", "1");

    // Es la misma señal por la que el proceso principal manda `data-changed`
    // al renderer: si no se emite, el contador de la barra sigue mostrando el
    // número de antes hasta que otra cosa escriba.
    const avisos = vi.fn();
    onDashboardStatsInvalidated(avisos);

    const res = await invocar<Respuesta>("service:save", {
      licensePlate: "AB123CD",
      dueKm: 100000,
      dueDate: null,
    });

    expect(res.status).toBe("success");
    expect(avisos).toHaveBeenCalled();
  });

  it("sin id reutiliza el recordatorio vigente en vez de crear otro", async () => {
    await preparar();
    const carId = await crearAuto("AB123CD", "1");

    await invocar<Respuesta>("service:save", {
      licensePlate: "AB123CD",
      dueKm: 100000,
    });
    await invocar<Respuesta>("service:save", {
      licensePlate: "AB123CD",
      dueKm: 110000,
    });

    expect(await recordatorios(carId)).toHaveLength(1);
  });

  it("rechaza los datos que no alcanzan para programar nada", async () => {
    await preparar();
    await crearAuto("AB123CD", "1");

    const sinCriterio = await invocar<Respuesta>("service:save", {
      licensePlate: "AB123CD",
      dueDate: null,
      dueKm: null,
    });
    expect(sinCriterio.status).toBe("failed");

    const fechaMala = await invocar<Respuesta>("service:save", {
      licensePlate: "AB123CD",
      dueDate: "no es una fecha",
    });
    expect(fechaMala.status).toBe("failed");

    const kmNegativo = await invocar<Respuesta>("service:save", {
      licensePlate: "AB123CD",
      dueKm: -5,
    });
    expect(kmNegativo.status).toBe("failed");

    const autoInexistente = await invocar<Respuesta>("service:save", {
      licensePlate: "ZZ999ZZ",
      dueKm: 100000,
    });
    expect(autoInexistente.status).toBe("failed");
  });
  it("no deja dos recordatorios vigentes en el mismo vehículo", async () => {
    await preparar();
    const carId = await crearAuto("AB123CD", "1");

    // El vigente de siempre.
    const primero = await invocar<Respuesta>("service:save", {
      licensePlate: "AB123CD",
      dueKm: 100000,
    });
    const idPrimero = (primero.result as { id: string }).id;

    // Se cierra a mano, que es lo que hace completar un service: el viejo
    // queda `done` y se genera uno nuevo `pending`.
    await ds.query("UPDATE service_reminder SET status = ? WHERE id = ?", [
      ReminderStatus.DONE,
      idPrimero,
    ]);
    await invocar<Respuesta>("service:save", {
      licensePlate: "AB123CD",
      dueKm: 120000,
    });

    // Y ahora se edita el viejo desde el historial. Antes esto lo volvía a
    // poner vigente y el vehículo aparecía duplicado en la bandeja.
    const res = await invocar<Respuesta>("service:save", {
      id: idPrimero,
      licensePlate: "AB123CD",
      dueKm: 105000,
    });

    expect(res.status).toBe("failed");
    const activos = (await recordatorios(carId)).filter((r) =>
      [ReminderStatus.PENDING, ReminderStatus.SNOOZED].includes(
        r.status as ReminderStatus
      )
    );
    expect(activos).toHaveLength(1);
  });

  it("un id que ya no existe no crea un recordatorio nuevo por la ventana", async () => {
    await preparar();
    const carId = await crearAuto("AB123CD", "1");

    const res = await invocar<Respuesta>("service:save", {
      id: "un-id-que-no-esta",
      licensePlate: "AB123CD",
      dueKm: 100000,
    });

    expect(res.status).toBe("failed");
    expect(await recordatorios(carId)).toHaveLength(0);
  });

  it("no mueve un recordatorio de un vehículo a otro", async () => {
    await preparar();
    const primerAuto = await crearAuto("AB123CD", "1");
    const otroAuto = await crearAuto("XY456ZW", "2");

    const delPrimero = await invocar<Respuesta>("service:save", {
      licensePlate: "AB123CD",
      dueKm: 100000,
    });
    const idDelPrimero = (delPrimero.result as { id: string }).id;

    // Mismo id, otra patente: una pantalla con datos viejos alcanza para
    // llegar acá. Antes reasignaba el recordatorio sin decir nada.
    const res = await invocar<Respuesta>("service:save", {
      id: idDelPrimero,
      licensePlate: "XY456ZW",
      dueKm: 130000,
    });

    expect(res.status).toBe("failed");
    expect(await recordatorios(primerAuto)).toHaveLength(1);
    expect(await recordatorios(otroAuto)).toHaveLength(0);
  });
});

describe("service:settings-set", () => {
  const leer = async () =>
    (await invocar<{
      intervalMonths: number;
      intervalKm: number;
      soonDays: number;
      soonKm: number;
    }>("service:settings-get"))!;

  it("guarda los valores que están en rango", async () => {
    await preparar();

    const res = await invocar<Respuesta>("service:settings-set", {
      intervalMonths: 12,
      soonDays: 45,
    });

    expect(res.status).toBe("success");
    const actual = await leer();
    expect(actual.intervalMonths).toBe(12);
    expect(actual.soonDays).toBe(45);
    // Lo que no vino queda como estaba: la pantalla puede mandar sólo lo que cambió.
    expect(actual.intervalKm).toBe(10000);
  });

  it("avisa cuando un valor no sirve, en vez de decir que guardó", async () => {
    await preparar();
    const antes = await leer();

    // El caso que motivó esto: un 0 en "avisar con N días" no hacía nada, el
    // mensaje decía que sí, y el campo volvía al valor viejo sin explicación.
    const res = await invocar<Respuesta>("service:settings-set", {
      soonDays: 0,
    });

    expect(res.status).toBe("failed");
    expect(res.message).toContain("Avisar (días antes)");
    expect(await leer()).toEqual(antes);
  });

  it("pone techo además de piso", async () => {
    await preparar();
    const antes = await leer();

    // Sin techo, esto dejaba el próximo service programado para dentro de un
    // siglo: el vehículo fuera del circuito sin que nadie lo notara.
    const res = await invocar<Respuesta>("service:settings-set", {
      intervalKm: 999999999,
    });

    expect(res.status).toBe("failed");
    expect(await leer()).toEqual(antes);
  });

  it("no guarda la mitad de un formulario", async () => {
    await preparar();
    const antes = await leer();

    // Uno bueno y uno malo: guardar sólo el bueno deja al usuario sin forma de
    // saber qué quedó aplicado.
    const res = await invocar<Respuesta>("service:settings-set", {
      intervalMonths: 12,
      soonKm: -1,
    });

    expect(res.status).toBe("failed");
    expect(await leer()).toEqual(antes);
  });

  it("rechaza lo que no es un número", async () => {
    await preparar();
    const antes = await leer();

    for (const soonDays of ["treinta", null, NaN, {}]) {
      const res = await invocar<Respuesta>("service:settings-set", {
        soonDays,
      });
      // `null` significa "no lo mando", así que ése sí pasa sin tocar nada.
      const esperado = soonDays === null ? "success" : "failed";
      expect(res.status, JSON.stringify(soonDays)).toBe(esperado);
    }
    expect(await leer()).toEqual(antes);
  });
});
