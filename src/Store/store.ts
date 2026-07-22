import { configureStore } from "@reduxjs/toolkit";
import CarsReducer from './carSlice';
import ClientsReducer from './clientSlice'

// El backend entrega las fechas como objetos `Date` (vía IPC). Se guardan
// crudas en el store y el formateo se hace en la capa de presentación. Se le
// indica al serializableCheck que los `Date` son válidos, sin desactivar el
// chequeo para otros valores realmente no serializables (funciones, symbols,
// instancias de clase, Map/Set, etc.).
const isSerializable = (value: unknown): boolean => {
    if (value == null || value instanceof Date) return true;
    const type = typeof value;
    return (
        type === "string" ||
        type === "boolean" ||
        type === "number" ||
        Array.isArray(value) ||
        (type === "object" && Object.getPrototypeOf(value) === Object.prototype)
    );
};

export const store = configureStore({
    reducer: {
        cars: CarsReducer,
        clients: ClientsReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({ serializableCheck: { isSerializable } }),
    devTools: !import.meta.env.PROD
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch