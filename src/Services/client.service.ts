import { APIResponse, UpdateClientBody } from "../Types/apiTypes";
import { Client } from "../Types/types";

export const clientService = {
  getAll: async (): Promise<Client[]> => {
    return await window.api.clients.getAll()
  },
  getOne: async (fullname:string): Promise<APIResponse<Client>> => {
    return await window.api.clients.getByName(fullname)
  },
  update: async (updateClientDto: UpdateClientBody): Promise<APIResponse<Client>> => {
    return await window.api.clients.update(updateClientDto)
  }
};
