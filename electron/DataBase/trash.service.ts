import { EntityManager } from "typeorm";

/**
 * La papelera: poder deshacer un borrado.
 *
 * Borrar un vehículo se llevaba sus trabajos, su historial de kilometraje y su
 * recordatorio. Borrar un cliente se llevaba además **todos sus vehículos**.
 * Era irreversible salvo restaurando un respaldo entero, o sea eligiendo entre
 * perder un dato y perder un día de trabajo.
 *
 * ## Por qué no es un borrado lógico
 *
 * Lo natural sería un `deletedAt` y filtrar. Se midió lo que costaba: hay
 * **seis consultas agregadas sobre `job` que nunca pasan por `car`** —el
 * contador de trabajos activos de la barra y cinco del dashboard—. Con un
 * borrado lógico, los trabajos de un vehículo borrado seguirían contando en el
 * badge, en la torta de estados y en la facturación del mes, y la regla "acordate
 * de excluir los borrados" no se ve desde la consulta: la próxima que alguien
 * escriba va a estar mal y nadie se va a enterar.
 *
 * Acá el vehículo se borra **de verdad**, igual que antes, y lo que queda es una
 * copia de sus filas en otra tabla. Ninguna consulta existente cambia, no hay
 * invariante nueva que recordar, y restaurar es volver a insertar lo que había.
 * Es el mismo criterio que el de los documentos: guardar la copia de lo que
 * hubo, no marcar lo que sigue estando.
 *
 * ## Qué se guarda
 *
 * Las filas crudas, tal como están en la base, y no un objeto armado a mano. Así
 * una columna nueva entra sola en la copia en vez de olvidarse.
 */

/** Cuántos borrados se conservan antes de empezar a tirar los más viejos. */
export const PAPELERA_MAXIMA = 50;

export type TrashKind = "car" | "client";

/** Filas de una tabla, tal como salieron de la base. */
type Filas = Record<string, unknown>[];

export interface TrashPayload {
  client: Filas;
  car: Filas;
  job: Filas;
  service_reminder: Filas;
}

export interface TrashItem {
  id: string;
  kind: TrashKind;
  /** Cómo se llama en la pantalla: "AB123CD — Volkswagen Gol". */
  label: string;
  deletedAt: string;
  /** Qué arrastró: para que el usuario sepa qué recupera. */
  counts: { cars: number; jobs: number; reminders: number };
}

/**
 * El orden importa al restaurar: un vehículo referencia a su titular y un
 * trabajo a su vehículo.
 */
const ORDEN: (keyof TrashPayload)[] = [
  "client",
  "car",
  "job",
  "service_reminder",
];

const filasDe = (manager: EntityManager, sql: string, params: unknown[]) =>
  manager.query(sql, params) as Promise<Filas>;

/** Todo lo que cuelga de un vehículo. */
const copiarVehiculo = async (
  manager: EntityManager,
  carId: string
): Promise<Omit<TrashPayload, "client">> => ({
  car: await filasDe(manager, `SELECT * FROM "car" WHERE "id" = ?`, [carId]),
  job: await filasDe(manager, `SELECT * FROM "job" WHERE "carId" = ?`, [carId]),
  service_reminder: await filasDe(
    manager,
    `SELECT * FROM "service_reminder" WHERE "carId" = ?`,
    [carId]
  ),
});

