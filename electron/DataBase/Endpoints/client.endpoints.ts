import { ipcMain } from "electron";
import { CreateClientDto } from "../Types/client.dto";
import { getRepositories } from "../dataSource";

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

    await repo.save(updateClient)
    return {
        status: 'success',
        message: 'Cliente actualizado correctamente'
    }
})