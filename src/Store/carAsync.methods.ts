import { createAsyncThunk } from "@reduxjs/toolkit";
import { carService } from "../Services/car.service";
import { APIResponse, AppError, CreateCarBody, CreateCarJob, UpdateJobBody } from "../Types/apiTypes";
import { Cars } from "../Types/types";
import { formatDate } from "../Utils/utils";

const toAppError = (error: unknown): AppError => ({
  message: error instanceof Error ? error.message : "Error desconocido",
});

export const fetchCars = createAsyncThunk<Cars[], void, { rejectValue: AppError }>(
  "cars/fetchCars",
  async (_, { rejectWithValue }) => {
    try {
      const response = await carService.getAll();
      return response.map((car) => ({
        ...car,
        createdAt: formatDate(car.createdAt),
        updatedAt: formatDate(car.updatedAt),
      }));
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);

export const fetchCarByLicence = createAsyncThunk<Cars, string, { rejectValue: AppError }>(
  "cars/fetchCarByLicence",
  async (licence, { rejectWithValue }) => {
    try {
      const response = await carService.getByLicence(licence);
      if (!response.result) {
        return rejectWithValue({ message: response.message ?? "Vehículo no encontrado" });
      }
      return {
        ...response.result,
        createdAt: formatDate(response.result.createdAt),
        updatedAt: formatDate(response.result.updatedAt),
      };
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);

export const createCar = createAsyncThunk<APIResponse, CreateCarBody, { rejectValue: AppError }>(
  "cars/createCar",
  async (body, { rejectWithValue }) => {
    try {
      return await carService.create(body);
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);

export const addJob = createAsyncThunk<
  APIResponse,
  { licence: string; job: CreateCarJob },
  { rejectValue: AppError }
>(
  "cars/addJob",
  async ({ licence, job }, { rejectWithValue }) => {
    try {
      return await carService.addJob(licence, job);
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);

export const updatedCar = createAsyncThunk<APIResponse, { carId: string; kilometers: number }, { rejectValue: AppError }>(
  "cars/updateCar",
  async ({ carId, kilometers }, { rejectWithValue }) => {
    try {
      const response = await carService.updateCar(carId, kilometers);
      if (response.result) {
        return {
          message: response.message,
          status: response.status,
          result: {
            ...response.result,
            createdAt: formatDate(response.result.createdAt),
            updatedAt: formatDate(response.result.updatedAt),
          },
        } as APIResponse;
      }
      return response;
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);

export const deleteCar = createAsyncThunk<APIResponse, string, { rejectValue: AppError }>(
  "cars/deleteCar",
  async (licence, { rejectWithValue }) => {
    try {
      return await carService.delete(licence);
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);

export const updateJobInCar = createAsyncThunk<
  APIResponse,
  { licence: string; jobId: string; body: UpdateJobBody },
  { rejectValue: AppError }
>(
  "cars/updateJobInCar",
  async ({ licence, jobId, body }, { rejectWithValue }) => {
    try {
      return await carService.updateJob(licence, jobId, body);
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);
