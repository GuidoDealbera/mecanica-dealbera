import {
  APIResponse,
  CarQueryParams,
  CreateCarBody,
  CreateCarJob,
  Paginated,
  UpdateJobBody,
} from "../Types/apiTypes";
import { Car, Jobs } from "../Types/types";

export const carService = {
  create: async (carBody: CreateCarBody): Promise<APIResponse> => {
    return await window.api.cars.create(carBody);
  },
  getAll: async (params: CarQueryParams): Promise<Paginated<Car>> => {
    return await window.api.cars.getAll(params);
  },
  getByLicence: async (licence: string): Promise<APIResponse<Car>> => {
    return await window.api.cars.getByLicense(licence);
  },
  updateCar: async (
    carId: string,
    kilometers: number,
  ): Promise<APIResponse<Car>> => {
    return await window.api.cars.update(carId, kilometers);
  },
  delete: async (licence: string): Promise<APIResponse> => {
    return await window.api.cars.delete(licence);
  },
  updateJob: async (
    licence: string,
    jobId: string,
    body: UpdateJobBody,
  ): Promise<APIResponse<Jobs>> => {
    return await window.api.cars.updateJob(licence, jobId, body);
  },
  addJob: async (licence: string, job: CreateCarJob): Promise<APIResponse<Jobs>> => {
    return await window.api.cars.addJob(licence, job);
  },
};
