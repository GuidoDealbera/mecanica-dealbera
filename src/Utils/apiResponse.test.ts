import { describe, expect, it } from "vitest";
import { ensureSuccess, errorMessage, failureFrom } from "./apiResponse";
import type { APIResponse } from "../Types/apiTypes";

describe("ensureSuccess", () => {
  it("devuelve el result cuando la operación fue exitosa", () => {
    const response: APIResponse<{ id: string }> = {
      status: "success",
      message: "Listo",
      result: { id: "car-1" },
    };
    expect(ensureSuccess(response)).toEqual({ id: "car-1" });
  });

  it("acepta un result vacío (operaciones sin dato de vuelta)", () => {
    const response: APIResponse = {
      status: "success",
      message: "Listo",
      result: undefined,
    };
    expect(ensureSuccess(response)).toBeUndefined();
  });

  it("lanza con el mensaje del backend cuando falló", () => {
    const response: APIResponse = {
      status: "failed",
      message: "No se pueden bajar los kilómetros de un vehículo",
    };
    expect(() => ensureSuccess(response)).toThrowError(
      "No se pueden bajar los kilómetros de un vehículo"
    );
  });

  it("también lanza en 'cancelled' (los flujos que lo usan lo filtran antes)", () => {
    const response: APIResponse = {
      status: "cancelled",
      message: "Operación cancelada",
    };
    expect(() => ensureSuccess(response)).toThrowError("Operación cancelada");
  });

  it("usa un mensaje por defecto si el backend no manda ninguno", () => {
    const response = { status: "failed", message: "" } as APIResponse;
    expect(() => ensureSuccess(response)).toThrowError(
      "La operación no pudo completarse"
    );
  });
});

describe("errorMessage", () => {
  it("saca el mensaje de un Error", () => {
    expect(errorMessage(new Error("no se pudo bajar los km"))).toBe(
      "no se pudo bajar los km"
    );
  });

  it("acepta un string suelto", () => {
    expect(errorMessage("algo salió mal")).toBe("algo salió mal");
  });

  it("no devuelve vacío ante algo que no es un error", () => {
    // El caso que dejaba el toast en blanco: `catch (error: any)` leyendo
    // `error.message` sobre algo que no era un `Error`.
    expect(errorMessage(undefined)).not.toBe("");
    expect(errorMessage({ vaya: "cosa" })).not.toBe("");
    expect(errorMessage(new Error(""))).not.toBe("");
    expect(errorMessage("   ")).not.toBe("");
  });

  it("deja elegir el texto por defecto", () => {
    expect(errorMessage(null, "no se pudo guardar")).toBe("no se pudo guardar");
  });
});

describe("failureFrom", () => {
  it("arma una respuesta con la misma forma que la del backend", () => {
    const res = failureFrom(new Error("patente ya registrada"));

    // Lo que importa: que tenga `status`. Los hooks devolvían el `Error` pelado
    // y quien llamaba hacía `response.status === "success"`, que daba
    // `undefined` y funcionaba de casualidad por ser falsy.
    expect(res).toEqual({
      status: "failed",
      message: "patente ya registrada",
    });
  });
});