const guardar = async (
  manager: EntityManager,
  kind: TrashKind,
  label: string,
  payload: TrashPayload
): Promise<void> => {
  await manager.query(
    `INSERT INTO "deleted_item" ("id", "kind", "label", "payload", "deletedAt")
     VALUES (?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      kind,
      label,
      JSON.stringify(payload),
      new Date().toISOString(),
    ]
  );
  await podar(manager);
};

/** Manda un vehículo a la papelera. Quien llama después lo borra de verdad. */
export const moveCarToTrash = async (
  manager: EntityManager,
  carId: string,
  label: string
): Promise<void> => {
  const delVehiculo = await copiarVehiculo(manager, carId);
  await guardar(manager, "car", label, { client: [], ...delVehiculo });
};

/** Manda un cliente y todos sus vehículos a la papelera. */
export const moveClientToTrash = async (
  manager: EntityManager,
  clientId: string,
  label: string
): Promise<void> => {
  const client = await filasDe(
    manager,
    `SELECT * FROM "client" WHERE "id" = ?`,
    [clientId]
  );
  const autos = await filasDe(
    manager,
    `SELECT "id" FROM "car" WHERE "ownerId" = ?`,
    [clientId]
  );

  const payload: TrashPayload = {
    client,
    car: [],
    job: [],
    service_reminder: [],
  };
  for (const auto of autos) {
    const delVehiculo = await copiarVehiculo(manager, String(auto.id));
    payload.car.push(...delVehiculo.car);
    payload.job.push(...delVehiculo.job);
    payload.service_reminder.push(...delVehiculo.service_reminder);
  }

  await guardar(manager, "client", label, payload);
};

const comoPayload = (crudo: unknown): TrashPayload => {
  const p = (typeof crudo === "string" ? JSON.parse(crudo) : crudo) as Partial<
    Record<keyof TrashPayload, Filas>
  >;
  return {
    client: p.client ?? [],
    car: p.car ?? [],
    job: p.job ?? [],
    service_reminder: p.service_reminder ?? [],
  };
};

/** Lo que hay en la papelera, de lo más reciente a lo más viejo. */
export const listTrash = async (
  manager: EntityManager
): Promise<TrashItem[]> => {
  const filas = await filasDe(
    manager,
    `SELECT "id", "kind", "label", "payload", "deletedAt" FROM "deleted_item"
     ORDER BY "deletedAt" DESC`,
    []
  );

  return filas.map((fila) => {
    const payload = comoPayload(fila.payload);
    return {
      id: String(fila.id),
      kind: fila.kind as TrashKind,
      label: String(fila.label),
      deletedAt: String(fila.deletedAt),
      counts: {
        cars: payload.car.length,
        jobs: payload.job.length,
        reminders: payload.service_reminder.length,
      },
    };
  });
};

export type Restauracion =
  { ok: true; label: string } | { ok: false; message: string };

/**
 * Vuelve a insertar lo que se había borrado.
 *
 * Falla entera si algo choca —una patente que se volvió a usar, un id que ya
 * existe—: media restauración es peor que ninguna, porque deja al usuario con
 * un vehículo sin sus trabajos y sin forma de saberlo.
 */
export const restoreFromTrash = async (
  manager: EntityManager,
  id: string
): Promise<Restauracion> => {
  const [fila] = await filasDe(
    manager,
    `SELECT * FROM "deleted_item" WHERE "id" = ?`,
    [id]
  );
  if (!fila) return { ok: false, message: "No se encontró lo borrado" };

  const payload = comoPayload(fila.payload);

  // La patente es la identidad del vehículo: si mientras tanto se cargó otro
  // con la misma, restaurar crearía dos.
  for (const car of payload.car) {
    const [existe] = await filasDe(
      manager,
      `SELECT "id" FROM "car" WHERE "licensePlate" = ?`,
      [car.licensePlate]
    );
    if (existe) {
      return {
        ok: false,
        message: `Ya hay un vehículo cargado con la patente ${String(
          car.licensePlate
        )}, así que no se puede restaurar este`,
      };
    }
  }

  for (const tabla of ORDEN) {
    for (const registro of payload[tabla]) {
      // El cliente puede seguir estando —se borró sólo el auto, o ya se
      // restauró—: en ese caso no se lo vuelve a insertar, pero el vehículo
      // conserva su `ownerId`.
      if (tabla === "client") {
        const [existe] = await filasDe(
          manager,
          `SELECT "id" FROM "client" WHERE "id" = ?`,
          [registro.id]
        );
        if (existe) continue;
      }
      const columnas = Object.keys(registro);
      await manager.query(
        `INSERT INTO "${tabla}" (${columnas.map((c) => `"${c}"`).join(", ")})
         VALUES (${columnas.map(() => "?").join(", ")})`,
        columnas.map((c) => registro[c])
      );
    }
  }

  await manager.query(`DELETE FROM "deleted_item" WHERE "id" = ?`, [id]);
  return { ok: true, label: String(fila.label) };
};

/** Tira definitivamente un elemento de la papelera. */
export const purgeFromTrash = async (
  manager: EntityManager,
  id: string
): Promise<boolean> => {
  const resultado = await filasDe(
    manager,
    `SELECT "id" FROM "deleted_item" WHERE "id" = ?`,
    [id]
  );
  if (resultado.length === 0) return false;
  await manager.query(`DELETE FROM "deleted_item" WHERE "id" = ?`, [id]);
  return true;
};

/**
 * Deja sólo los últimos `PAPELERA_MAXIMA`.
 *
 * La papelera guarda copias enteras de vehículos con sus trabajos: sin tope
 * crece igual que crecía la carpeta de respaldos antes de tener retención.
 */
export const podar = async (
  manager: EntityManager,
  conservar = PAPELERA_MAXIMA
): Promise<number> => {
  const sobran = await filasDe(
    manager,
    `SELECT "id" FROM "deleted_item"
     ORDER BY "deletedAt" DESC LIMIT -1 OFFSET ?`,
    [conservar]
  );
  for (const fila of sobran) {
    await manager.query(`DELETE FROM "deleted_item" WHERE "id" = ?`, [fila.id]);
  }
  return sobran.length;
};
