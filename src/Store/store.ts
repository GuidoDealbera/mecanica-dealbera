import { configureStore } from "@reduxjs/toolkit";
import CarsReducer from './carSlice';
import ClientsReducer from './clientSlice'

export const store = configureStore({
    reducer: {
        cars: CarsReducer,
        clients: ClientsReducer,
    },
    devTools: !import.meta.env.PROD
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch