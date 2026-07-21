import { handleIpc } from "../../ipc";
import { getRepositories } from "../dataSource";
import { Like } from "typeorm";

// ── Consultas de solo lectura: alertas de service (vehículos sin actividad
// reciente) y la búsqueda global (cross-dominio: vehículos + clientes).

handleIpc("car:service-alerts", async () => {
  const repo = getRepositories().carRepository;
  const cars = await repo.find({ relations: ["owner", "jobs"] });
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const alerts = cars
    .filter((car) => {
      if (!Array.isArray(car.jobs) || car.jobs.length === 0) {
        return new Date(car.createdAt) < threeMonthsAgo;
      }
      const lastJobDate = car.jobs.reduce((latest, job) => {
        const d = new Date((job.updatedAt || job.createdAt) as Date);
        return d > latest ? d : latest;
      }, new Date(0));
      return lastJobDate < sixMonthsAgo;
    })
    .map((car) => {
      const lastJob =
        Array.isArray(car.jobs) && car.jobs.length > 0
          ? car.jobs.reduce((latest, job) => {
              const d = new Date((job.updatedAt || job.createdAt) as Date);
              return d >
                new Date((latest.updatedAt || latest.createdAt) as Date)
                ? job
                : latest;
            })
          : null;

      const daysSince = lastJob
        ? Math.floor(
            (Date.now() -
              new Date(
                (lastJob.updatedAt || lastJob.createdAt) as Date,
              ).getTime()) /
              86400000,
          )
        : null;

      return {
        licensePlate: car.licensePlate,
        brand: car.brand,
        model: car.model,
        year: car.year,
        kilometers: car.kilometers,
        ownerName: car.owner?.fullname ?? "Sin titular",
        ownerPhone: car.owner?.phone ?? "---",
        daysSinceLastJob: daysSince,
        lastJobDate: lastJob
          ? new Date(
              (lastJob.updatedAt || lastJob.createdAt) as Date,
            ).toISOString()
          : null,
      };
    });

  return {
    status: "success",
    message: "Alertas de service obtenidas",
    result: alerts,
  };
});

handleIpc("global:search", async (_, query: string) => {
  if (!query || query.trim().length < 2) {
    return {
      status: "success",
      cars: [],
      clients: [],
    };
  }
  const { carRepository: carRepo, clientRepository: clientRepo } =
    getRepositories();
  const q = query.trim();

  const [cars, clients] = await Promise.all([
    carRepo.find({
      where: [
        { licensePlate: Like(`%${q.toUpperCase()}%`) },
        { model: Like(`%${q.toUpperCase()}%`) },
      ],
      relations: ["owner"],
      take: 6,
    }),
    clientRepo.find({
      where: [{ fullname: Like(`%${q}%`) }, { phone: Like(`%${q}%`) }],
      take: 6,
    }),
  ]);

  return {
    status: "success",
    cars: cars.map((car) => ({
      id: car.id,
      licensePlate: car.licensePlate,
      brand: car.brand,
      model: car.model,
      year: car.year,
      ownerName: car.owner?.fullname ?? "Sin titular",
    })),
    clients: clients.map((client) => ({
      id: client.id,
      fullname: client.fullname,
      phone: client.phone,
      city: client.city,
      isActive: client.isActive,
    })),
  };
});
