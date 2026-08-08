import { handleIpc } from "../../ipc";
import { getRepositories } from "../dataSource";
import { Like } from "typeorm";

// ── Búsqueda global (cross-dominio: vehículos + clientes).
//
// El endpoint `car:service-alerts` que vivía acá se eliminó al implementar los
// recordatorios de service: calculaba la regla al vuelo (y la duplicaba con la
// notificación de arranque). Ahora los recordatorios son una entidad propia,
// ver `service.endpoints.ts` y `serviceReminders.service.ts`.

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
