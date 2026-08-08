import { createAsyncThunk } from "@reduxjs/toolkit";
import { carService } from "../Services/car.service";
import {
  APIResponse,
  AppError,
  CarQueryParams,
  CreateCarBody,
  CreateCarJob,
  Paginated,
  UpdateJobBody,
} from "../Types/apiTypes";
import { Cars, Jobs } from "../Types/types";

const toAppError = (error: unknown): AppError => ({
  message: error instanceof Error ? error.message : "Error desconocido",
});

// Los thunks guardan los datos crudos (fechas Date). El formateo a texto se
// hace en la capa de presentación (componentes) con formatDate().
// `fetchCars` recibe los parámetros de paginación/orden/búsqueda y devuelve una
// página de resultados (`Paginated<Cars>`), no el dataset completo.
export const fetchCars = createAsyncThunk<
  Paginated<Cars>,
  CarQueryParams,
  { rejectValue: AppError }
>("cars/fetchCars", async (params, { rejectWithValue }) => {
  try {
    return await carService.getAll(params);
  } catch (error) {
    return rejectWithValue(toAppError(error));
  }
});

export const fetchCarByLicence = createAsyncThunk<
  Cars,
  string,
  { rejectValue: AppError }
>("cars/fetchCarByLicence", async (licence, { rejectWithValue }) => {
  try {
    const response = await carService.getByLicence(licence);
    if (response.status !== "success" || !response.result) {
      return rejectWithValue({
        message: response.message ?? "Vehículo no encontrado",
      });
    }
    return response.result;
  } catch (error) {
    return rejectWithValue(toAppError(error));
  }
});

export const createCar = createAsyncThunk<
  APIResponse,
  CreateCarBody,
  { rejectValue: AppError }
>("cars/createCar", async (body, { rejectWithValue }) => {
  try {
    return await carService.create(body);
  } catch (error) {
    return rejectWithValue(toAppError(error));
  }
});

export const addJob = createAsyncThunk<
  APIResponse<Jobs>,
  { licence: string; job: CreateCarJob },
  { rejectValue: AppError }
>("cars/addJob", async ({ licence, job }, { rejectWithValue }) => {
  try {
    return await carService.addJob(licence, job);
  } catch (error) {
    return rejectWithValue(toAppError(error));
  }
});

export const updatedCar = createAsyncThunk<
  APIResponse<Cars>,
  { carId: string; kilometers: number },
  { rejectValue: AppError }
>("cars/updateCar", async ({ carId, kilometers }, { rejectWithValue }) => {
  try {
    return await carService.updateCar(carId, kilometers);
  } catch (error) {
    return rejectWithValue(toAppError(error));
  }
});

export const deleteCar = createAsyncThunk<
  APIResponse,
  string,
  { rejectValue: AppError }
>("cars/deleteCar", async (licence, { rejectWithValue }) => {
  try {
    return await carService.delete(licence);
  } catch (error) {
    return rejectWithValue(toAppError(error));
  }
});

export const updateJobInCar = createAsyncThunk<
  APIResponse<Jobs>,
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
  }
);
