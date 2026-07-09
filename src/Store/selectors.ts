import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "./store";
import { JobStatus } from "../Types/apiTypes";

// ─── Selectores base: cars ────────────────────────────────────────────────────

const selectCarsState = (state: RootState) => state.cars;

export const selectAllCars = (state: RootState) => state.cars.allCars;
export const selectCar = (state: RootState) => state.cars.car;
export const selectCarLoadingStates = (state: RootState) => state.cars.loadingStates;
export const selectCarError = (state: RootState) => state.cars.error;

// ─── Selectores base: clients ─────────────────────────────────────────────────

const selectClientsState = (state: RootState) => state.clients;

export const selectAllClients = (state: RootState) => state.clients.allClients;
export const selectClient = (state: RootState) => state.clients.client;
export const selectClientLoadingStates = (state: RootState) => state.clients.loadingStates;
export const selectClientError = (state: RootState) => state.clients.error;

// ─── Selectores derivados: cars ───────────────────────────────────────────────

/** Indica si alguna operación del slice de autos está en curso. */
export const selectIsCarBusy = createSelector(
  selectCarLoadingStates,
  (ls) => Object.values(ls).some(Boolean),
);

/** Total de trabajos pendientes o en progreso en todos los autos. */
export const selectPendingJobsCount = createSelector(selectAllCars, (cars) =>
  cars.reduce((count, car) => {
    const active = (car.jobs ?? []).filter(
      (j) => j.status === JobStatus.PENDING || j.status === JobStatus.IN_PROGRESS,
    ).length;
    return count + active;
  }, 0),
);

/** Autos filtrados por id de propietario. Recibe el id como argumento. */
export const selectCarsByOwnerId = createSelector(
  [selectAllCars, (_state: RootState, ownerId: string) => ownerId],
  (cars, ownerId) => cars.filter((car) => car.owner?.id === ownerId),
);

// ─── Selectores derivados: clients ────────────────────────────────────────────

/** Indica si alguna operación del slice de clientes está en curso. */
export const selectIsClientBusy = createSelector(
  selectClientLoadingStates,
  (ls) => Object.values(ls).some(Boolean),
);

// Suppress unused-variable warnings for base selectors used only internally
void selectCarsState;
void selectClientsState;
