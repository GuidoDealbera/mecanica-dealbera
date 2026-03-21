import { APIResponse } from "../Types/apiTypes";
import { Client } from "../Types/types";

export const clientService = {
  getAll: async (): Promise<Client[]> => {
    return await window.api.clients.getAll()
  },
  getOne: async (fullname:string): Promise<APIResponse> => {
    return await window.api.clients.getByName(fullname)
  },
  update: async (updateClientDto: Partial<Client>): Promise<APIResponse> => {
    return await window.api.clients.update(updateClientDto)
  }
};
