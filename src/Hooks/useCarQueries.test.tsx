// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCarQueries } from "./useCarQueries";

/**
 * El hook por el que pasan todas las operaciones de vehículos.
 *
 * Lo que importa acá es una sola cosa, y es el contrato que `CLAUDE.md`
 * documenta como ya pagado: **los thunks resuelven aunque el backend haya
 * rechazado**. Una pantalla que sólo mira si la promesa resolvió muestra
 * "guardado con éxito" sin haber guardado nada.
 *
 * `ensureSuccess` es lo que convierte ese `status: "failed"` en un `throw` con
 * el motivo real. Este archivo prueba que esté puesto donde tiene que estar y
 * que el mensaje que llega al usuario sea el del backend y no uno genérico.
 */

const showToast = vi.fn();
const navigate = vi.fn();
const store = {
  list: { items: [], total: 0, page: 1, pageSize: 8 },
  listLoaded: true,
  car: undefined,
  carLoaded: true,
  error: null,
  loadingStates: {},
  fetchList: vi.fn(),
  fetchByLicence: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  addJob: vi.fn(),
  updateJob: vi.fn(),
  cleanCar: vi.fn(),
  cleanCars: vi.fn(),
  clearError: vi.fn(),
};

vi.mock("./useCarStore", () => ({ useCarStore: () => store }));
vi.mock("./useToasts", () => ({ useToasts: () => ({ showToast }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));

const montar = () => renderHook(() => useCarQueries()).result;

/** Lo que dice el último toast, que es lo que el usuario efectivamente lee. */
const ultimoToast = () => {
  const llamada = showToast.mock.calls.at(-1);
  return llamada ? { texto: llamada[0], color: llamada[1] } : null;
};

beforeEach(() => {
  showToast.mockClear();
  navigate.mockClear();
  for (const fn of Object.values(store)) {
    if (typeof fn === "function") (fn as ReturnType<typeof vi.fn>).mockReset();
  }
});

describe("actualizar un vehículo", () => {
  it("cuando el backend rechaza, lo dice con el motivo del backend", async () => {
    // El caso concreto: bajar los kilómetros. El thunk **resuelve** con
    // `status: "failed"`, así que sin `ensureSuccess` la pantalla seguía
    // adelante avisando que se había actualizado.
    store.update.mockResolvedValue({
      status: "failed",
      message: "No se pueden bajar los kilómetros de un vehículo",
    });
    const hook = montar();

    await expect(
      act(() => hook.current.updateCar("auto-1", { kilometers: 10 }, true))
    ).rejects.toThrow(/no se pueden bajar los kilómetros/i);

    expect(ultimoToast()).toEqual({
      texto: "No se pueden bajar los kilómetros de un vehículo",
      color: "danger",
    });
  });

  it("cuando sale bien, avisa con el mensaje del backend", async () => {
    store.update.mockResolvedValue({
      status: "success",
      message: "Vehículo actualizado correctamente",
      result: {},
    });
    const hook = montar();

    await act(() => hook.current.updateCar("auto-1", { model: "Gol" }, true));

    expect(ultimoToast()).toEqual({
      texto: "Vehículo actualizado correctamente",
      color: "success",
    });
  });

  it("sin `isOnly` no avisa, porque el aviso lo da quien orquesta", async () => {
    // Actualizar el vehículo es parte de flujos más grandes —guardar la ficha
    // entera—: dos toasts por una sola acción del usuario es ruido.
    store.update.mockResolvedValue({
      status: "success",
      message: "Vehículo actualizado correctamente",
      result: {},
    });
    const hook = montar();

    await act(() => hook.current.updateCar("auto-1", { model: "Gol" }));

    expect(showToast).not.toHaveBeenCalled();
  });
});

describe("cuando lo que falla es el canal, no el negocio", () => {
  it("el mensaje sigue siendo legible y no un objeto vacío", async () => {
    // Varios `catch` estaban tipados como `any` y leían `error.message`
    // directo: ante algo que no fuera un `Error`, el toast salía **en blanco**
    // —un cartel rojo sin texto—.
    store.remove.mockRejectedValue("se cayó el canal");
    const hook = montar();

    await act(() => hook.current.deleteOneCar("AB123CD"));

    expect(ultimoToast()).toEqual({
      texto: "se cayó el canal",
      color: "danger",
    });
  });

  it("y con algo que no es ni Error ni texto, tampoco queda vacío", async () => {
    store.remove.mockRejectedValue({ vaya: "cosa" });
    const hook = montar();

    await act(() => hook.current.deleteOneCar("AB123CD"));

    expect(ultimoToast()?.color).toBe("danger");
    expect(ultimoToast()?.texto).toBeTruthy();
  });

  it("devuelve un fallo con la forma del backend, no el Error pelado", async () => {
    // Quien llama hace `if (res.status === "success")`. Un `Error` no tiene
    // `status`, así que daba `undefined` y **funcionaba de casualidad**.
    store.remove.mockRejectedValue(new Error("se cayó el canal"));
    const hook = montar();

    let devuelto: unknown;
    await act(async () => {
      devuelto = await hook.current.deleteOneCar("AB123CD");
    });

    expect(devuelto).toMatchObject({ status: "failed" });
  });
});
