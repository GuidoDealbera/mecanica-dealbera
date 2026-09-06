import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DataSource } from "typeorm";
import "reflect-metadata";

import { Car } from "./Entities/car.entity";
import { Client } from "./Entities/client.entity";
import { Job } from "./Entities/job.entity";
import { Document } from "./Entities/document.entity";
import { ServiceReminder } from "./Entities/serviceReminder.entity";
import { AppSetting } from "./Entities/appSetting.entity";
import { InitialSchema1700000000000 } from "./Migrations/1700000000000-InitialSchema";
import { AddPartsToExistingJobs1700000002000 } from "./Migrations/AddPartsToExistingJobs1700000002000";
import { AddOwnerIndex1700000003000 } from "./Migrations/AddOwnerIndex1700000003000";
import { NormalizeJobs1700000004000 } from "./Migrations/NormalizeJobs1700000004000";
import { AddNotesToJob1700000005000 } from "./Migrations/AddNotesToJob1700000005000";
import { CreateDocumentTable1700000006000 } from "./Migrations/CreateDocumentTable1700000006000";
import { CreateServiceReminders1700000007000 } from "./Migrations/CreateServiceReminders1700000007000";
import { AddJobStatusIndex1700000008000 } from "./Migrations/AddJobStatusIndex1700000008000";
import { NormalizeJobDates1700000009000 } from "./Migrations/NormalizeJobDates1700000009000";
import { AddClientNoteToJob1700000010000 } from "./Migrations/AddClientNoteToJob1700000010000";

import { computeDashboardStats } from "./dashboardStats.service";
import { JobStatus } from "../../src/Types/apiTypes";

/**
 * Los números del dashboard, contra una base SQLite **real** con todas las
 * migraciones aplicadas.
 *
 * Se usa un archivo temporal y no `:memory:` a propósito: el esquema lo crean
 * las migraciones, y probarlas de paso es parte del valor. Si una migración se
 * rompe, este test lo dice.
 *
 * Lo que se fija acá es el criterio que se decidió y es fácil de revertir sin
 * querer: **el ingreso es lo entregado, no lo completado**. Un trabajo
 * completado terminó y está listo para entregar; el que se cobró es el
 * entregado.
 */

let ds: DataSource;
let dir: string;

/** Formato canónico de fecha que escribe TypeORM en SQLite. */
const stamp = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.000`
  );
};

const esteMes = (dia: number): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), dia, 12, 0, 0);
};

const insertJob = async (
  id: string,
  carId: string,
  status: JobStatus,
  price: number,
  when: Date
) => {
  await ds.query(
    `INSERT INTO "job" ("id","price","description","isThirdParty","status","parts","createdAt","updatedAt","carId")
     VALUES (?,?,?,0,?,'[]',?,?,?)`,
    [id, price, `Trabajo ${id}`, status, stamp(when), stamp(when), carId]
  );
};

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "dealbera-stats-"));

  ds = new DataSource({
    type: "better-sqlite3",
    database: path.join(dir, "taller.db"),
    synchronize: false,
    migrationsRun: true,
    logging: false,
    entities: [Car, Client, Job, Document, ServiceReminder, AppSetting],
    migrations: [
      InitialSchema1700000000000,
      AddPartsToExistingJobs1700000002000,
      AddOwnerIndex1700000003000,
      NormalizeJobs1700000004000,
      AddNotesToJob1700000005000,
      CreateDocumentTable1700000006000,
      CreateServiceReminders1700000007000,
      AddJobStatusIndex1700000008000,
      NormalizeJobDates1700000009000,
      AddClientNoteToJob1700000010000,
    ],
  });
  await ds.initialize();

  await ds.query(
    `INSERT INTO "client" ("id","fullname","phone","address","city","isActive","createdAt")
     VALUES (?,?,?,?,?,1,?)`,
    [
      "cli-1",
      "Ana Gómez",
      "3510000001",
      "San Martín 100",
      "Córdoba",
      stamp(esteMes(1)),
    ]
  );
  await ds.query(
    `INSERT INTO "car" ("id","licensePlate","model","brand","year","kilometers","kmHistory","createdAt","updatedAt","ownerId")
     VALUES (?,?,?,?,?,?,'[]',?,?,?)`,
    [
      "car-1",
      "AB123CD",
      "GOL",
      "Volkswagen",
      2016,
      90000,
      stamp(esteMes(1)),
      stamp(esteMes(1)),
      "cli-1",
    ]
  );

  // Dos entregados (lo cobrado), un completado (terminado pero no cobrado),
  // uno en progreso y uno sin comenzar.
  await insertJob("j1", "car-1", JobStatus.DELIVERED, 100_000, esteMes(2));
  await insertJob("j2", "car-1", JobStatus.DELIVERED, 50_000, esteMes(3));
  await insertJob("j3", "car-1", JobStatus.COMPLETED, 900_000, esteMes(4));
  await insertJob("j4", "car-1", JobStatus.IN_PROGRESS, 7_000, esteMes(5));
  await insertJob("j5", "car-1", JobStatus.PENDING, 3_000, esteMes(6));
});

afterAll(async () => {
  if (ds?.isInitialized) await ds.destroy();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("computeDashboardStats", () => {
  it("los ingresos del mes suman sólo lo entregado", async () => {
    const stats = await computeDashboardStats(ds.manager);

    // 100.000 + 50.000. El completado de 900.000 NO entra: terminó, pero
    // todavía no se cobró.
    expect(stats.revenueThisMonth).toBe(150_000);
  });

  it("la tarjeta de ingresos coincide con la barra del mes en el gráfico", async () => {
    const stats = await computeDashboardStats(ds.manager);

    // Es la invariante que se rompió una vez: la tarjeta sumaba completados y
    // el gráfico completados + entregados, así que medían cosas distintas.
    const mesActual = stats.monthlyRevenue[stats.monthlyRevenue.length - 1];
    expect(mesActual.revenue).toBe(stats.revenueThisMonth);
  });

  it("cuenta cada estado por separado", async () => {
    const stats = await computeDashboardStats(ds.manager);

    expect(stats.deliveredJobs).toBe(2);
    expect(stats.completedJobs).toBe(1);
    expect(stats.jobsInProgress).toBe(1);
    expect(stats.pendingJobs).toBe(1);
    expect(stats.deliveredThisMonth).toBe(2);
    expect(stats.completedThisMonth).toBe(1);
  });

  it("los trabajos recientes salen ordenados y con datos del vehículo", async () => {
    const stats = await computeDashboardStats(ds.manager);

    expect(stats.recentDeliveredJobs).toHaveLength(2);
    // Del más nuevo al más viejo: j2 se entregó después que j1.
    expect(stats.recentDeliveredJobs[0].description).toBe("Trabajo j2");
    expect(stats.recentDeliveredJobs[0].licensePlate).toBe("AB123CD");
    expect(stats.recentDeliveredJobs[0].price).toBe(50_000);
  });

  it("cuenta vehículos y clientes del mes", async () => {
    const stats = await computeDashboardStats(ds.manager);

    expect(stats.totalCars).toBe(1);
    expect(stats.totalClients).toBe(1);
    expect(stats.activeClients).toBe(1);
    expect(stats.newCarsThisMonth).toBe(1);
    expect(stats.newClientsThisMonth).toBe(1);
  });

  it("el gráfico devuelve seis meses, aunque estén en cero", async () => {
    const stats = await computeDashboardStats(ds.manager);

    expect(stats.monthlyRevenue).toHaveLength(6);
    expect(stats.monthlyRevenue.slice(0, 5).every((m) => m.revenue === 0)).toBe(
      true
    );
  });
});
