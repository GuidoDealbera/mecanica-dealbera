import {
  APIResponse,
  CreateCarBody,
  CreateCarJob,
  UpdateJobBody,
} from "../Types/apiTypes";
import { Car } from "../Types/types";

export const carService = {
  create: async (carBody: CreateCarBody): Promise<APIResponse> => {
    return await window.api.cars.create(carBody);
  },
  getAll: async (): Promise<Car[]> => {
    return await window.api.cars.getAll();
  },
  getByLicence: async (licence: string): Promise<APIResponse> => {
    return await window.api.cars.getByLicense(licence);
  },
  updateCar: async (
    carId: string,
    kilometers: number,
  ): Promise<APIResponse> => {
    return await window.api.cars.update(carId, kilometers);
  },
  delete: async (licence: string): Promise<APIResponse> => {
    return await window.api.cars.delete(licence);
  },
  updateJob: async (
    licence: string,
    jobId: string,
    body: UpdateJobBody,
  ): Promise<APIResponse> => {
    return await window.api.cars.updateJob(licence, jobId, body);
  },
  addJob: async (licence: string, job: CreateCarJob): Promise<APIResponse> => {
    return await window.api.cars.addJob(licence, job);
  },
};
