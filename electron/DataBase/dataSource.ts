import { DataSource } from "typeorm";
import path from "path";
import { app } from "electron";
import { Car } from "./Entities/car.entity";
import { Client } from "./Entities/client.entity";

export const AppDataSource = new DataSource({
    type: 'sqlite',
    database: getDBPath(),
    entities: [Car, Client],
    synchronize: true,
    logging: process.env.NODE_ENV === 'development',
    migrations: [],
    subscribers: []
})

function getDBPath () {
    if(process.env.NODE_ENV === 'development'){
        return path.join(process.cwd(), 'data', 'taller.db');
    } else {
        const userDBPath = app.getPath('documents')
        return path.join(userDBPath, 'taller.db')
    }
}

export const initializeDB = async () => {
    try {
        console.log('Inicializando base de datos...')
        if(!AppDataSource.isInitialized){
            await AppDataSource.initialize()
            console.log('Base de datos inicializada correctamente')
            console.log('DB Route: ', getDBPath())
        }
        return AppDataSource
    } catch (error) {
        console.error('Error al inicializar la base de datos: ', error)
        throw error
    }
}

export const getRepositories = () => {
    return {
        clientRepository: AppDataSource.getRepository(Client),
        carRepository: AppDataSource.getRepository(Car)
    }
}