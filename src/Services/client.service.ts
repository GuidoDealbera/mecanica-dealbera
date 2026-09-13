import {
  APIResponse,
  ClientQueryParams,
  Paginated,
  UpdateClientBody,
} from "../Types/apiTypes";
import { Client } from "../Types/types";
import { ensureSuccess } from "../Utils/apiResponse";

export const clientService = {
  getAll: async (params: ClientQueryParams): Promise<Paginated<Client>> => {
    return ensureSuccess(await window.api.clients.getAll(params));
  },
  getOne: async (id: string): Promise<APIResponse<Client>> => {
    return await window.api.clients.getById(id);
  },
  update: async (
    updateClientDto: UpdateClientBody
  ): Promise<APIResponse<Client>> => {
    return await window.api.clients.update(updateClientDto);
  },
};
