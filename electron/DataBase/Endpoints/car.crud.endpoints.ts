import { handleIpc } from "../../ipc";
import { logError } from "../../logger";
import { validateDto } from "../../validation";
import { CreateCarDto } from "../Types/car.dto";
import { AppDataSource, getRepositories } from "../dataSource";
import { CreateClientDto } from "../Types/client.dto";
import { Car } from "../Entities/car.entity";
import { Client } from "../Entities/client.entity";
import { invalidateDashboardStatsCache } from "../dashboardCache";

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

    let owner = await qr.manager.findOne(Client, {
      where: { fullname: createCarDto.owner.fullname },
    });

    if (!owner) {
      const existingPhone = await qr.manager.findOne(Client, {
        where: { phone: createCarDto.owner.phone },
      });
      if (existingPhone) {
        await qr.rollbackTransaction();
        return {
          status: "failed",
          message: `El teléfono ya está registrado a nombre de ${existingPhone.fullname}`,
        };
      }
      owner = qr.manager.create(Client, createCarDto.owner);
    }
    const savedOwner = await qr.manager.save(Client, owner);

    const newCar = qr.manager.create(Car, {
      ...createCarDto,
      owner: savedOwner,
      kmHistory: [{ km: createCarDto.kilometers, date: new Date().toISOString() }],
    });
    await qr.manager.save(Car, newCar);

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

handleIpc("car:get-all", async () => {
  const repo = getRepositories().carRepository;
  return await repo.find({
    relations: ["owner"],
  });
});

handleIpc(
  "car:get-by-license",
  async (_, licence: CreateCarDto["licensePlate"]) => {
    const repo = getRepositories().carRepository;
    const car = await repo.findOne({
      where: {
        licensePlate: licence,
      },
      relations: ["owner"],
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
  },
);

handleIpc("car:update", async (_, id: string, kilometers: number) => {
  const carRepo = getRepositories().carRepository;
  const car = await carRepo.findOne({
    where: {
      id: id,
    },
    relations: ["owner"],
  });
  if (!car) {
    return {
      status: "failed",
      message: "Vehículo no registrado",
    };
  }
  if (kilometers < car.kilometers) {
    return {
      status: "failed",
      message: "No se pueden bajar los kilómetros de un vehículo",
    };
  }
  const history = Array.isArray(car.kmHistory) ? [...car.kmHistory] : []
  history.push({km: kilometers, date: new Date().toISOString()})
  car.kmHistory = history
  car.kilometers = kilometers

  const savedCar = await carRepo.save(car);
  invalidateDashboardStatsCache();
  return {
    status: "success",
    message: "Vehículo actualizado correctamente",
    result: savedCar,
  };
});

handleIpc(
  "car:delete",
  async (_, license: CreateCarDto["licensePlate"]) => {
    const qr = AppDataSource.createQueryRunner()
    await qr.connect()
    await qr.startTransaction()
    try {
      const car = await qr.manager.findOne(Car, {
        where: {licensePlate: license},
        relations: ['owner']
      })

      if(!car){
        await qr.rollbackTransaction()
        return {status: 'failed', message: 'Vehículo no encontrado'}
      }
      const owner = car.owner
      await qr.manager.remove(car)
      if(owner){
        const remaining = await qr.manager.count(Car, {
          where: {owner: {id: owner.id}},
        })
        if(remaining === 0) await qr.manager.remove(owner)
      }
    await qr.commitTransaction()
    invalidateDashboardStatsCache()
    return {status: 'success', message: "Vehículo eliminado correctamente"}
    } catch (error) {
      await qr.rollbackTransaction()
      logError("car:delete", error)
      return {status: 'failed', message: "Error al eliminar el vehículo"}
    } finally {
      await qr.release()
    }
  },
);

handleIpc(
  "car:reassign-owner",
  async (
    _,
    licensePlate: string,
    payload:
      | { mode: "existing"; existingOwnerFullname: string }
      | { mode: "new"; newOwner: CreateClientDto }
  ) => {
    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const car = await qr.manager.findOne(Car, {
        where: { licensePlate },
        relations: ["owner"],
      });
      if (!car) {
        await qr.rollbackTransaction();
        return { status: "failed", message: "Vehículo no registrado" };
      }

      let newOwner;

      if (payload.mode === "existing") {
        newOwner = await qr.manager.findOne(Client, {
          where: { fullname: payload.existingOwnerFullname },
        });
        if (!newOwner) {
          await qr.rollbackTransaction();
          return { status: "failed", message: "El cliente seleccionado no existe" };
        }
        if (newOwner.id === car.owner?.id) {
          await qr.rollbackTransaction();
          return { status: "failed", message: "El cliente ya es el titular de este vehículo" };
        }
      } else {
        // Verificar duplicado de nombre
        const existingByName = await qr.manager.findOne(Client, {
          where: { fullname: payload.newOwner.fullname },
        });
        if (existingByName) {
          await qr.rollbackTransaction();
          return { status: "failed", message: `Ya existe un cliente llamado "${payload.newOwner.fullname}"` };
        }
        // Verificar duplicado de teléfono
        const existingByPhone = await qr.manager.findOne(Client, {
          where: { phone: payload.newOwner.phone },
        });
        if (existingByPhone) {
          await qr.rollbackTransaction();
          return {
            status: "failed",
            message: `El teléfono ya está registrado a nombre de ${existingByPhone.fullname}`,
          };
        }
        newOwner = qr.manager.create(Client, { ...payload.newOwner, isActive: true });
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
      return { status: "failed", message: "Error al reasignar el titular del vehículo" };
    } finally {
      await qr.release();
    }
  }
);
