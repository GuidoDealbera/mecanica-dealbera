import { createAsyncThunk } from "@reduxjs/toolkit";
import { clientService } from "../Services/client.service";
import { APIResponse, AppError, UpdateClientBody } from "../Types/apiTypes";
import { Cars, Client, Clients } from "../Types/types";
import { formatDate } from "../Utils/utils";

const toAppError = (error: unknown): AppError => ({
  message: error instanceof Error ? error.message : "Error desconocido",
});

// Formatea las fechas de los autos del cliente (Date -> string) para que
// coincidan con el tipo `Clients` que maneja el store. Se comparte entre el
// listado y el detalle para mantener el mismo formato en todos lados.
const formatClient = (client: Client): Clients => {
  const cars: Cars[] | undefined = client.cars?.map((car) => ({
    ...car,
    createdAt: formatDate(car.createdAt),
    updatedAt: formatDate(car.updatedAt),
  }));
  return { ...client, cars };
};

export const fetchClients = createAsyncThunk<Clients[], void, { rejectValue: AppError }>(
  "clients/fetchClients",
  async (_, { rejectWithValue }) => {
    try {
      const response = await clientService.getAll();
      return response.map(formatClient);
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
      const response = await clientService.getOne(fullname);
      if (response.status === "success" && response.result) {
        return {
          status: "success",
          message: response.message,
          result: formatClient(response.result),
        };
      }
      return { status: response.status, message: response.message } as APIResponse<Clients>;
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
      const response = await clientService.update(body);
      if (response.status === "success" && response.result) {
        return {
          status: "success",
          message: response.message,
          result: formatClient(response.result),
        };
      }
      return { status: response.status, message: response.message } as APIResponse<Clients>;
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);
