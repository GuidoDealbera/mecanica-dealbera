import { describe, it, expect } from "vitest";
import { getServiceUrgency, formatServiceUrgencyLabel } from "./serviceAlerts";

describe("getServiceUrgency", () => {
  it("devuelve 'warning' cuando no hay trabajos (null)", () => {
    expect(getServiceUrgency(null)).toBe("warning");
  });

  it("devuelve 'danger' con más de 365 días", () => {
    expect(getServiceUrgency(400)).toBe("danger");
  });

  it("devuelve 'warning' entre 181 y 365 días", () => {
    expect(getServiceUrgency(200)).toBe("warning");
  });

  it("devuelve 'default' con 180 días o menos", () => {
    expect(getServiceUrgency(180)).toBe("default");
    expect(getServiceUrgency(30)).toBe("default");
  });

  it("respeta los límites exactos (365 sigue siendo warning)", () => {
    expect(getServiceUrgency(365)).toBe("warning");
    expect(getServiceUrgency(366)).toBe("danger");
  });
});

describe("formatServiceUrgencyLabel", () => {
  it("devuelve 'Sin trabajos' cuando es null", () => {
    expect(formatServiceUrgencyLabel(null)).toBe("Sin trabajos");
  });

  it("expresa en meses cuando supera el año", () => {
    expect(formatServiceUrgencyLabel(400)).toBe("13 meses");
  });

  it("expresa en días cuando es un año o menos", () => {
    expect(formatServiceUrgencyLabel(200)).toBe("200 días");
    expect(formatServiceUrgencyLabel(365)).toBe("365 días");
  });
});
