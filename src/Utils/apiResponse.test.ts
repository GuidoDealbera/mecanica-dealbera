import { describe, expect, it } from "vitest";
import { ensureSuccess } from "./apiResponse";
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
