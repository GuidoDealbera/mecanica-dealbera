import {
  APIResponse,
  ClientQueryParams,
  Paginated,
  UpdateClientBody,
} from "../Types/apiTypes";
import { Client } from "../Types/types";

export const clientService = {
  getAll: async (params: ClientQueryParams): Promise<Paginated<Client>> => {
    return await window.api.clients.getAll(params);
  },
  getOne: async (fullname: string): Promise<APIResponse<Client>> => {
    return await window.api.clients.getByName(fullname);
  },
  update: async (
    updateClientDto: UpdateClientBody
  ): Promise<APIResponse<Client>> => {
    return await window.api.clients.update(updateClientDto);
  },
};
