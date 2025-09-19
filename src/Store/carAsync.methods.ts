import { createAsyncThunk } from "@reduxjs/toolkit";
import { carService } from "../Services/car.service";
import { APIResponse, CreateCarBody, UpdateCar, UpdateJobBody } from "../Types/apiTypes";
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

// export const createJob = createAsyncThunk(
//   "cars/createJob",
//   async (
//     { id, data }: { id: string; data: CreateCarJob },
//     { rejectWithValue }
//   ) => {
//     try {
//       return await carService.createJob(id, data);
//     } catch (error) {
//       return rejectWithValue(error);
//     }
//   }
// );

export const updatedCar = createAsyncThunk(
  "cars/updateCar",
  async (
    { carId, data }: { carId: string; data: UpdateCar },
    { rejectWithValue }
  ) => {
    try {
      const response = await carService.updateCar(carId, data);
      console.log(response)
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
