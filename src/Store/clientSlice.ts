import { createSlice } from "@reduxjs/toolkit";
import { ClientState } from "../Types/types";
import {
  fetchClientByName,
  fetchClients,
  updateClient,
} from "./clientAsync.methods";

const initialState: ClientState = {
  allClients: [],
  client: undefined,
  loadingStates: {
    fetching_all: false,
    creating: false,
    deleting: false,
    fetching: false,
    updating: false,
  },
  error: null,
};

const clientSlice = createSlice({
  name: "client",
  initialState,
  reducers: {
    cleanOnwerState: (state) => {
      state.client = undefined;
    },
    cleanOwners: (state) => {
      state.allClients = [];
    },
    cleanError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchClients.pending, (state) => {
        state.loadingStates.fetching_all = true;
        state.error = null;
      })
      .addCase(fetchClients.rejected, (state, action) => {
        state.loadingStates.fetching_all = false;
        state.error = action.payload as Error;
      })
      .addCase(fetchClients.fulfilled, (state, action) => {
        state.loadingStates.fetching_all = false;
        state.allClients = action.payload;
      })
      .addCase(fetchClientByName.pending, (state) => {
        state.loadingStates.fetching = true;
        state.error = null;
      })
      .addCase(fetchClientByName.rejected, (state, action) => {
        state.loadingStates.fetching = false;
        state.error = action.payload as Error;
      })
      .addCase(fetchClientByName.fulfilled, (state, action) => {
        state.loadingStates.fetching = false;
        state.client = action.payload?.result;
      })
      .addCase(updateClient.pending, (state) => {
        state.loadingStates.updating = true;
        state.error = null;
      })
      .addCase(updateClient.rejected, (state, action) => {
        state.loadingStates.updating = false;
        state.error = action.payload as Error;
      })
      .addCase(updateClient.fulfilled, (state, action) => {
        state.loadingStates.updating = false;
        state.client = action.payload?.result;
      });
  },
});

export const { cleanOnwerState, cleanOwners, cleanError } = clientSlice.actions;
export default clientSlice.reducer;
