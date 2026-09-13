import { In } from "typeorm";
import { handleIpc, handleIpcQuery } from "../../ipc";
import { logError } from "../../logger";
import { AppDataSource, getRepositories } from "../dataSource";
import { CreateJobDto, UpdateJobDto } from "../Types/car.dto";
import { validateDto } from "../../validation";
import { CreateCarJob, JobStatus } from "../../../src/Types/apiTypes";
import { Car } from "../Entities/car.entity";
import { Job } from "../Entities/job.entity";
import { invalidateDashboardStatsCache } from "../dashboardCache";
import { completeAndScheduleNext } from "../serviceReminders.service";

// ── Trabajos (jobs) de cada vehículo: alta, conteo de activos y actualización.
// Los trabajos son una entidad propia (`job`) con FK a `car`.

// Devuelve el trabajo sin la relación `car` cargada, para no serializar el
// auto completo (y su cadena de relaciones) hacia el renderer.
function toPlainJob(job: Job) {
  return {
    id: job.id,
    price: job.price,
    description: job.description,
    isThirdParty: job.isThirdParty,
    status: job.status,
    parts: job.parts ?? [],
    notes: job.notes ?? "",
    clientNote: job.clientNote ?? "",
    isService: job.isService ?? false,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

/** Un service se considera hecho cuando el trabajo queda completado o entregado. */
const isClosed = (status: JobStatus) =>
  status === JobStatus.COMPLETED || status === JobStatus.DELIVERED;

// El alta del trabajo y el cierre/programación del recordatorio de service van
// en **una sola transacción**: son un mismo hecho del taller ("se hizo el
// service"). Antes el recordatorio se resolvía después de guardar y con el
// manager global, así que si esa segunda parte fallaba el trabajo quedaba
// cargado como service hecho y el vehículo seguía apareciendo como que lo
// necesita. Por eso el módulo de dominio recibe el `EntityManager` por
// parámetro: acá se le pasa el de la transacción.
handleIpc("car:add-job", async (_, license: string, jobDto: CreateCarJob) => {
  // Se valida acá y no se confía en el formulario: un canal IPC recibe lo que le
  // manden. Antes esto era `price: jobDto.price as number` —un cast, que no
  // comprueba nada en ejecución— y entraba cualquier cosa. Ver `CreateJobDto`.
  const validation = await validateDto(CreateJobDto, jobDto);
  if (!validation.ok) {
    return { status: "failed", message: validation.message };
  }
  const datos = validation.dto;

  const qr = AppDataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    const car = await qr.manager.findOne(Car, {
      where: { licensePlate: license },
    });
    if (!car) {
      await qr.rollbackTransaction();
      return {
        status: "failed",
        message: "Vehículo no registrado",
      };
    }

    const job = qr.manager.create(Job, {
      price: datos.price,
      description: datos.description,
      isThirdParty: datos.isThirdParty,
      status: datos.status,
      parts: datos.parts,
      notes: datos.notes,
      clientNote: datos.clientNote,
      isService: datos.isService ?? false,
      car,
    });
    const saved = await qr.manager.save(Job, job);

    // Si el trabajo es un service y ya se carga cerrado, se programa el siguiente.
    if (saved.isService && isClosed(saved.status)) {
      await completeAndScheduleNext(
        qr.manager,
        car,
        saved.updatedAt ?? new Date(),
        car.kilometers
      );
    }

    await qr.commitTransaction();
    // Después del commit: si la transacción se revierte, la caché no tiene por
    // qué invalidarse (nada cambió).
    invalidateDashboardStatsCache();

    return {
      status: "success",
      message: "Trabajo registrado exitosamente",
      result: toPlainJob(saved),
    };
  } catch (error) {
    await qr.rollbackTransaction();
    logError("car:add-job", error, { license });
    return { status: "failed", message: "Error al registrar el trabajo" };
  } finally {
    await qr.release();
  }
});

// Cantidad de trabajos activos (pendientes o en progreso) en todo el taller.
// Alimenta el badge de la barra de navegación: es un COUNT liviano sobre la
// tabla `job`, sin traer autos ni trabajos completos al renderer.
handleIpcQuery(
  "car:active-jobs-count",
  "No se pudo contar los trabajos activos",
  async (): Promise<number> => {
    const { jobRepository } = getRepositories();
    return await jobRepository.count({
      where: { status: In([JobStatus.PENDING, JobStatus.IN_PROGRESS]) },
    });
  }
);

// Misma transacción única que en el alta: actualizar el trabajo y cerrar el
// recordatorio del service son la misma operación.
handleIpc(
  "car:update-job",
  async (_, license: string, jobId: string, updateJobDto: UpdateJobDto) => {
    // Editar era la puerta de atrás: el DTO estaba escrito y sólo se usaba como
    // tipo, así que por acá entraba lo mismo que el alta rechazaba.
    const validation = await validateDto(UpdateJobDto, updateJobDto);
    if (!validation.ok) {
      return { status: "failed", message: validation.message };
    }
    const cambios = validation.dto;

    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const job = await qr.manager.findOne(Job, {
        where: { id: jobId },
        relations: { car: true },
      });
      if (!job) {
        await qr.rollbackTransaction();
        return {
          status: "failed",
          message: "El trabajo que intenta modificar no existe",
        };
      }
      if (job.car?.licensePlate !== license) {
        await qr.rollbackTransaction();
        return {
          status: "failed",
          message: `El vehículo registrado con patente ${license} no tiene registrado el trabajo que intenta modificar`,
        };
      }

      // Se guarda el estado previo para detectar la transición a "cerrado": el
      // recordatorio se programa una sola vez, cuando el service pasa a estar
      // hecho (y no cada vez que se edita un trabajo ya cerrado).
      const wasClosed = isClosed(job.status);

      if (cambios.status !== undefined) job.status = cambios.status;
      if (cambios.price !== undefined) job.price = cambios.price;
      if (cambios.parts !== undefined) job.parts = cambios.parts;
      if (cambios.notes !== undefined) job.notes = cambios.notes;
      if (cambios.clientNote !== undefined) job.clientNote = cambios.clientNote;
      if (cambios.isService !== undefined) job.isService = cambios.isService;

      const saved = await qr.manager.save(Job, job);

      if (saved.isService && !wasClosed && isClosed(saved.status)) {
        await completeAndScheduleNext(
          qr.manager,
          job.car,
          new Date(),
          job.car.kilometers
        );
      }

      await qr.commitTransaction();
      invalidateDashboardStatsCache();

      return {
        status: "success",
        message: "Trabajo actualizado correctamente",
        result: toPlainJob(saved),
      };
    } catch (error) {
      await qr.rollbackTransaction();
      logError("car:update-job", error, { license, jobId });
      return { status: "failed", message: "Error al actualizar el trabajo" };
    } finally {
      await qr.release();
    }
  }
);
