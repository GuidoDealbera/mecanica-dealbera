import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { createCar, fetchCarByLicence, fetchCars } from "./carAsync.methods";
import carReducer from "./carSlice";

/**
 * El contrato de los thunks, que `CLAUDE.md` documenta como algo **ya pagado** y
 * que no tenía ninguna prueba.
 *
 * La regla es que un thunk **resuelve** aunque el backend conteste
 * `status: "failed"`: sólo rechaza si la llamada IPC en sí falla. Suena a
 * detalle y no lo es: una pantalla que sólo mira si la promesa resolvió muestra
 * "guardado con éxito" sin haber guardado nada. Ya pasó una vez.
 *
 * Lo que se fija acá es esa diferencia —resolver con un fallo de negocio contra
 * rechazar por un fallo de transporte— y que el estado del store quede como
 * corresponde en cada caso.
 */

vi.mock("../Services/car.service", () => ({
  carService: {
    getAll: vi.fn(),
    getByLicence: vi.fn(),
    create: vi.fn(),
  },
}));

const { carService } = await import("../Services/car.service");
const servicio = carService as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;

const armarStore = () => configureStore({ reducer: { car: carReducer } });

beforeEach(() => {
  for (const fn of Object.values(servicio)) fn.mockReset();
});

describe("un rechazo de negocio", () => {
  it("resuelve el thunk, no lo rechaza", async () => {
    // Este es el contrato entero. Si esto cambiara a `rejected`, todas las
    // pantallas que usan `unwrap()` empezarían a lanzar y las que no, dejarían
    // de mostrar el motivo.
    servicio.create.mockResolvedValue({
      status: "failed",
      message: "Patente ya registrada",
    });
    const store = armarStore();

    const accion = await store.dispatch(
      createCar({
        licensePlate: "AB123CD",
        brand: "Volkswagen",
        model: "Gol",
        year: 2016,
        kilometers: 90_000,
        owner: {
          fullname: "Ana Gómez",
          phone: "3515123456",
          address: "Calle 1",
          city: "Córdoba",
          email: "",
          isActive: true,
        },
      } as never)
    );

    expect(accion.type).toBe(createCar.fulfilled.type);
    // Y el motivo llega entero: es lo que la pantalla tiene que mostrar.
    expect(accion.payload).toMatchObject({
      status: "failed",
      message: "Patente ya registrada",
    });
  });

  it("por eso `unwrap()` no alcanza para saber si salió bien", async () => {
    // La consecuencia práctica, escrita para que no se olvide: `unwrap()` sólo
    // lanza ante un rechazo, y un fallo de negocio no lo es. Para eso está
    // `ensureSuccess`.
    servicio.create.mockResolvedValue({
      status: "failed",
      message: "Patente ya registrada",
    });
    const store = armarStore();

    const resultado = await store
      .dispatch(createCar({ licensePlate: "AB123CD" } as never))
      .unwrap();

    expect(resultado).toMatchObject({ status: "failed" });
  });
});

describe("un fallo de transporte", () => {
  it("sí rechaza, con el motivo adentro", async () => {
    // Si el canal IPC se cae, el servicio lanza. Eso no es un "no se pudo
    // guardar" del negocio: es que no se sabe qué pasó.
    servicio.getAll.mockRejectedValue(new Error("el canal IPC se cayó"));
    const store = armarStore();

    const accion = await store.dispatch(fetchCars({ page: 1, pageSize: 8 }));

    expect(accion.type).toBe(fetchCars.rejected.type);
    expect(accion.payload).toEqual({ message: "el canal IPC se cayó" });
  });

  it("y deja el listado en un estado que la pantalla puede contar", async () => {
    servicio.getAll.mockRejectedValue(new Error("el canal IPC se cayó"));
    const store = armarStore();

    await store.dispatch(fetchCars({ page: 1, pageSize: 8 }));

    const estado = store.getState().car;
    // El indicador de carga vuelve a apagarse: si quedara encendido, la
    // pantalla se queda con el spinner para siempre y sin decir nada.
    expect(estado.loadingStates.fetching_all).toBe(false);
    // Con el error a mano: una pantalla que no lo muestre es una decisión, no
    // un descuido por falta de datos.
    expect(estado.error).toBeTruthy();
  });
});

describe("cuando el backend contesta bien pero sin resultado", () => {
  it("el thunk rechaza en vez de guardar `undefined`", async () => {
    // `fetchCarByLicence` mira `status` **y** `result`: un envelope exitoso sin
    // cuerpo dejaría el vehículo en `undefined` y la ficha pintando campos
    // vacíos como si el auto existiera.
    servicio.getByLicence.mockResolvedValue({
      status: "success",
      message: "",
      result: undefined,
    });
    const store = armarStore();

    const accion = await store.dispatch(fetchCarByLicence("AB123CD"));

    expect(accion.type).toBe(fetchCarByLicence.rejected.type);
    expect(store.getState().car.car).toBeFalsy();
  });

  it("y con resultado, lo guarda", async () => {
    servicio.getByLicence.mockResolvedValue({
      status: "success",
      message: "",
      result: { id: "auto-1", licensePlate: "AB123CD", jobs: [] },
    });
    const store = armarStore();

    await store.dispatch(fetchCarByLicence("AB123CD"));

    expect(store.getState().car.car).toMatchObject({
      licensePlate: "AB123CD",
    });
  });
});
