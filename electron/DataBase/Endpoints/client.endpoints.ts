import { ipcMain } from "electron";
import { CreateClientDto } from "../Types/client.dto";
import { getRepositories } from "../dataSource";
import { Like } from "typeorm";

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
    const result = await repo.find({
        where: [
            {fullname: Like(`%${query}%`)}
        ],
        relations: ['cars'],
        take: 10
    })

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
    const {carRepository: carRepo, clientRepository: clientRepo} = getRepositories()
    const client = await clientRepo.findOne({where: {id}, relations: ['cars']})
    if(!client){
        return {
            status: 'failed',
            message: 'Cliente no encontrado'
        }
    }
    if(client.cars && client.cars.length > 0){
        for (const car of client.cars){
            await carRepo.remove(car)
        }
    }

    await clientRepo.remove(client)
    return {
        status: 'success',
        message: 'Cliente eliminado correctamente'
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
    if(address) updateClient.address = address
    if(city) updateClient.city = city
    if(email) updateClient.email = email
    if(phone) updateClient.phone = phone

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