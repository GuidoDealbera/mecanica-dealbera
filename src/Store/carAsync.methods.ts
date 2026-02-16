import { createAsyncThunk } from "@reduxjs/toolkit";
import { carService } from "../Services/car.service";
import { APIResponse, CreateCarBody, CreateCarJob, UpdateJobBody } from "../Types/apiTypes";
import { Cars } from "../Types/types";
import { formatDate } from "../Utils/utils";

export const fetchCars = createAsyncThunk(
  "cars/fetchCars",
  async (_, { rejectWithValue }) => {
    try {
      const response = await carService.getAll();
      const result: Cars[] = response.map((car) => ({
        ...car,
        createdAt: formatDate(car.createdAt),
        updatedAt: formatDate(car.updatedAt),
      }));

      return result;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const fetchCarByLicence = createAsyncThunk(
  "cars/fetchCarByLicence",
  async (licence: string, { rejectWithValue }) => {
    try {
      const response = await carService.getByLicence(licence);
      const result: Cars = {
        ...response.result,
        createdAt: formatDate(response.result.createdAt),
        updatedAt: formatDate(response.result.updatedAt),
      };
      return result;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const createCar = createAsyncThunk(
  "cars/createCar",
  async (body: CreateCarBody, { rejectWithValue }) => {
    try {
      return await carService.create(body);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const addJob = createAsyncThunk(
  'cars/addJob',
  async ({licence, job}: {licence: string, job: CreateCarJob}, {rejectWithValue}) => {
    try {
      return await carService.addJob(licence, job)
    } catch (error) {
      return rejectWithValue(error)
    }
  }
)

export const updatedCar = createAsyncThunk(
  "cars/updateCar",
  async (
    { carId, kilometers }: { carId: string; kilometers: number },
    { rejectWithValue }
  ) => {
    try {
      const response = await carService.updateCar(carId, kilometers);
      if(response.result){
        const result: Cars = {
          ...response.result,
          createdAt: formatDate(response.result.createdAt),
          updatedAt: formatDate(response.result.updatedAt),
        };
        return {
          message: response.message,
          status: response.status,
          result
        } as APIResponse
      } else {
        return response
      }
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const deleteCar = createAsyncThunk(
  "cars/deleteCar",
  async (licence: string, { rejectWithValue }) => {
    try {
      return await carService.delete(licence);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const updateJobInCar = createAsyncThunk(
  "cars/updateJobInCar",
  async (
    {
      licence,
      jobId,
      body,
    }: { licence: string; jobId: string; body: UpdateJobBody },
    { rejectWithValue }
  ) => {
    try {
      return await carService.updateJob(licence, jobId, body);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);
