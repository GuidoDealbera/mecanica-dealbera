import { createAsyncThunk } from "@reduxjs/toolkit";
import { clientService } from "../Services/client.service";
import { AppError } from "../Types/apiTypes";
import { Cars, Client, Clients } from "../Types/types";
import { formatDate } from "../Utils/utils";

const toAppError = (error: unknown): AppError => ({
  message: error instanceof Error ? error.message : "Error desconocido",
});

export const fetchClients = createAsyncThunk<Clients[], void, { rejectValue: AppError }>(
  "clients/fetchClients",
  async (_, { rejectWithValue }) => {
    try {
      const response = await clientService.getAll();
      return response.map((client) => {
        const cars: Cars[] | undefined = client.cars
          ? client.cars.map((car) => ({
              ...car,
              createdAt: formatDate(car.createdAt),
              updatedAt: formatDate(car.updatedAt),
            }))
          : undefined;
        return { ...client, cars };
      });
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);

export const fetchClientByName = createAsyncThunk<
  Awaited<ReturnType<typeof clientService.getOne>>,
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
  Awaited<ReturnType<typeof clientService.update>>,
  Partial<Client>,
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
