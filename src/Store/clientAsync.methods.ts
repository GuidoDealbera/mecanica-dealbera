import { createAsyncThunk } from "@reduxjs/toolkit";
import { clientService } from "../Services/client.service";
import { Cars, Clients } from "../Types/types";
import { formatDate } from "../Utils/utils";
export const fetchClients = createAsyncThunk(
  "clients/fetchClients",
  async (_, { rejectWithValue }) => {
    try {
      const response = await clientService.getAll();
      const result: Clients[] = response.map(client => {
        const cars: Cars[] | undefined = client.cars
          ? client.cars.map(car => ({
              ...car,
              createdAt: formatDate(car.createdAt),
              updatedAt: formatDate(car.updatedAt)
            }))
          : undefined;
        return {
          ...client,
          cars
        };
      });
      return result
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const fetchClientByName = createAsyncThunk(
  "clients/fetchClientByName",
  async (fullname: string, { rejectWithValue }) => {
    try {
      return await clientService.getOne(fullname);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const updateClient = createAsyncThunk(
  "clients/updateClient",
  async (body: any, { rejectWithValue }) => {
    try {
      return await clientService.update(body);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);
