import { In } from "typeorm";
import { handleIpc } from "../../ipc";
import { escapeLike, resolvePage } from "../../pagination";
import { AppDataSource, getRepositories } from "../dataSource";
import { ServiceReminder } from "../Entities/serviceReminder.entity";
import {
  ACTIVE_STATUSES,
  completeAndScheduleNext,
  countDueReminders,
  getServiceSettings,
  reactivateExpiredSnoozes,
  saveServiceSettings,
} from "../serviceReminders.service";
import {
  ReminderStatus,
  ServiceType,
  type APIResponse,
  type Paginated,
  type ReminderQueryParams,
  type SaveReminderBody,
  type ServiceReminderView,
  type ServiceSettings,
} from "../../../src/Types/apiTypes";
import { estimateKmPerDay } from "../../../src/Utils/serviceReminders";

// ── Recordatorios de service ────────────────────────────────────────────
// La bandeja se resuelve en la base (filtro + orden + paginado), igual que el
// resto de los listados. La urgencia se calcula en el renderer con el módulo
// compartido `src/Utils/serviceReminders.ts`, que es la misma fuente de verdad
// que usa el backend para generar los vencimientos.

const VALID_TYPES = Object.values(ServiceType) as string[];

/**
 * Serializa el recordatorio para el renderer: sólo los datos del vehículo y del
 * titular que se muestran, y el promedio de km/día ya calculado (para no mandar
 * todo el historial de kilometraje por IPC).
 */
const toView = (reminder: ServiceReminder): ServiceReminderView => ({
  id: reminder.id,
  type: reminder.type,
  status: reminder.status,
  dueDate: reminder.dueDate ? new Date(reminder.dueDate).toISOString() : null,
  dueKm: reminder.dueKm ?? null,
  snoozedUntil: reminder.snoozedUntil
    ? new Date(reminder.snoozedUntil).toISOString()
    : null,
  contactedAt: reminder.contactedAt
    ? new Date(reminder.contactedAt).toISOString()
    : null,
  notes: reminder.notes ?? "",
  car: {
    licensePlate: reminder.car?.licensePlate ?? "",
    brand: reminder.car?.brand ?? "",
    model: reminder.car?.model ?? "",
    year: reminder.car?.year ?? 0,
    kilometers: reminder.car?.kilometers ?? 0,
  },
  owner: {
    fullname: reminder.car?.owner?.fullname ?? "Sin titular",
    phone: reminder.car?.owner?.phone ?? "",
  },
  kmPerDay: estimateKmPerDay(reminder.car?.kmHistory),
});

/** Busca un recordatorio con el vehículo y el titular cargados. */
const findReminder = async (id: string) =>
  getRepositories().serviceReminderRepository.findOne({
    where: { id },
    relations: ["car", "car.owner"],
  });

handleIpc("service:settings-get", async (): Promise<ServiceSettings> => {
  return await getServiceSettings(AppDataSource.manager);
});

handleIpc(
  "service:settings-set",
  async (
    _event,
    settings: Partial<ServiceSettings>
  ): Promise<APIResponse<ServiceSettings>> => {
    const saved = await saveServiceSettings(
      settings ?? {},
      AppDataSource.manager
    );
    return {
      status: "success",
      message: "Configuración de service actualizada",
      result: saved,
    };
  }
);

/**
 * Listado paginado de la bandeja de recordatorios.
 *
 * `scope`:
 * - `due` (por defecto): vigentes que ya vencieron o vencen pronto, por fecha
 *   **o** por kilómetros.
 * - `pending`: todos los vigentes, incluso los que faltan mucho.
 * - `all`: incluye hechos y descartados (historial).
 *
 * Orden: primero lo que vence antes; los que no tienen fecha (sólo por km) van
 * al final.
 */
