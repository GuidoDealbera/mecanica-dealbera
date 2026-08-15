import { EntityManager } from "typeorm";
import { Car } from "./Entities/car.entity";
import { Client } from "./Entities/client.entity";
import { Job } from "./Entities/job.entity";
import { JobStatus } from "../../src/Types/apiTypes";
import type { DashboardStats } from "../../src/Types/types";
import { countDueReminders } from "./serviceReminders.service";

/**
 * Estadísticas del dashboard, resueltas con **agregados en la base**.
 *
 * Antes se traían todos los vehículos con todos sus trabajos al proceso
 * principal y se contaba y sumaba con un `for`: costo lineal en memoria y en
 * tiempo sobre el total histórico del taller, para mostrar una docena de
 * números. Acá cada número sale de un `COUNT`/`SUM`, y lo único que viaja son
 * los seis trabajos de cada listado.
 *
 * Recibe el `EntityManager` por parámetro (igual que
 * `serviceReminders.service.ts`): así el módulo no depende de la inicialización
 * de Electron y se puede probar.
 */

/** Nombre corto del mes, como se muestra en el eje del gráfico. */
const MONTH_NAMES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

/** Cuántos trabajos se muestran en cada listado de "recientes". */
const RECENT_LIMIT = 6;

/** Meses que abarca el gráfico de ingresos (incluido el actual). */
const REVENUE_MONTHS = 6;

/** Estados en los que un trabajo ya no está en curso. */
const CLOSED_STATUSES = [JobStatus.COMPLETED, JobStatus.DELIVERED];

/**
 * Estado que cuenta como ingreso.
 *
 * Es **entregado**, no completado: completado significa que el trabajo terminó y
 * está listo para entregar, pero el que se cobró de verdad es el que se entregó.
 * Antes los ingresos del mes sumaban los completados mientras el gráfico de seis
 * meses sumaba completados **y** entregados, así que la tarjeta y el gráfico
 * medían cosas distintas; encima el subtítulo de la tarjeta ya decía "trabajos
 * entregados este mes".
 */
const REVENUE_STATUS = JobStatus.DELIVERED;

/**
 * Expresión SQL que reduce una fecha a su mes (`YYYY-MM`).
 *
 * Se compara por **mes** y no con un `>=` contra un datetime a propósito: la
 * columna `job.createdAt/updatedAt` no tiene un único formato. Las filas que
 * escribe TypeORM son `YYYY-MM-DD HH:MM:SS.SSS` en hora local, pero las que
 * generó la migración `NormalizeJobs` (los trabajos que ya existían, tomados del
 * JSON de `car.jobs`) quedaron en ISO con `T` y `Z`. Un `>=` entre esos dos
 * formatos es una comparación de texto que puede fallar; `strftime` lee los dos
 * y comparar la clave del mes es exactamente lo que necesita el dashboard.
 *
 * Nota: para las filas en ISO con `Z`, `strftime` devuelve el mes en UTC, así que
 * un trabajo actualizado dentro de las 3 horas previas al cambio de mes podría
 * atribuirse al mes siguiente. Desaparece al normalizar el formato guardado (ver
 * la tarea correspondiente en el plan de mejoras).
 */
const monthOf = (column: string) => `strftime('%Y-%m', ${column})`;

/** Clave `YYYY-MM` de una fecha, en hora local. */
const monthKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/** Los últimos `count` meses (incluido el actual), del más viejo al más nuevo. */
const lastMonths = (
  now: Date,
  count: number
): { key: string; label: string }[] =>
  Array.from({ length: count }, (_, i) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - (count - 1) + i,
      1
    );
    return { key: monthKey(date), label: MONTH_NAMES[date.getMonth()] };
  });

/** Fila de los listados de "trabajos recientes". */
type RecentJob = DashboardStats["recentActiveJobs"][number];

/**
 * Trabajos más recientes de un estado, con los datos del vehículo. Se resuelve
 * con `LIMIT` en la base: antes se tomaban "los primeros seis que aparecían" al
 * recorrer los autos, sin ningún orden, así que no eran los más recientes.
 */
const findRecentJobs = async (
  manager: EntityManager,
  status: JobStatus,
  monthFilter?: string
): Promise<RecentJob[]> => {
  const qb = manager
    .createQueryBuilder(Job, "job")
    .innerJoin("job.car", "car")
    .select("car.licensePlate", "licensePlate")
    .addSelect("car.brand", "brand")
    .addSelect("car.model", "model")
    .addSelect("job.description", "description")
    .addSelect("job.price", "price")
    .where("job.status = :status", { status });

  if (monthFilter) {
    qb.andWhere(`${monthOf("job.updatedAt")} = :monthFilter`, { monthFilter });
  }

  const rows = await qb
    .orderBy("job.updatedAt", "DESC")
    .limit(RECENT_LIMIT)
    .getRawMany<RecentJob>();

  return rows.map((row) => ({ ...row, price: Number(row.price ?? 0) }));
};

