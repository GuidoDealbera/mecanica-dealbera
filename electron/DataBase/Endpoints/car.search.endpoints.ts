import { handleIpc } from "../../ipc";
import { getRepositories } from "../dataSource";
import { escapeLike } from "../../pagination";

// ── Búsqueda global (cross-dominio: vehículos + clientes).
//
// El endpoint `car:service-alerts` que vivía acá se eliminó al implementar los
// recordatorios de service: calculaba la regla al vuelo (y la duplicaba con la
// notificación de arranque). Ahora los recordatorios son una entidad propia,
// ver `service.endpoints.ts` y `serviceReminders.service.ts`.

handleIpc("global:search", async (_, query: string) => {
  if (typeof query !== "string" || query.trim().length < 2) {
    return {
      status: "success",
      cars: [],
      clients: [],
    };
  }
  const { carRepository: carRepo, clientRepository: clientRepo } =
    getRepositories();

  // Los comodines del término van escapados. Sin esto, buscar `_` traía todo y
  // una patente parcial con guión bajo devolvía cualquier cosa: el `%` y el `_`
  // que escribe el usuario se interpretaban como comodines de `LIKE`. No era
  // inyección —la consulta está parametrizada— pero los resultados estaban mal.
  //
  // Se usa `escapeLike`, que es el helper que ya usaban todos los listados: acá
  // no se escapaba nada y en `client:search` estaba reimplementado a mano.
  const term = `%${escapeLike(query.trim())}%`;

  const [cars, clients] = await Promise.all([
    carRepo
      .createQueryBuilder("car")
      .leftJoinAndSelect("car.owner", "owner")
      .where(
        "(car.licensePlate LIKE :term ESCAPE :esc OR car.model LIKE :term ESCAPE :esc)",
        { term, esc: "\\" }
      )
      .orderBy("car.licensePlate", "ASC")
      .take(6)
      .getMany(),
    clientRepo
      .createQueryBuilder("client")
      .where(
        "(client.fullname LIKE :term ESCAPE :esc OR client.phone LIKE :term ESCAPE :esc)",
        { term, esc: "\\" }
      )
      .orderBy("client.fullname", "ASC")
      .take(6)
      .getMany(),
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
