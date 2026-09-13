import { handleIpc, handleIpcQuery } from "../../ipc";
import { logError } from "../../logger";
import { comoParametros, esIdentificador, validateDto } from "../../validation";
import { escapeLike, resolvePage } from "../../pagination";
import { CreateClientDto, UpdateClientDto } from "../Types/client.dto";
import { AppDataSource, getRepositories } from "../dataSource";
import type { ClientQueryParams, Paginated } from "../Types/types";
import { Car } from "../Entities/car.entity";
import { Client } from "../Entities/client.entity";
import { invalidateDashboardStatsCache } from "../dashboardCache";
import { describeClientDuplicates } from "../clients.service";
import { moveClientToTrash } from "../trash.service";

// Columnas por las que se permite ordenar el listado de clientes.
const CLIENT_SORT_COLUMNS: Record<string, string> = {
  fullname: "client.fullname",
};

handleIpc("client:create", async (_, payload: CreateClientDto) => {
  const validation = await validateDto(CreateClientDto, payload);
  if (!validation.ok) {
    return { status: "failed", message: validation.message };
  }
  const createClientDto = validation.dto;

  const repo = getRepositories().clientRepository;
  // El duplicado se avisa y no se impide: dos clientes pueden llamarse igual y
  // una familia puede compartir el teléfono. Pero casi siempre es la misma
  // persona cargada dos veces, y eso hay que decirlo en el momento.
  const aviso = await describeClientDuplicates(
    AppDataSource.manager,
    createClientDto
  );
  const newOwner = repo.create(createClientDto);
  const guardado = await repo.save(newOwner);
  invalidateDashboardStatsCache();
  return {
    status: "success",
    message: aviso
      ? `Cliente registrado correctamente. ${aviso}`
      : "Cliente registrado correctamente",
    // Con el cliente adentro. Sin esto, quien lo crea no recibe su `id` y para
    // hacer cualquier cosa a continuación tiene que volver a buscarlo **por
    // nombre**, que es la clave frágil que D5 vino a sacar del medio.
    result: guardado,
  };
});

// Listado paginado server-side. Por defecto solo clientes activos (el filtro
// `includeInactive` los incluye). Búsqueda por nombre (LIKE) y orden en la DB.
// El join de `cars` es a-muchos: TypeORM pagina con subconsulta de ids, así que
// `total` cuenta clientes distintos (no filas del join).
handleIpcQuery(
  "client:get-all",
  "No se pudo cargar el listado de clientes",
  async (_event, entrada: ClientQueryParams): Promise<Paginated<Client>> => {
    const params = comoParametros<ClientQueryParams>(entrada);
    const { page, pageSize, skip, take } = resolvePage(params);
    const repo = getRepositories().clientRepository;

    // Del vehículo sólo se traen `id` y patente: es todo lo que muestra el
    // listado (la cantidad, y la patente cuando el cliente tiene uno solo) y lo
    // que necesita el diálogo de borrado para avisar cuántos se eliminan. Con
    // `leftJoinAndSelect` viajaban todas las columnas de cada auto por IPC,
    // incluido el historial de kilometraje completo, para mostrar un número.
    const qb = repo
      .createQueryBuilder("client")
      .leftJoin("client.cars", "cars")
      .addSelect(["cars.id", "cars.licensePlate"]);

    if (!params?.includeInactive) {
      qb.andWhere("client.isActive = :active", { active: true });
    }

    const search = params?.search?.trim();
    if (search) {
      qb.andWhere("client.fullname LIKE :q ESCAPE :esc", {
        q: `%${escapeLike(search)}%`,
        esc: "\\",
      });
    }

    // Filtro avanzado: ciudad exacta (el valor sale del dropdown de ciudades).
    if (params?.city) {
      qb.andWhere("client.city = :city", { city: params.city });
    }

    const sortColumn =
      (params?.sortBy ? CLIENT_SORT_COLUMNS[params.sortBy] : undefined) ??
      "client.fullname";
    qb.orderBy(sortColumn, params?.sortDir === "desc" ? "DESC" : "ASC");

    // Desempate por nombre (único). Hoy es el único orden posible, así que no
    // hace falta; queda por si se agrega otra columna a CLIENT_SORT_COLUMNS.
    if (sortColumn !== "client.fullname") {
      qb.addOrderBy("client.fullname", "ASC");
    }

    // `skip/take` es obligatorio acá: `client.cars` es a-muchos, así que cada
    // cliente ocupa tantas filas como vehículos tenga y un `LIMIT` directo corta
    // por la mitad (medido: pidiendo 8 devuelve 4 clientes, y al último le
    // faltan vehículos). Ver la regla en `electron/pagination.ts`.
    qb.skip(skip).take(take);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }
);

// Lista de ciudades/localidades distintas (no vacías), ordenadas. Alimenta el
// dropdown de filtro por ciudad del listado de clientes.
handleIpcQuery(
  "client:cities",
  "No se pudieron cargar las localidades",
  async (): Promise<string[]> => {
    const repo = getRepositories().clientRepository;
    const rows = await repo
      .createQueryBuilder("client")
      .select("client.city", "city")
      .distinct(true)
      .where("client.city IS NOT NULL AND client.city <> ''")
      .orderBy("client.city", "ASC")
      .getRawMany<{ city: string }>();
    return rows.map((r) => r.city);
  }
);

