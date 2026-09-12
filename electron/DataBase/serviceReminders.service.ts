import { EntityManager, In, IsNull, LessThanOrEqual } from "typeorm";
import { AppSetting } from "./Entities/appSetting.entity";
import { Car } from "./Entities/car.entity";
import { ServiceReminder } from "./Entities/serviceReminder.entity";
import {
  DEFAULT_SERVICE_SETTINGS,
  ReminderStatus,
  ServiceSettings,
} from "../../src/Types/apiTypes";
import { computeNextService } from "../../src/Utils/serviceReminders";

/**
 * Reglas de dominio de los recordatorios de service, compartidas por los
 * endpoints de recordatorios y por los de trabajos (que generan el siguiente
 * recordatorio al cerrar un service). Vive acá para que la regla exista **una
 * sola vez**: la duplicación entre el endpoint de alertas, el dashboard y la
 * notificación de arranque era justamente uno de los problemas de la versión
 * anterior.
 *
 * Todas las funciones reciben el `EntityManager` por parámetro (en vez de tomar
 * `AppDataSource` por su cuenta): así el módulo no depende de la inicialización
 * de Electron, funciona igual dentro de una transacción y se puede probar.
 */

/** Estados en los que un recordatorio sigue "vivo". */
export const ACTIVE_STATUSES = [ReminderStatus.PENDING, ReminderStatus.SNOOZED];

const SETTING_KEYS: Record<keyof ServiceSettings, string> = {
  intervalMonths: "service.intervalMonths",
  intervalKm: "service.intervalKm",
  soonDays: "service.soonDays",
  soonKm: "service.soonKm",
};

/**
 * Configuración vigente: los valores guardados sobre los valores por defecto.
 * Un valor inválido en la base no rompe nada (se ignora y queda el default).
 */
export const getServiceSettings = async (
  manager: EntityManager
): Promise<ServiceSettings> => {
  const rows = await manager.find(AppSetting, {
    where: { key: In(Object.values(SETTING_KEYS)) },
  });
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  const read = (field: keyof ServiceSettings): number => {
    const raw = byKey.get(SETTING_KEYS[field]);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0
      ? Math.round(parsed)
      : DEFAULT_SERVICE_SETTINGS[field];
  };

  return {
    intervalMonths: read("intervalMonths"),
    intervalKm: read("intervalKm"),
    soonDays: read("soonDays"),
    soonKm: read("soonKm"),
  };
};

/**
 * Límites de cada valor, con el nombre que ve el usuario en la pantalla.
 *
 * El techo importa tanto como el piso: sin él, `intervalKm = 999999999` se
 * aceptaba y dejaba el próximo service programado para dentro de un siglo, o
 * sea al vehículo fuera del circuito sin que nadie lo notara.
 */
const LIMITES: Record<
  keyof ServiceSettings,
  { etiqueta: string; min: number; max: number }
> = {
  // Diez años de intervalo ya es "no hacerle service"; menos de un mes no es un
  // intervalo, es un error de tipeo.
  intervalMonths: { etiqueta: "Cada (meses)", min: 1, max: 120 },
  intervalKm: { etiqueta: "Cada (km)", min: 100, max: 200_000 },
  // Avisar con más de un año de anticipación es tener todo siempre en la lista.
  soonDays: { etiqueta: "Avisar (días antes)", min: 1, max: 365 },
  soonKm: { etiqueta: "Avisar (km antes)", min: 1, max: 50_000 },
};

export type GuardadoDeConfiguracion =
  { ok: true; settings: ServiceSettings } | { ok: false; message: string };

/**
 * Guarda la configuración de service.
 *
 * Antes filtraba en silencio los valores que no fueran positivos y guardaba el
 * resto, y el endpoint contestaba "Configuración actualizada" igual. Poner un
 * `0` en "avisar con N días" no hacía nada, decía que sí, y el campo volvía al
 * valor viejo sin explicación.
 *
 * Ahora es todo o nada: si algo de lo que vino está fuera de rango, no se guarda
 * nada y se dice **qué campo** y **entre qué valores** tiene que estar. Guardar
 * la mitad de un formulario es peor que no guardarlo, porque el usuario no tiene
 * forma de saber qué quedó.
 */
export const saveServiceSettings = async (
  partial: Partial<ServiceSettings>,
  manager: EntityManager
): Promise<GuardadoDeConfiguracion> => {
  const campos = Object.keys(SETTING_KEYS) as (keyof ServiceSettings)[];
  const aGuardar: [keyof ServiceSettings, number][] = [];

  for (const field of campos) {
    const value = partial?.[field];
    // Lo que no vino no se toca: la pantalla puede mandar sólo lo que cambió.
    if (value === undefined || value === null) continue;

    const { etiqueta, min, max } = LIMITES[field];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { ok: false, message: `"${etiqueta}" tiene que ser un número` };
    }
    const redondeado = Math.round(value);
    if (redondeado < min || redondeado > max) {
      return {
        ok: false,
        message: `"${etiqueta}" tiene que estar entre ${min} y ${max}`,
      };
    }
    aGuardar.push([field, redondeado]);
  }

  for (const [field, value] of aGuardar) {
    await manager.save(
      AppSetting,
      manager.create(AppSetting, {
        key: SETTING_KEYS[field],
        value: String(value),
      })
    );
  }

  return { ok: true, settings: await getServiceSettings(manager) };
};

