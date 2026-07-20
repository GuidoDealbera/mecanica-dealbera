import { handleIpc } from "../../ipc";
import { logError } from "../../logger";
import { validateDto } from "../../validation";
import { Not } from "typeorm";
import { CreateClientDto, UpdateClientDto } from "../Types/client.dto";
import { AppDataSource, getRepositories } from "../dataSource";
import { Car } from "../Entities/car.entity";
import { Client } from "../Entities/client.entity";
import { invalidateDashboardStatsCache } from "../dashboardCache";

handleIpc('client:create', async (_, payload: CreateClientDto) => {
    const validation = await validateDto(CreateClientDto, payload)
    if(!validation.ok){
        return { status: 'failed', message: validation.message }
    }
    const createClientDto = validation.dto

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
    invalidateDashboardStatsCache()
    return {
        status: 'success',
        message: 'Cliente registrado correctamente'
    }
})

handleIpc('client:get-all', async () => {
    const repo = getRepositories().clientRepository
    return await repo.find({
        relations: ['cars']
    })
})

handleIpc('client:find-by-name', async (_, fullname: CreateClientDto['fullname']) => {
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

handleIpc('client:search', async (_, query: string) => {
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

handleIpc('client:toggle-active', async(_, id: string) => {
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
    invalidateDashboardStatsCache()
    return {
        status: 'success',
        message: `Cliente ${client.isActive ? 'activado' : 'desactivado'} correctamente`,
        result: client
    }
})

handleIpc('client:delete', async(_, id: string) => {
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
        invalidateDashboardStatsCache()
        return { status: 'success', message: 'Cliente eliminado correctamente' }
    } catch (error) {
        await qr.rollbackTransaction()
        logError("client:delete", error)
        return { status: 'failed', message: 'Error al eliminar el cliente' }
    } finally {
        await qr.release()
    }
})

handleIpc('client:update', async (_, payload: UpdateClientDto) => {
    const validation = await validateDto(UpdateClientDto, payload)
    if(!validation.ok){
        return { status: 'failed', message: validation.message }
    }
    const {
        id,
        address,
        city,
        email,
        fullname,
        phone
    } = validation.dto

    const repo = getRepositories().clientRepository

    const updateClient = await repo.findOne({
        where: {
            id
        }
    })
    if(!updateClient){
        return {
            status: 'failed',
            message: 'El cliente que intenta modificar no se encuentra registrado'
        }
    }
    // Si se cambia el nombre, verificar que no lo tenga otro cliente
    if(fullname !== undefined && fullname !== updateClient.fullname){
        const nameTaken = await repo.findOne({
            where: { fullname, id: Not(id) }
        })
        if(nameTaken){
            return {
                status: 'failed',
                message: `Ya existe otro cliente llamado "${fullname}"`
            }
        }
        updateClient.fullname = fullname
    }
    if(address !== undefined) updateClient.address = address
    if(city !== undefined) updateClient.city = city
    if(email !== undefined) updateClient.email = email
    if(phone !== undefined) updateClient.phone = phone

    const saved = await repo.save(updateClient)
    invalidateDashboardStatsCache()
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