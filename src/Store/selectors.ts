import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "./store";

// ─── Selectores base: cars ────────────────────────────────────────────────────

const selectCarsState = (state: RootState) => state.cars;

/** Página actual del listado de autos (items + total/page/pageSize). */
export const selectCarsList = (state: RootState) => state.cars.list;
export const selectCar = (state: RootState) => state.cars.car;
export const selectCarLoadingStates = (state: RootState) => state.cars.loadingStates;
export const selectCarError = (state: RootState) => state.cars.error;

// ─── Selectores base: clients ─────────────────────────────────────────────────

const selectClientsState = (state: RootState) => state.clients;

/** Página actual del listado de clientes (items + total/page/pageSize). */
export const selectClientsList = (state: RootState) => state.clients.list;
export const selectClient = (state: RootState) => state.clients.client;
export const selectClientLoadingStates = (state: RootState) => state.clients.loadingStates;
export const selectClientError = (state: RootState) => state.clients.error;

// ─── Selectores derivados ─────────────────────────────────────────────────────

/** Indica si alguna operación del slice de autos está en curso. */
export const selectIsCarBusy = createSelector(
  selectCarLoadingStates,
  (ls) => Object.values(ls).some(Boolean),
);

/** Indica si alguna operación del slice de clientes está en curso. */
export const selectIsClientBusy = createSelector(
  selectClientLoadingStates,
  (ls) => Object.values(ls).some(Boolean),
);

// Suppress unused-variable warnings for base selectors used only internally
void selectCarsState;
void selectClientsState;
