import {
  APIResponse,
  CarQueryParams,
  CreateCarBody,
  CreateCarJob,
  Paginated,
  UpdateJobBody,
  UpdateCarBody,
} from "../Types/apiTypes";
import { Car, Jobs } from "../Types/types";
import { ensureSuccess } from "../Utils/apiResponse";

export const carService = {
  create: async (carBody: CreateCarBody): Promise<APIResponse> => {
    return await window.api.cars.create(carBody);
  },
  getAll: async (params: CarQueryParams): Promise<Paginated<Car>> => {
    // `ensureSuccess` acá y no en cada pantalla: el thunk ya convierte lo que
    // se lance en un `rejectWithValue` con el motivo del backend.
    return ensureSuccess(await window.api.cars.getAll(params));
  },
  getByLicence: async (licence: string): Promise<APIResponse<Car>> => {
    return await window.api.cars.getByLicense(licence);
  },
  updateCar: async (
    carId: string,
    cambios: UpdateCarBody
  ): Promise<APIResponse<Car>> => {
    return await window.api.cars.update(carId, cambios);
  },
  delete: async (licence: string): Promise<APIResponse> => {
    return await window.api.cars.delete(licence);
  },
  updateJob: async (
    licence: string,
    jobId: string,
    body: UpdateJobBody
  ): Promise<APIResponse<Jobs>> => {
    return await window.api.cars.updateJob(licence, jobId, body);
  },
  addJob: async (
    licence: string,
    job: CreateCarJob
  ): Promise<APIResponse<Jobs>> => {
    return await window.api.cars.addJob(licence, job);
  },
};