export const computeDashboardStats = async (
  manager: EntityManager
): Promise<DashboardStats> => {
  const now = new Date();
  const currentMonth = monthKey(now);
  const months = lastMonths(now, REVENUE_MONTHS);

  const [
    carTotals,
    clientTotals,
    jobsByStatus,
    closedThisMonth,
    revenueByMonth,
    recentActiveJobs,
    recentCompletedJobs,
    recentDeliveredJobs,
    carsWithAlerts,
  ] = await Promise.all([
    manager
      .createQueryBuilder(Car, "car")
      .select("COUNT(car.id)", "total")
      .addSelect(
        `SUM(CASE WHEN ${monthOf("car.createdAt")} = :currentMonth THEN 1 ELSE 0 END)`,
        "thisMonth"
      )
      .setParameter("currentMonth", currentMonth)
      .getRawOne<{ total: number; thisMonth: number }>(),

    manager
      .createQueryBuilder(Client, "client")
      .select("COUNT(client.id)", "total")
      .addSelect("SUM(CASE WHEN client.isActive THEN 1 ELSE 0 END)", "active")
      .addSelect(
        `SUM(CASE WHEN ${monthOf("client.createdAt")} = :currentMonth THEN 1 ELSE 0 END)`,
        "thisMonth"
      )
      .setParameter("currentMonth", currentMonth)
      .getRawOne<{ total: number; active: number; thisMonth: number }>(),

    manager
      .createQueryBuilder(Job, "job")
      .select("job.status", "status")
      .addSelect("COUNT(job.id)", "count")
      .groupBy("job.status")
      .getRawMany<{ status: JobStatus; count: number }>(),

    manager
      .createQueryBuilder(Job, "job")
      .select("job.status", "status")
      .addSelect("COUNT(job.id)", "count")
      .addSelect("COALESCE(SUM(job.price), 0)", "total")
      .where("job.status IN (:...closed)", { closed: CLOSED_STATUSES })
      .andWhere(`${monthOf("job.updatedAt")} = :currentMonth`, { currentMonth })
      .groupBy("job.status")
      .getRawMany<{ status: JobStatus; count: number; total: number }>(),

    manager
      .createQueryBuilder(Job, "job")
      .select(monthOf("job.updatedAt"), "month")
      .addSelect("COALESCE(SUM(job.price), 0)", "total")
      .where("job.status = :revenueStatus", { revenueStatus: REVENUE_STATUS })
      .andWhere(`${monthOf("job.updatedAt")} IN (:...months)`, {
        months: months.map((month) => month.key),
      })
      .groupBy(monthOf("job.updatedAt"))
      .getRawMany<{ month: string; total: number }>(),

    findRecentJobs(manager, JobStatus.IN_PROGRESS),
    findRecentJobs(manager, JobStatus.COMPLETED, currentMonth),
    findRecentJobs(manager, JobStatus.DELIVERED, currentMonth),

    countDueReminders(manager),
  ]);

  const countOf = (status: JobStatus) =>
    Number(jobsByStatus.find((row) => row.status === status)?.count ?? 0);

  const closedOf = (status: JobStatus) =>
    closedThisMonth.find((row) => row.status === status);

  const revenueOf = (key: string) =>
    Number(revenueByMonth.find((row) => row.month === key)?.total ?? 0);

  return {
    totalCars: Number(carTotals?.total ?? 0),
    newCarsThisMonth: Number(carTotals?.thisMonth ?? 0),

    totalClients: Number(clientTotals?.total ?? 0),
    activeClients: Number(clientTotals?.active ?? 0),
    newClientsThisMonth: Number(clientTotals?.thisMonth ?? 0),

    pendingJobs: countOf(JobStatus.PENDING),
    jobsInProgress: countOf(JobStatus.IN_PROGRESS),
    completedJobs: countOf(JobStatus.COMPLETED),
    deliveredJobs: countOf(JobStatus.DELIVERED),

    completedThisMonth: Number(closedOf(JobStatus.COMPLETED)?.count ?? 0),
    deliveredThisMonth: Number(closedOf(JobStatus.DELIVERED)?.count ?? 0),
    // Ver `REVENUE_STATUS`: el ingreso es lo entregado, que es lo cobrado. Con
    // esto la tarjeta coincide con su propio subtítulo ("N trabajos entregados
    // este mes") y con la barra del mes actual del gráfico.
    revenueThisMonth: Number(closedOf(REVENUE_STATUS)?.total ?? 0),

    monthlyRevenue: months.map((month) => ({
      month: month.label,
      revenue: revenueOf(month.key),
    })),

    recentActiveJobs,
    recentCompletedJobs,
    recentDeliveredJobs,

    carsWithAlerts,
  };
};