handleIpc(
  "service:list",
  async (
    _event,
    params: ReminderQueryParams
  ): Promise<Paginated<ServiceReminderView>> => {
    await reactivateExpiredSnoozes(AppDataSource.manager);

    const { page, pageSize, skip, take } = resolvePage(params);
    const settings = await getServiceSettings(AppDataSource.manager);
    const scope = params?.scope ?? "due";

    const qb = getRepositories()
      .serviceReminderRepository.createQueryBuilder("reminder")
      .innerJoinAndSelect("reminder.car", "car")
      .leftJoinAndSelect("car.owner", "owner");

    if (scope === "due") {
      const soonDate = new Date();
      soonDate.setDate(soonDate.getDate() + settings.soonDays);
      qb.andWhere("reminder.status = :pending", {
        pending: ReminderStatus.PENDING,
      }).andWhere(
        "((reminder.dueDate IS NOT NULL AND reminder.dueDate <= :soonDate) OR (reminder.dueKm IS NOT NULL AND reminder.dueKm <= car.kilometers + :soonKm))",
        { soonDate, soonKm: settings.soonKm }
      );
    } else if (scope === "pending") {
      qb.andWhere("reminder.status IN (:...active)", {
        active: ACTIVE_STATUSES,
      });
    }

    if (params?.type && VALID_TYPES.includes(params.type)) {
      qb.andWhere("reminder.type = :type", { type: params.type });
    }

    const search = params?.search?.trim();
    if (search) {
      const term = `%${escapeLike(search)}%`;
      qb.andWhere(
        "(car.licensePlate LIKE :term ESCAPE :esc OR owner.fullname LIKE :term ESCAPE :esc)",
        { term, esc: "\\" }
      );
    }

    // Los recordatorios sin fecha (sólo por kilometraje) se ordenan al final.
    qb.orderBy("reminder.dueDate IS NULL", "ASC")
      .addOrderBy("reminder.dueDate", "ASC")
      .skip(skip)
      .take(take);

    const [items, total] = await qb.getManyAndCount();
    return { items: items.map(toView), total, page, pageSize };
  }
);

/** Conteo para el badge de la barra de navegación. */
handleIpc("service:count-due", async (): Promise<number> => {
  return await countDueReminders(AppDataSource.manager);
});

/** Recordatorios vigentes de un vehículo (bloque "próximo service" de la ficha). */
handleIpc(
  "service:by-car",
  async (_event, licensePlate: string): Promise<ServiceReminderView[]> => {
    await reactivateExpiredSnoozes(AppDataSource.manager);
    const reminders = await getRepositories().serviceReminderRepository.find({
      where: {
        car: { licensePlate },
        status: In(ACTIVE_STATUSES),
      },
      relations: ["car", "car.owner"],
      order: { dueDate: "ASC" },
    });
    return reminders.map(toView);
  }
);

/** Posterga un recordatorio N días (vuelve a aparecer al vencer el plazo). */
handleIpc(
  "service:snooze",
  async (
    _event,
    id: string,
    days: number
  ): Promise<APIResponse<ServiceReminderView>> => {
    const reminder = await findReminder(id);
    if (!reminder) {
      return { status: "failed", message: "Recordatorio no encontrado" };
    }

    const safeDays = Math.min(Math.max(Math.round(Number(days) || 0), 1), 365);
    const until = new Date();
    until.setDate(until.getDate() + safeDays);

    reminder.status = ReminderStatus.SNOOZED;
    reminder.snoozedUntil = until;
    const saved =
      await getRepositories().serviceReminderRepository.save(reminder);

    return {
      status: "success",
      message: `Recordatorio postergado ${safeDays} ${safeDays === 1 ? "día" : "días"}`,
      result: toView(saved),
    };
  }
);

/** Deja registro de que se contactó al titular (no cambia el vencimiento). */
handleIpc(
  "service:mark-contacted",
  async (_event, id: string): Promise<APIResponse<ServiceReminderView>> => {
    const reminder = await findReminder(id);
    if (!reminder) {
      return { status: "failed", message: "Recordatorio no encontrado" };
    }
    reminder.contactedAt = new Date();
    const saved =
      await getRepositories().serviceReminderRepository.save(reminder);
    return {
      status: "success",
      message: "Se registró el contacto con el titular",
      result: toView(saved),
    };
  }
);

