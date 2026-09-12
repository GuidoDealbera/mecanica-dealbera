import { createAsyncThunk } from "@reduxjs/toolkit";
import { clientService } from "../Services/client.service";
import {
  APIResponse,
  AppError,
  ClientQueryParams,
  Paginated,
  UpdateClientBody,
} from "../Types/apiTypes";
import { Clients } from "../Types/types";

const toAppError = (error: unknown): AppError => ({
  message: error instanceof Error ? error.message : "Error desconocido",
});

// Los thunks guardan los datos crudos (fechas Date). El formateo a texto se
// hace en la capa de presentación (componentes) con formatDate().
// `fetchClients` recibe los parámetros de paginación/orden/búsqueda y devuelve
// una página de resultados (`Paginated<Clients>`), no el dataset completo.
export const fetchClients = createAsyncThunk<
  Paginated<Clients>,
  ClientQueryParams,
  { rejectValue: AppError }
>("clients/fetchClients", async (params, { rejectWithValue }) => {
  try {
    return await clientService.getAll(params);
  } catch (error) {
    return rejectWithValue(toAppError(error));
  }
});

export const fetchClientById = createAsyncThunk<
  APIResponse<Clients>,
  string,
  { rejectValue: AppError }
>("clients/fetchClientById", async (id, { rejectWithValue }) => {
  try {
    return await clientService.getOne(id);
  } catch (error) {
    return rejectWithValue(toAppError(error));
  }
});

export const updateClient = createAsyncThunk<
  APIResponse<Clients>,
  UpdateClientBody,
  { rejectValue: AppError }
>("clients/updateClient", async (body, { rejectWithValue }) => {
  try {
    return await clientService.update(body);
  } catch (error) {
    return rejectWithValue(toAppError(error));
  }
});
