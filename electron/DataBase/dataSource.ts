import { DataSource } from "typeorm";
import path from "path";
import { app } from "electron";
import { logError, logInfo } from "../logger";
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

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: getDBPath(),
  entities: [Car, Client, Job, Document, ServiceReminder, AppSetting],
  synchronize: false,
  logging: process.env.NODE_ENV === "development",
  migrationsRun: true,
  migrations: [
    InitialSchema1700000000000,
    AddPartsToExistingJobs1700000002000,
    AddOwnerIndex1700000003000,
    NormalizeJobs1700000004000,
    AddNotesToJob1700000005000,
    CreateDocumentTable1700000006000,
    CreateServiceReminders1700000007000,
  ],
  subscribers: [],
});

export function getDBPath() {
  if (process.env.NODE_ENV === "development") {
    return path.join(process.cwd(), "data", "taller.db");
  } else {
    const userDBPath = app.getPath("documents");
    return path.join(userDBPath, "taller.db");
  }
}

export const initializeDB = async () => {
  try {
    logInfo("db:init", "Inicializando base de datos");
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logInfo("db:init", "Base de datos inicializada correctamente", {
        dbPath: getDBPath(),
      });
    }
    return AppDataSource;
  } catch (error) {
    logError("db:init", error, { dbPath: getDBPath() });
    const { dialog } = await import("electron");
    dialog.showErrorBox(
      "Error de Base de Datos",
      `
            No se pudo inicializar la base de datos.\n\n
            Ruta: ${getDBPath()}\n\n
            Error: ${error instanceof Error ? error.message : String(error)}
            `
    );
    throw error;
  }
};

export const getRepositories = () => {
  return {
    clientRepository: AppDataSource.getRepository(Client),
    carRepository: AppDataSource.getRepository(Car),
    jobRepository: AppDataSource.getRepository(Job),
    documentRepository: AppDataSource.getRepository(Document),
    serviceReminderRepository: AppDataSource.getRepository(ServiceReminder),
    appSettingRepository: AppDataSource.getRepository(AppSetting),
  };
};
