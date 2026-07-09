import { ipcMain } from "electron";
import log from "electron-log/main";
import { CreateClientDto } from "../Types/client.dto";
import { AppDataSource, getRepositories } from "../dataSource";
import { Car } from "../Entities/car.entity";
import { Client } from "../Entities/client.entity";

ipcMain.handle('client:create', async (_, createClientDto: CreateClientDto) => {
    const repo = getRepositories().clientRepository
    const owner = await repo.findOne({
        where: {
            fullname: createClientDto.fullname
        }
    })
    if(owner){
        return {
            status: 'failed',
            message: 'Cliente ya registrado'
        }
    }
    const newOwner = repo.create(createClientDto)
    await repo.save(newOwner)
    return {
        status: 'success',
        message: 'Cliente registrado correctamente'
    }
})

ipcMain.handle('client:get-all', async () => {
    const repo = getRepositories().clientRepository
    return await repo.find({
        relations: ['cars']
    })
})

ipcMain.handle('client:find-by-name', async (_, fullname: CreateClientDto['fullname']) => {
    const repo = getRepositories().clientRepository
    const owner = await repo.findOne({
        where: {
            fullname
        },
        relations: ['cars']
    })
    if(!owner){
        return {
            status: 'failed',
            message: 'Cliente no registrado'
        }
    }
    return {
        status: 'success',
        message: 'Cliente encontrado',
        result: owner
    }
})

ipcMain.handle('client:search', async (_, query: string) => {
    const repo = getRepositories().clientRepository
    const sanitized = query.replace(/[\\%_]/g, '\\$&')
    const result = await repo.createQueryBuilder('client')
        .where('client.fullname LIKE :q ESCAPE :esc', { q: `%${sanitized}%`, esc: '\\' })
        .leftJoinAndSelect('client.cars', 'cars')
        .take(10)
        .getMany()

    return {
        status: 'success',
        message: 'Lo encontré',
        result
    }
})

ipcMain.handle('client:toggle-active', async(_, id: string) => {
    const repo = getRepositories().clientRepository
    const client = await repo.findOne({where: {id}, relations: ['cars']})
    if(!client){
        return {
            status: 'failed',
            message: 'Cliente no encontrado'
        }
    }
    client.isActive = !client.isActive
    await repo.save(client)
    return {
        status: 'success',
        message: `Cliente ${client.isActive ? 'activado' : 'desactivado'} correctamente`,
        result: client
    }
})

ipcMain.handle('client:delete', async(_, id: string) => {
    const qr = AppDataSource.createQueryRunner()
    await qr.connect()
    await qr.startTransaction()
    try {
        const client = await qr.manager.findOne(Client, { where: { id }, relations: ['cars'] })
        if (!client) {
            await qr.rollbackTransaction()
            return { status: 'failed', message: 'Cliente no encontrado' }
        }
        if (client.cars && client.cars.length > 0) {
            for (const car of client.cars) {
                await qr.manager.remove(Car, car)
            }
        }
        await qr.manager.remove(Client, client)
        await qr.commitTransaction()
        return { status: 'success', message: 'Cliente eliminado correctamente' }
    } catch (error) {
        await qr.rollbackTransaction()
        log.error('client:delete — error en transacción:', error)
        return { status: 'failed', message: 'Error al eliminar el cliente' }
    } finally {
        await qr.release()
    }
})

ipcMain.handle('client:update', async (_, updateClientDto: Partial<CreateClientDto>) => {
    const repo = getRepositories().clientRepository
    const {
        address,
        city,
        email,
        fullname,
        phone
    } = updateClientDto

    const updateClient = await repo.findOne({
        where: {
            fullname
        }
    })
    if(!updateClient){
        return {
            status: 'failed',
            message: 'El cliente que intenta modificar no se encuentra registrado'
        }
    }
    if(address !== undefined) updateClient.address = address
    if(city !== undefined) updateClient.city = city
    if(email !== undefined) updateClient.email = email
    if(phone !== undefined) updateClient.phone = phone

    const saved = await repo.save(updateClient)
    const withCars = await repo.findOne({
        where: {
            id: saved.id
        },
        relations: ['cars']
    })
    return {
        status: 'success',
        message: 'Cliente actualizado correctamente',
        result: withCars
    }
})