/**
 * Marca el service como hecho a mano y programa el siguiente. La vía normal es
 * cerrar un trabajo de tipo service (lo hace `car:update-job`); esto cubre los
 * casos en los que el service no se cargó como trabajo.
 */
handleIpc(
  "service:complete",
  async (_event, id: string): Promise<APIResponse<ServiceReminderView>> => {
    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const reminder = await qr.manager.findOne(ServiceReminder, {
        where: { id },
        relations: ["car", "car.owner"],
      });
      if (!reminder) {
        await qr.rollbackTransaction();
        return { status: "failed", message: "Recordatorio no encontrado" };
      }

      const next = await completeAndScheduleNext(
        qr.manager,
        reminder.car,
        reminder.type
      );
      await qr.commitTransaction();

      next.car = reminder.car;
      return {
        status: "success",
        message: "Service registrado. Se programó el próximo",
        result: toView(next),
      };
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }
);

/** Descarta un recordatorio (no se vuelve a mostrar ni se genera el siguiente). */
handleIpc(
  "service:dismiss",
  async (_event, id: string): Promise<APIResponse> => {
    const repo = getRepositories().serviceReminderRepository;
    const reminder = await repo.findOne({ where: { id } });
    if (!reminder) {
      return { status: "failed", message: "Recordatorio no encontrado" };
    }
    reminder.status = ReminderStatus.DISMISSED;
    reminder.snoozedUntil = null;
    await repo.save(reminder);
    return {
      status: "success",
      message: "Recordatorio descartado",
      result: undefined,
    };
  }
);

/**
 * Crea o edita a mano el recordatorio de un vehículo (para ajustar la fecha o el
 * kilometraje del próximo service). Mantiene la invariante de un solo
 * recordatorio vigente por vehículo y tipo.
 */
handleIpc(
  "service:save",
  async (
    _event,
    body: SaveReminderBody
  ): Promise<APIResponse<ServiceReminderView>> => {
    if (!body?.licensePlate || !VALID_TYPES.includes(body.type)) {
      return { status: "failed", message: "Datos del recordatorio inválidos" };
    }

    const { carRepository, serviceReminderRepository: repo } =
      getRepositories();
    const car = await carRepository.findOne({
      where: { licensePlate: body.licensePlate },
      relations: ["owner"],
    });
    if (!car) {
      return { status: "failed", message: "Vehículo no registrado" };
    }

    const dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (dueDate && Number.isNaN(dueDate.getTime())) {
      return { status: "failed", message: "La fecha indicada no es válida" };
    }
    const dueKm =
      body.dueKm === null || body.dueKm === undefined
        ? null
        : Math.round(Number(body.dueKm));
    if (dueKm !== null && (!Number.isFinite(dueKm) || dueKm < 0)) {
      return { status: "failed", message: "El kilometraje no es válido" };
    }
    if (!dueDate && dueKm === null) {
      return {
        status: "failed",
        message: "Indicá al menos una fecha o un kilometraje",
      };
    }

    // Si no se está editando uno puntual, se reutiliza el vigente del tipo para
    // no dejar dos recordatorios activos del mismo service.
    const existing = body.id
      ? await repo.findOne({ where: { id: body.id }, relations: ["car"] })
      : await repo.findOne({
          where: {
            car: { id: car.id },
            type: body.type,
            status: In(ACTIVE_STATUSES),
          },
          relations: ["car"],
        });

    const reminder =
      existing ??
      repo.create({
        car,
        type: body.type,
        status: ReminderStatus.PENDING,
      });

    reminder.car = car;
    reminder.type = body.type;
    reminder.status = ReminderStatus.PENDING;
    reminder.snoozedUntil = null;
    reminder.dueDate = dueDate;
    reminder.dueKm = dueKm;
    if (body.notes !== undefined) reminder.notes = body.notes;

    const saved = await repo.save(reminder);
    saved.car = car;

    return {
      status: "success",
      message: "Recordatorio guardado",
      result: toView(saved),
    };
  }
);