/**
 * Recordatorio vigente de un vehículo, si existe.
 *
 * Es **uno por vehículo**: antes había uno por tipo de service, pero los tipos
 * se eliminaron (ver la migración SimplifyServiceType1700000011000).
 */
export const findActiveReminder = async (
  manager: EntityManager,
  carId: string
): Promise<ServiceReminder | null> =>
  manager.findOne(ServiceReminder, {
    where: { car: { id: carId }, status: In(ACTIVE_STATUSES) },
    relations: { car: true },
  });

/**
 * Crea el recordatorio inicial de un vehículo si todavía no tiene uno vigente.
 * Se usa al registrar un auto (para que aparezca en el circuito de service desde
 * el primer día) y como red de seguridad.
 */
export const ensureReminder = async (
  manager: EntityManager,
  car: Car
): Promise<ServiceReminder | null> => {
  const existing = await findActiveReminder(manager, car.id);
  if (existing) return existing;

  const settings = await getServiceSettings(manager);
  const { dueDate, dueKm } = computeNextService({
    fromDate: car.createdAt ? new Date(car.createdAt) : new Date(),
    fromKm: car.kilometers,
    intervalMonths: car.serviceIntervalMonths,
    intervalKm: car.serviceIntervalKm,
    settings,
  });

  return manager.save(
    ServiceReminder,
    manager.create(ServiceReminder, {
      car,
      status: ReminderStatus.PENDING,
      dueDate,
      dueKm,
    })
  );
};

/**
 * Cierra el recordatorio vigente del vehículo (marcándolo como hecho) y genera
 * el siguiente a partir de la fecha y el kilometraje del service realizado.
 *
 * Es lo que hace que el sistema se mantenga solo: cada service completado
 * programa el próximo, sin que haya que cargar nada a mano.
 */
export const completeAndScheduleNext = async (
  manager: EntityManager,
  car: Car,
  doneAt: Date = new Date(),
  doneKm?: number | null
): Promise<ServiceReminder> => {
  const current = await findActiveReminder(manager, car.id);
  if (current) {
    current.status = ReminderStatus.DONE;
    current.snoozedUntil = null;
    await manager.save(ServiceReminder, current);
  }

  const settings = await getServiceSettings(manager);
  const { dueDate, dueKm } = computeNextService({
    fromDate: doneAt,
    fromKm: doneKm ?? car.kilometers,
    intervalMonths: car.serviceIntervalMonths,
    intervalKm: car.serviceIntervalKm,
    settings,
  });

  return manager.save(
    ServiceReminder,
    manager.create(ServiceReminder, {
      car,
      status: ReminderStatus.PENDING,
      dueDate,
      dueKm,
    })
  );
};

/**
 * Reactiva los postergados cuyo plazo ya venció: vuelven a `pending` para que
 * reaparezcan en la bandeja. Se ejecuta antes de listar o contar, así el estado
 * guardado no queda desfasado con el paso del tiempo.
 */
export const reactivateExpiredSnoozes = async (
  manager: EntityManager
): Promise<void> => {
  await manager.update(
    ServiceReminder,
    {
      status: ReminderStatus.SNOOZED,
      snoozedUntil: LessThanOrEqual(new Date()),
    },
    { status: ReminderStatus.PENDING, snoozedUntil: null }
  );
  // Un postergado sin fecha no tiene forma de volver: se normaliza.
  await manager.update(
    ServiceReminder,
    { status: ReminderStatus.SNOOZED, snoozedUntil: IsNull() },
    { status: ReminderStatus.PENDING }
  );
};

/**
 * Cantidad de recordatorios que requieren atención (vencidos o por vencer), con
 * el mismo criterio que la bandeja: vence por fecha **o** por kilómetros.
 * Alimenta el badge de la barra y la notificación de arranque.
 */
export const countDueReminders = async (
  manager: EntityManager
): Promise<number> => {
  await reactivateExpiredSnoozes(manager);
  const settings = await getServiceSettings(manager);
  const soonDate = new Date();
  soonDate.setDate(soonDate.getDate() + settings.soonDays);

  const row = await manager
    .createQueryBuilder(ServiceReminder, "reminder")
    // `COUNT(*)` y no `COUNT(reminder.id)`: el PK es un uuid y no el rowid de
    // SQLite, así que nombrar la columna obliga a leer la fila entera en vez de
    // resolverlo con el índice —medido en su momento: 1,1 ms contra 88 ms—. Son
    // equivalentes, porque el PK nunca es NULL. Era el único lugar del backend
    // que se había quedado afuera de esa regla, y no es cualquiera: alimenta el
    // contador de la barra y la notificación de arranque.
    .select("COUNT(*)", "count")
    .innerJoin("reminder.car", "car")
    .where("reminder.status = :pending", { pending: ReminderStatus.PENDING })
    .andWhere(
      "((reminder.dueDate IS NOT NULL AND reminder.dueDate <= :soonDate) OR (reminder.dueKm IS NOT NULL AND reminder.dueKm <= car.kilometers + :soonKm))",
      { soonDate, soonKm: settings.soonKm }
    )
    .getRawOne<{ count: number }>();

  return Number(row?.count ?? 0);
};
