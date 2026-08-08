import { describe, expect, it } from "vitest";
import { buildTimelineEvents } from "./timeline";
import { JobStatus } from "../Types/apiTypes";
import type { Cars, Jobs, KmRecord } from "../Types/types";

const makeCar = (
  licensePlate: string,
  jobs: Partial<Jobs>[],
  kmHistory: KmRecord[] = []
): Cars =>
  ({
    id: `car-${licensePlate}`,
    licensePlate,
    brand: "Volkswagen",
    model: "Gol",
    year: 2015,
    kilometers: 100000,
    kmHistory,
    jobs: jobs.map((j, i) => ({
      id: `${licensePlate}-j${i}`,
      description: "Trabajo",
      status: JobStatus.COMPLETED,
      price: 1000,
      isThirdParty: false,
      parts: [],
      ...j,
    })),
  }) as unknown as Cars;

describe("buildTimelineEvents", () => {
  it("mezcla trabajos y kilometraje de varios vehículos, del más nuevo al más viejo", () => {
    const events = buildTimelineEvents([
      makeCar(
        "AA111AA",
        [{ createdAt: "2026-01-10T10:00:00.000Z" }],
        [{ km: 1000, date: "2026-03-01T10:00:00.000Z" }]
      ),
      makeCar(
        "BB222BB",
        [{ createdAt: "2026-02-15T10:00:00.000Z" }],
        [{ km: 2000, date: "2026-01-20T10:00:00.000Z" }]
      ),
    ]);

    expect(events).toHaveLength(4);
    expect(events.map((e) => e.date?.toISOString().slice(0, 10))).toEqual([
      "2026-03-01",
      "2026-02-15",
      "2026-01-20",
      "2026-01-10",
    ]);
  });

  it("cada evento sabe a qué vehículo pertenece", () => {
    const events = buildTimelineEvents([
      makeCar("AA111AA", [{ createdAt: "2026-01-10T10:00:00.000Z" }]),
      makeCar("BB222BB", [{ createdAt: "2026-02-10T10:00:00.000Z" }]),
    ]);
    expect(events.map((e) => e.car.licensePlate)).toEqual([
      "BB222BB",
      "AA111AA",
    ]);
  });

  it("prioriza updatedAt sobre createdAt en los trabajos", () => {
    const [event] = buildTimelineEvents([
      makeCar("AA111AA", [
        {
          createdAt: "2026-01-01T10:00:00.000Z",
          updatedAt: "2026-05-05T10:00:00.000Z",
        },
      ]),
    ]);
    expect(event.date?.toISOString().slice(0, 10)).toBe("2026-05-05");
  });

  it("conserva los eventos sin fecha válida y los deja al final", () => {
    const events = buildTimelineEvents([
      makeCar("AA111AA", [
        { id: "sin-fecha" },
        { id: "con-fecha", createdAt: "2026-04-01T10:00:00.000Z" },
      ]),
    ]);
    expect(events).toHaveLength(2);
    expect(events[0].date).not.toBeNull();
    expect(events[1].date).toBeNull();
  });

  it("ignora una fecha inválida", () => {
    const [event] = buildTimelineEvents([
      makeCar("AA111AA", [{ createdAt: "no-es-una-fecha" }]),
    ]);
    expect(event.date).toBeNull();
  });

  it("devuelve lista vacía sin vehículos y tolera vehículos sin datos", () => {
    expect(buildTimelineEvents([])).toEqual([]);
    expect(buildTimelineEvents([makeCar("AA111AA", [])])).toEqual([]);
  });

  it("distingue el tipo de cada evento", () => {
    const events = buildTimelineEvents([
      makeCar(
        "AA111AA",
        [{ createdAt: "2026-01-10T10:00:00.000Z" }],
        [{ km: 500, date: "2026-02-10T10:00:00.000Z" }]
      ),
    ]);
    expect(events.map((e) => e.kind)).toEqual(["km", "job"]);
  });
});
