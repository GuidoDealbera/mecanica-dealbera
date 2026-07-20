import { createSlice } from "@reduxjs/toolkit";
import { CarState } from "../Types/types";
import {
  fetchCars,
  fetchCarByLicence,
  updateJobInCar,
  updatedCar,
  addJob,
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
        state.error = action.payload ?? null;
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
        state.error = action.payload ?? null;
      })
      .addCase(fetchCarByLicence.fulfilled, (state, action) => {
        state.loadingStates.fetching = false;
        state.car = action.payload;
      })
      //POST's
      .addCase(addJob.pending, state => {
        state.loadingStates.creating = true
        state.error = null
      })
      .addCase(addJob.rejected, (state, action) => {
        state.loadingStates.creating = false
        state.error = action.payload ?? null
      })
      .addCase(addJob.fulfilled, (state, action) => {
        state.loadingStates.creating = false
        const newJob = action.payload.result
        if(state.car && newJob){
          state.car.jobs = [...(state.car.jobs || []), newJob]
        }
      })
      //PATCH's
      .addCase(updatedCar.pending, (state) => {
        state.loadingStates.updating = true;
        state.error = null;
      })
      .addCase(updatedCar.rejected, (state, action) => {
        state.loadingStates.updating = false;
        state.error = action.payload ?? null;
      })
      .addCase(updatedCar.fulfilled, (state, action) => {
        state.loadingStates.updating = false;
        if(action.payload.result){
          state.car = action.payload.result
        }
      })
      .addCase(updateJobInCar.pending, (state) => {
        state.loadingStates.updating = true;
        state.error = null;
      })
      .addCase(updateJobInCar.rejected, (state, action) => {
        state.loadingStates.updating = false;
        state.error = action.payload ?? null;
      })
      .addCase(updateJobInCar.fulfilled, (state, action) => {
        state.loadingStates.updating = false;
        const updatedJob = action.payload.result;
        if (!state.car?.jobs || !updatedJob) return;
        const jobIndex = state.car.jobs.findIndex(
          (job) => job.id === updatedJob.id,
        );
        if (jobIndex === -1) return;
        state.car.jobs[jobIndex] = updatedJob;
      });
  },
});

export const { cleanCarState, cleanCarsState, cleanError } = carSlice.actions;
export default carSlice.reducer;
