import { handleIpc } from "../../ipc";
import { logError } from "../../logger";
import { validateDto } from "../../validation";
import { CreateCarDto, Jobs, UpdateJobDto } from "../Types/car.dto";
import { AppDataSource, getRepositories } from "../dataSource";
import { v4 } from "uuid";
import { CreateCarJob } from "../../../src/Types/apiTypes";
import { Like } from "typeorm";
import { CreateClientDto } from "../Types/client.dto";
import { Car } from "../Entities/car.entity";
import { Client } from "../Entities/client.entity";

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
  "car:add-job",
  async (_, license: string, jobDto: CreateCarJob) => {
    const repo = getRepositories().carRepository;
    const car = await repo.findOne({
      where: { licensePlate: license },
    });
    if (!car) {
      return {
        status: "failed",
        message: "Vehículo no registrado",
      };
    }

    const newJob: Jobs = {
      id: v4(),
      price: jobDto.price as number,
      description: jobDto.description,
      isThirdParty: jobDto.isThirdParty,
      status: jobDto.status,
      parts: jobDto.parts,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    car.jobs = Array.isArray(car.jobs) ? [...car.jobs, newJob] : [newJob];

    await repo.save(car);
    return {
      status: "success",
      message: "Trabajo registrado exitosamente",
      result: newJob,
    };
  },
);

handleIpc("car:find-jobs", async () => {
  const repo = getRepositories().carRepository;
  const cars = await repo.find();
  const response = cars
    .filter((car) => Array.isArray(car.jobs) && car.jobs.length > 0)
    .map((car) => ({
      licensePlate: car.licensePlate,
      jobs: car.jobs,
    }));
  if (response.length === 0) return null;
  return response;
});

handleIpc(
  "car:update-job",
  async (_, license: string, jobId: string, updateJobDto: UpdateJobDto) => {
    const repo = getRepositories().carRepository;
    const car = await repo.findOne({
      where: {
        licensePlate: license,
      },
    });
    if (!car) {
      return {
        status: "failed",
        message: "Vehículo no registrado",
      };
    }
    if (!car.jobs?.length) {
      return {
        status: "failed",
        message: "El vehículo no tiene trabajos registrados",
      };
    }

    const jobIndex = car.jobs.findIndex((job) => job.id === jobId);
    if (jobIndex === -1) {
      return {
        status: "failed",
        message: `El vehículo registrado con patente ${license} no tiene registrado el trabajo que intenta modificar`,
      };
    }

    car.jobs[jobIndex] = {
      ...car.jobs[jobIndex],
      ...updateJobDto,
      updatedAt: new Date(),
    };

    const savedCar = await repo.save(car);
    const updatedJob = savedCar.jobs.find((job) => job.id === jobId);
    return {
      status: "success",
      message: "Trabajo actualizado correctamente",
      result: updatedJob,
    };
  },
);

handleIpc("car:service-alerts", async () => {
  const repo = getRepositories().carRepository;
  const cars = await repo.find({ relations: ["owner"] });
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
