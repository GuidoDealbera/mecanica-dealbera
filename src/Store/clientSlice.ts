import { createSlice } from "@reduxjs/toolkit";
import { ClientState } from "../Types/types";
import {
  fetchClientByName,
  fetchClients,
  updateClient,
} from "./clientAsync.methods";

const emptyList = (): ClientState["list"] => ({
  items: [],
  total: 0,
  page: 1,
  pageSize: 8,
});

const initialState: ClientState = {
  list: emptyList(),
  listLoaded: false,
  client: undefined,
  clientLoaded: false,
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
    cleanOwnerState: (state) => {
      state.client = undefined;
      state.clientLoaded = false;
    },
    cleanOwners: (state) => {
      state.list = emptyList();
      state.listLoaded = false;
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
      // `listLoaded` pasa a `true` tanto al resolver como al fallar: en ambos
      // casos la carga terminó y la tabla debe dejar de mostrar el spinner.
      .addCase(fetchClients.rejected, (state, action) => {
        state.loadingStates.fetching_all = false;
        state.listLoaded = true;
        state.error = action.payload ?? null;
      })
      .addCase(fetchClients.fulfilled, (state, action) => {
        state.loadingStates.fetching_all = false;
        state.listLoaded = true;
        state.list = action.payload;
      })
      .addCase(fetchClientByName.pending, (state) => {
        state.loadingStates.fetching = true;
        state.error = null;
      })
      .addCase(fetchClientByName.rejected, (state, action) => {
        state.loadingStates.fetching = false;
        state.clientLoaded = true;
        state.error = action.payload ?? null;
      })
      .addCase(fetchClientByName.fulfilled, (state, action) => {
        state.loadingStates.fetching = false;
        state.clientLoaded = true;
        state.client = action.payload?.result;
      })
      .addCase(updateClient.pending, (state) => {
        state.loadingStates.updating = true;
        state.error = null;
      })
      .addCase(updateClient.rejected, (state, action) => {
        state.loadingStates.updating = false;
        state.error = action.payload ?? null;
      })
      .addCase(updateClient.fulfilled, (state, action) => {
        state.loadingStates.updating = false;
        state.client = action.payload?.result;
      });
  },
});

export const { cleanOwnerState, cleanOwners, cleanError } = clientSlice.actions;
export default clientSlice.reducer;
