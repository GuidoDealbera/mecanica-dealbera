import { handleIpc } from "../../ipc";
import { logError } from "../../logger";
import { comoParametros, esIdentificador, validateDto } from "../../validation";
import { escapeLike, resolvePage } from "../../pagination";
import { CreateCarDto, UpdateCarDto } from "../Types/car.dto";
import { AppDataSource, getRepositories } from "../dataSource";
import { CreateClientDto } from "../Types/client.dto";
import type { CarQueryParams, Paginated } from "../Types/types";
import { Car } from "../Entities/car.entity";
import { Client } from "../Entities/client.entity";
import { invalidateDashboardStatsCache } from "../dashboardCache";
import { ensureReminder } from "../serviceReminders.service";
import { describeOwnerMismatch, findClientConflict } from "../clients.service";

// Columnas por las que se permite ordenar el listado de autos (mapa
// campo-de-la-UI → columna calificada de la query, para no interpolar texto
// del cliente en el ORDER BY).
const CAR_SORT_COLUMNS: Record<string, string> = {
  licensePlate: "car.licensePlate",
  year: "car.year",
  kilometers: "car.kilometers",
  owner: "owner.fullname",
};

// ── ABM de vehículos: alta, consultas, actualización, baja y reasignación
// de titular. Los trabajos (jobs) y las búsquedas viven en archivos aparte.

handleIpc("car:create", async (_event, payload: CreateCarDto) => {
  const validation = await validateDto(CreateCarDto, payload);
  if (!validation.ok) {
    return { status: "failed", message: validation.message };
  }
  const createCarDto = validation.dto;

  const qr = AppDataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    const existingCar = await qr.manager.findOne(Car, {
      where: { licensePlate: createCarDto.licensePlate },
    });
    if (existingCar) {
      await qr.rollbackTransaction();
      return { status: "failed", message: "Patente ya registrada" };
    }

    // Quién es el titular lo decide el `id` que mandó el formulario, no el
    // nombre. Buscarlo por nombre hacía que el nombre fuera la identidad del
    // cliente: dos personas que se llaman igual eran la misma, y bastaba con
    // escribir el nombre de alguien que ya existía para que el auto le quedara
    // asociado sin haberlo elegido.
    let owner = createCarDto.ownerId
      ? await qr.manager.findOne(Client, {
          where: { id: createCarDto.ownerId },
        })
      : null;

    if (createCarDto.ownerId && !owner) {
      await qr.rollbackTransaction();
      return { status: "failed", message: "El cliente seleccionado no existe" };
    }

    if (owner) {
      // Se eligió un cliente de la lista. Si además se editaron sus datos,
      // antes se descartaban en silencio y el mensaje decía "Vehículo
      // registrado correctamente": el auto quedaba con el teléfono viejo, y a
      // quien se llamaba por el recordatorio de service era a la persona
      // equivocada. Se frena y se explica.
      const difieren = describeOwnerMismatch(owner, createCarDto.owner);
      if (difieren.length > 0) {
        await qr.rollbackTransaction();
        return {
          status: "failed",
          message:
            `Elegiste a "${owner.fullname}" y ${difieren.join(", ")} no ` +
            "coincide con lo cargado. Si es la misma persona, actualizá sus " +
            "datos desde Clientes; si es otra, cargala como titular nuevo.",
        };
      }
    } else {
      const conflicto = await findClientConflict(
        qr.manager,
        createCarDto.owner
      );
      if (conflicto) {
        await qr.rollbackTransaction();
        return { status: "failed", message: conflicto };
      }
      owner = qr.manager.create(Client, createCarDto.owner);
    }
    const savedOwner = await qr.manager.save(Client, owner);

    const newCar = qr.manager.create(Car, {
      ...createCarDto,
      owner: savedOwner,
      kmHistory: [
        { km: createCarDto.kilometers, date: new Date().toISOString() },
      ],
    });
    await qr.manager.save(Car, newCar);

    // El vehículo entra al circuito de service desde el alta: se le crea el
    // recordatorio inicial (según los intervalos configurados).
    await ensureReminder(qr.manager, newCar);

    await qr.commitTransaction();
    invalidateDashboardStatsCache();
    return { status: "success", message: "Vehículo registrado correctamente" };
  } catch (error) {
    await qr.rollbackTransaction();
    logError("car:create", error);
    return { status: "failed", message: "Error al registrar el vehículo" };
  } finally {
    await qr.release();
  }
});

