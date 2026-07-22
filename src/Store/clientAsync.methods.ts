import { createAsyncThunk } from "@reduxjs/toolkit";
import { clientService } from "../Services/client.service";
import { APIResponse, AppError, UpdateClientBody } from "../Types/apiTypes";
import { Clients } from "../Types/types";

const toAppError = (error: unknown): AppError => ({
  message: error instanceof Error ? error.message : "Error desconocido",
});

// Los thunks guardan los datos crudos (fechas Date). El formateo a texto se
// hace en la capa de presentación (componentes) con formatDate().
export const fetchClients = createAsyncThunk<Clients[], void, { rejectValue: AppError }>(
  "clients/fetchClients",
  async (_, { rejectWithValue }) => {
    try {
      return await clientService.getAll();
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);

export const fetchClientByName = createAsyncThunk<
  APIResponse<Clients>,
  string,
  { rejectValue: AppError }
>(
  "clients/fetchClientByName",
  async (fullname, { rejectWithValue }) => {
    try {
      return await clientService.getOne(fullname);
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);

export const updateClient = createAsyncThunk<
  APIResponse<Clients>,
  UpdateClientBody,
  { rejectValue: AppError }
>(
  "clients/updateClient",
  async (body, { rejectWithValue }) => {
    try {
      return await clientService.update(body);
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);
