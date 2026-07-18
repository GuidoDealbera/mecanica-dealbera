import { DataSource } from "typeorm";
import path from "path";
import { app } from "electron";
import { logError, logInfo } from "../logger";
import { Car } from "./Entities/car.entity";
import { Client } from "./Entities/client.entity";
import { InitialSchema1700000000000 } from "./Migrations/1700000000000-InitialSchema";
import { AddPartsToExistingJobs1700000002000 } from "./Migrations/AddPartsToExistingJobs1700000002000";
import { AddOwnerIndex1700000003000 } from "./Migrations/AddOwnerIndex1700000003000";

export const AppDataSource = new DataSource({
    type: 'sqlite',
    database: getDBPath(),
    entities: [Car, Client],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
    migrationsRun: true,
    migrations: [
        InitialSchema1700000000000,
        AddPartsToExistingJobs1700000002000,
        AddOwnerIndex1700000003000
    ],
    subscribers: []
})

export function getDBPath () {
    if(process.env.NODE_ENV === 'development'){
        return path.join(process.cwd(), 'data', 'taller.db');
    } else {
        const userDBPath = app.getPath('documents')
        return path.join(userDBPath, 'taller.db')
    }
}

export const initializeDB = async () => {
    try {
        logInfo('db:init', 'Inicializando base de datos')
        if(!AppDataSource.isInitialized){
            await AppDataSource.initialize()
            logInfo('db:init', 'Base de datos inicializada correctamente', { dbPath: getDBPath() })
        }
        return AppDataSource
    } catch (error) {
        logError('db:init', error, { dbPath: getDBPath() })
        const {dialog} = await import('electron')
        dialog.showErrorBox(
            'Error de Base de Datos',
            `
            No se pudo inicializar la base de datos.\n\n
            Ruta: ${getDBPath()}\n\n
            Error: ${error instanceof Error ? error.message : String(error)}
            `
        )
        throw error
    }
}

export const getRepositories = () => {
    return {
        clientRepository: AppDataSource.getRepository(Client),
        carRepository: AppDataSource.getRepository(Car)
    }
}