// Listado paginado server-side. Solo carga la relación `owner` (el listado no
// muestra los trabajos, así que no se traen para no cargar todos los `job` de
// todos los autos). Búsqueda por patente (LIKE) y orden opcional en la DB.
handleIpc(
  "car:get-all",
  async (_event, entrada: CarQueryParams): Promise<Paginated<Car>> => {
    // Un canal IPC recibe lo que le manden, y más abajo se hace
    // `params.search.trim()`: con una cadena en vez de un objeto eso revienta.
    const params = comoParametros<CarQueryParams>(entrada);
    const { page, pageSize, skip, take } = resolvePage(params);
    const repo = getRepositories().carRepository;

    const qb = repo
      .createQueryBuilder("car")
      .leftJoinAndSelect("car.owner", "owner");

    const search = params?.search?.trim();
    if (search) {
      qb.andWhere("car.licensePlate LIKE :q ESCAPE :esc", {
        q: `%${escapeLike(search)}%`,
        esc: "\\",
      });
    }

    // Filtros avanzados: marca (exacta) y rango de año.
    if (params?.brand) {
      qb.andWhere("car.brand = :brand", { brand: params.brand });
    }
    const yearFrom = Number(params?.yearFrom);
    if (Number.isFinite(yearFrom) && yearFrom > 0) {
      qb.andWhere("car.year >= :yearFrom", { yearFrom });
    }
    const yearTo = Number(params?.yearTo);
    if (Number.isFinite(yearTo) && yearTo > 0) {
      qb.andWhere("car.year <= :yearTo", { yearTo });
    }

    const sortColumn =
      (params?.sortBy ? CAR_SORT_COLUMNS[params.sortBy] : undefined) ??
      "car.licensePlate";
    qb.orderBy(sortColumn, params?.sortDir === "desc" ? "DESC" : "ASC");

    // Desempate por patente (única) cuando se ordena por año, kilómetros o
    // titular, que se repiten: sin esto el orden entre iguales lo elige el plan
    // de ejecución y cambia solo, por ejemplo al agregar un índice.
    if (sortColumn !== "car.licensePlate") {
      qb.addOrderBy("car.licensePlate", "ASC");
    }

    // `offset/limit` y no `skip/take`: el único join es `car.owner`, que es
    // *-a-uno y no multiplica filas (ver la regla en `electron/pagination.ts`).
    // Ahorra la subconsulta de ids: tres consultas por página pasan a dos.
    qb.offset(skip).limit(take);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }
);

handleIpc(
  "car:get-by-license",
  async (_, licence: CreateCarDto["licensePlate"]) => {
    if (!esIdentificador(licence)) {
      return { status: "failed", message: "Vehículo no registrado" };
    }

    const repo = getRepositories().carRepository;
    const car = await repo.findOne({
      where: {
        licensePlate: licence,
      },
      relations: { owner: true, jobs: true },
      // Orden explícito: sin esto lo decidía la base, así que la tabla de
      // trabajos de la ficha, el documento que se emite y el historial podían
      // mostrar el mismo listado en órdenes distintos (y la tabla pagina de 5 en
      // 5, así que se notaba). Se ordena por `createdAt` y no por `updatedAt`
      // para que las filas no salten de lugar al cambiarle el estado a un
      // trabajo.
      order: { jobs: { createdAt: "DESC" } },
    });
    if (!car) {
      return {
        status: "failed",
        message: "Vehículo no registrado",
      };
    }
    return {
      status: "success",
      message: "Vehículo encontrado",
      result: car,
    };
  }
);

handleIpc("car:update", async (_, id: string, cambios: UpdateCarDto) => {
  // Antes este endpoint recibía `(id, kilometers)` y nada más: marca, modelo y
  // año no se podían corregir desde ningún lado, así que un error de tipeo
  // obligaba a borrar el vehículo —con sus trabajos, su historial de
  // kilometraje y su recordatorio— y volver a cargarlo.
  //
  // La patente sigue afuera a propósito: es la identidad del vehículo. Ver
  // `UpdateCarDto`.
  const validation = await validateDto(UpdateCarDto, cambios);
  if (!validation.ok) {
    return { status: "failed", message: validation.message };
  }
  const datos = validation.dto;

  // El techo del año lo pone el endpoint y no el DTO porque depende de cuándo
  // se ejecute, y un decorador se evalúa una sola vez al cargar el módulo.
  const anioActual = new Date().getFullYear();
  if (datos.year !== undefined && datos.year > anioActual) {
    return {
      status: "failed",
      message: "El año no puede ser posterior al año en curso",
    };
  }

  const carRepo = getRepositories().carRepository;
  const car = await carRepo.findOne({
    where: { id },
    relations: { owner: true },
  });
  if (!car) {
    return { status: "failed", message: "Vehículo no registrado" };
  }

  if (datos.brand !== undefined) car.brand = datos.brand;
  if (datos.model !== undefined) car.model = datos.model;
  if (datos.year !== undefined) car.year = datos.year;

  // El kilometraje tiene reglas propias: no puede bajar, y sólo deja un punto
  // en el historial cuando efectivamente cambia. Antes se agregaba un punto
  // igual al anterior en cada guardado —el formulario manda el kilometraje
  // siempre, incluso cuando se editó otra cosa— y el historial se llenaba de
  // repetidos: tramos planos en el gráfico y eventos duplicados en la ficha.
  let huboCambioDeKm = false;
  if (datos.kilometers !== undefined) {
    if (datos.kilometers < car.kilometers) {
      return {
        status: "failed",
        message: "No se pueden bajar los kilómetros de un vehículo",
      };
    }
    if (datos.kilometers > car.kilometers) {
      car.kmHistory = [
        ...(Array.isArray(car.kmHistory) ? car.kmHistory : []),
        { km: datos.kilometers, date: new Date().toISOString() },
      ];
      car.kilometers = datos.kilometers;
      huboCambioDeKm = true;
    }
  }

  const otroCambio =
    datos.brand !== undefined ||
    datos.model !== undefined ||
    datos.year !== undefined;
  if (!huboCambioDeKm && !otroCambio) {
    return {
      status: "success",
      message: "Vehículo actualizado correctamente",
      result: car,
    };
  }

  const savedCar = await carRepo.save(car);
  invalidateDashboardStatsCache();
  return {
    status: "success",
    message: "Vehículo actualizado correctamente",
    result: savedCar,
  };
});