/**
 * La ficha del cliente, buscada por `id`.
 *
 * Era `client:find-by-name`, y la dirección de la pantalla era el nombre
 * (`/clients/Juan%20Pérez`). Eso ataba dos cosas que no tienen por qué estar
 * atadas: renombrar a un cliente invalidaba el enlace a su ficha, y dos
 * homónimos no podían distinguirse ni siquiera en la URL.
 */
handleIpc("client:find-by-id", async (_, id: string) => {
  if (!esIdentificador(id)) {
    return { status: "failed", message: "Cliente no registrado" };
  }

  const repo = getRepositories().clientRepository;
  // Se cargan también los trabajos de cada auto (`cars.jobs`) porque la ficha
  // del cliente muestra el conteo de trabajos por vehículo.
  const owner = await repo.findOne({
    where: { id },
    relations: { cars: { jobs: true } },
  });
  if (!owner) {
    return { status: "failed", message: "Cliente no registrado" };
  }
  return {
    status: "success",
    message: "Cliente encontrado",
    result: owner,
  };
});

handleIpc("client:search", async (_, query: string) => {
  if (typeof query !== "string") {
    return { status: "success", message: "Sin resultados", result: [] };
  }
  const repo = getRepositories().clientRepository;
  // `escapeLike` y no un `replace` a mano: era la misma expresión copiada.
  const sanitized = escapeLike(query);
  const result = await repo
    .createQueryBuilder("client")
    .where("client.fullname LIKE :q ESCAPE :esc", {
      q: `%${sanitized}%`,
      esc: "\\",
    })
    .leftJoinAndSelect("client.cars", "cars")
    .take(10)
    .getMany();

  return {
    status: "success",
    message: "Lo encontré",
    result,
  };
});

handleIpc("client:toggle-active", async (_, id: string) => {
  if (!esIdentificador(id)) {
    return { status: "failed", message: "Cliente no encontrado" };
  }

  const repo = getRepositories().clientRepository;
  // Sin los autos: esta operación toca un booleano del cliente y no los mira.
  // Quien llama tampoco: la pantalla usa el `status` y recarga el listado.
  const client = await repo.findOne({ where: { id } });
  if (!client) {
    return {
      status: "failed",
      message: "Cliente no encontrado",
    };
  }
  client.isActive = !client.isActive;
  await repo.save(client);
  invalidateDashboardStatsCache();
  return {
    status: "success",
    message: `Cliente ${client.isActive ? "activado" : "desactivado"} correctamente`,
    result: client,
  };
});

handleIpc("client:delete", async (_, id: string) => {
  const qr = AppDataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    const client = await qr.manager.findOne(Client, {
      where: { id },
      relations: { cars: true },
    });
    if (!client) {
      await qr.rollbackTransaction();
      return { status: "failed", message: "Cliente no encontrado" };
    }
    // La copia va antes de tocar nada, y del cliente **con todos sus
    // vehículos**: borrar un cliente es la operación que más se lleva puesto de
    // toda la aplicación.
    await moveClientToTrash(qr.manager, client.id, client.fullname);

    if (client.cars && client.cars.length > 0) {
      for (const car of client.cars) {
        await qr.manager.remove(Car, car);
      }
    }
    await qr.manager.remove(Client, client);
    await qr.commitTransaction();
    invalidateDashboardStatsCache();
    return {
      status: "success",
      message: "Cliente eliminado. Se puede recuperar desde la papelera.",
    };
  } catch (error) {
    await qr.rollbackTransaction();
    logError("client:delete", error);
    return { status: "failed", message: "Error al eliminar el cliente" };
  } finally {
    await qr.release();
  }
});

handleIpc("client:update", async (_, payload: UpdateClientDto) => {
  const validation = await validateDto(UpdateClientDto, payload);
  if (!validation.ok) {
    return { status: "failed", message: validation.message };
  }
  const { id, address, city, email, fullname, phone } = validation.dto;

  const repo = getRepositories().clientRepository;

  // Con los autos desde el principio: hace falta devolverlos, y antes eso se
  // resolvía con un `findOne` **extra después de guardar**. Es la misma
  // consulta corrida de lugar, no una consulta más.
  const updateClient = await repo.findOne({
    relations: { cars: true },
    where: {
      id,
    },
  });
  if (!updateClient) {
    return {
      status: "failed",
      message: "El cliente que intenta modificar no se encuentra registrado",
    };
  }
  // Sólo se mira lo que efectivamente cambia: contra el propio cliente no hay
  // nada que avisar.
  const aviso = await describeClientDuplicates(
    AppDataSource.manager,
    {
      fullname: fullname !== updateClient.fullname ? fullname : undefined,
      phone: phone !== updateClient.phone ? phone : undefined,
    },
    id
  );
  if (fullname !== undefined) updateClient.fullname = fullname;
  if (address !== undefined) updateClient.address = address;
  if (city !== undefined) updateClient.city = city;
  if (email !== undefined) updateClient.email = email;
  if (phone !== undefined) updateClient.phone = phone;

  const saved = await repo.save(updateClient);
  invalidateDashboardStatsCache();
  return {
    status: "success",
    message: aviso
      ? `Cliente actualizado correctamente. ${aviso}`
      : "Cliente actualizado correctamente",
    result: saved,
  };
});
