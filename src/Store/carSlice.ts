import { createSlice } from "@reduxjs/toolkit";
import { CarState } from "../Types/types";
import {
  fetchCars,
  fetchCarByLicence,
  updateJobInCar,
  updatedCar,
} from "./carAsync.methods";

const initialState: CarState = {
  allCars: [],
  car: undefined,
  loadingStates: {
    fetching_all: false,
    fetching: false,
    creating: false,
    updating: false,
    deleting: false,
  },
  error: null,
};

const carSlice = createSlice({
  name: "cars",
  initialState,
  reducers: {
    cleanCarsState: (state) => {
      state.allCars = [];
    },
    cleanCarState: (state) => {
      state.car = undefined;
    },
    cleanError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      //GET's
      .addCase(fetchCars.pending, (state) => {
        state.loadingStates.fetching_all = true;
        state.error = null;
      })
      .addCase(fetchCars.rejected, (state, action) => {
        state.loadingStates.fetching_all = false;
        state.error = action.payload as Error;
      })
      .addCase(fetchCars.fulfilled, (state, action) => {
        state.loadingStates.fetching_all = false;
        state.allCars = action.payload;
      })
      .addCase(fetchCarByLicence.pending, (state) => {
        state.loadingStates.fetching = true;
        state.error = null;
      })
      .addCase(fetchCarByLicence.rejected, (state, action) => {
        state.loadingStates.fetching = false;
        state.error = action.payload as Error;
      })
      .addCase(fetchCarByLicence.fulfilled, (state, action) => {
        state.loadingStates.fetching = false;
        state.car = action.payload;
      })
      //PATCH's
      .addCase(updatedCar.pending, (state) => {
        state.loadingStates.updating = true;
        state.error = null;
      })
      .addCase(updatedCar.rejected, (state, action) => {
        state.loadingStates.updating = false;
        state.error = action.payload as Error;
      })
      .addCase(updatedCar.fulfilled, (state, action) => {
        state.loadingStates.updating = false;
        state.car = action.payload.result
      })
      .addCase(updateJobInCar.pending, (state) => {
        state.loadingStates.updating = true;
        state.error = null;
      })
      .addCase(updateJobInCar.rejected, (state, action) => {
        state.loadingStates.updating = false;
        state.error = action.payload as Error;
      })
      .addCase(updateJobInCar.fulfilled, (state, action) => {
        state.loadingStates.updating = false;
        if (state.car) {
          const jobIndex = state.car.jobs.findIndex(
            (job) => job.id === action.payload.result.id
          );
          state.car.jobs[jobIndex] = action.payload.result;
        }
      });
  },
});

export const { cleanCarState, cleanCarsState, cleanError } = carSlice.actions;
export default carSlice.reducer;