handleIpc("car:delete", async (_, license: CreateCarDto["licensePlate"]) => {
  const qr = AppDataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    const car = await qr.manager.findOne(Car, {
      where: { licensePlate: license },
      relations: { owner: true },
    });

    if (!car) {
      await qr.rollbackTransaction();
      return { status: "failed", message: "Vehículo no encontrado" };
    }

    // Se borra el vehículo y **nada más**: sus trabajos y su recordatorio de
    // service caen por la cascada de la FK.
    //
    // El titular se conserva incluso si este era su único vehículo. Antes se
    // eliminaba, y era la única operación de la app que destruía un registro que
    // el usuario no había elegido borrar: perdía teléfono, dirección y correo de
    // forma irreversible en una acción que era "borrar un auto". Un cliente sin
    // vehículos es un estado válido (la pantalla de Clientes los lista) y para
    // darlo de baja de verdad está `client:delete`, que sí lo avisa.
    await qr.manager.remove(car);

    await qr.commitTransaction();
    invalidateDashboardStatsCache();
    return { status: "success", message: "Vehículo eliminado correctamente" };
  } catch (error) {
    await qr.rollbackTransaction();
    logError("car:delete", error);
    return { status: "failed", message: "Error al eliminar el vehículo" };
  } finally {
    await qr.release();
  }
});

handleIpc(
  "car:reassign-owner",
  async (
    _,
    licensePlate: string,
    payload:
      | { mode: "existing"; existingOwnerId: string }
      | { mode: "new"; newOwner: CreateClientDto }
  ) => {
    // El modo se comprueba y no se da por sentado: un canal IPC recibe lo que le
    // manden, y con un `mode` cualquiera el `else` de más abajo tomaba la rama
    // de "cliente nuevo" con un `newOwner` que podía no existir.
    if (payload?.mode !== "existing" && payload?.mode !== "new") {
      return { status: "failed", message: "Datos de reasignación inválidos" };
    }

    // El titular nuevo se valida con el mismo DTO que usa el alta. Sin esto,
    // por acá se podía crear un cliente con teléfono en formato inválido,
    // dirección vacía o correo mal formado —cosas que `car:create` rechaza—, y
    // quedaban dos calidades de dato según por dónde se hubiera entrado.
    let ownerValidado: CreateClientDto | null = null;
    if (payload.mode === "new") {
      const validation = await validateDto(CreateClientDto, payload.newOwner);
      if (!validation.ok) {
        return { status: "failed", message: validation.message };
      }
      ownerValidado = validation.dto;
    }

    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const car = await qr.manager.findOne(Car, {
        where: { licensePlate },
        relations: { owner: true },
      });
      if (!car) {
        await qr.rollbackTransaction();
        return { status: "failed", message: "Vehículo no registrado" };
      }

      let newOwner;

      if (payload.mode === "existing") {
        if (!esIdentificador(payload.existingOwnerId)) {
          await qr.rollbackTransaction();
          return {
            status: "failed",
            message: "El cliente seleccionado no existe",
          };
        }
        newOwner = await qr.manager.findOne(Client, {
          where: { id: payload.existingOwnerId },
        });
        if (!newOwner) {
          await qr.rollbackTransaction();
          return {
            status: "failed",
            message: "El cliente seleccionado no existe",
          };
        }
        if (newOwner.id === car.owner?.id) {
          await qr.rollbackTransaction();
          return {
            status: "failed",
            message: "El cliente ya es el titular de este vehículo",
          };
        }
      } else {
        const datosNuevos = ownerValidado as CreateClientDto;
        const conflicto = await findClientConflict(qr.manager, datosNuevos);
        if (conflicto) {
          await qr.rollbackTransaction();
          return { status: "failed", message: conflicto };
        }
        newOwner = qr.manager.create(Client, {
          ...datosNuevos,
          isActive: true,
        });
        await qr.manager.save(Client, newOwner);
      }

      car.owner = newOwner;
      const savedCar = await qr.manager.save(Car, car);

      await qr.commitTransaction();
      invalidateDashboardStatsCache();
      return {
        status: "success",
        message: `Titular actualizado a "${newOwner.fullname}"`,
        result: savedCar,
      };
    } catch (error) {
      await qr.rollbackTransaction();
      logError("car:reassign-owner", error);
      return {
        status: "failed",
        message: "Error al reasignar el titular del vehículo",
      };
    } finally {
      await qr.release();
    }
  }
);
