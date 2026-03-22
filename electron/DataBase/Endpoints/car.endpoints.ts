import { ipcMain } from "electron";
import { CreateCarDto, Jobs, UpdateJobDto } from "../Types/car.dto";
import { getRepositories } from "../dataSource";
import { v4 } from "uuid";
import { CreateCarJob } from "../../../src/Types/apiTypes";
import { Like } from "typeorm";
import { CreateClientDto } from "../Types/client.dto";

ipcMain.handle("car:create", async (_event, createCarDto: CreateCarDto) => {
  const { carRepository: carRepo, clientRepository: clientRepo } =
    getRepositories();
  const existingCar = await carRepo.findOne({
    where: {
      licensePlate: createCarDto.licensePlate,
    },
  });
  if (existingCar) {
    return {
      status: "failed",
      message: "Patente ya registrada",
    };
  }

  let owner = await clientRepo.findOne({
    where: {
      fullname: createCarDto.owner.fullname,
    },
  });

  if (!owner) {
    const existingPhone = await clientRepo.findOne({
      where: {
        phone: createCarDto.owner.phone,
      },
    });
    if (existingPhone) {
      return {
        status: "failed",
        message: `El teléfono ya está registrado a nombre de ${existingPhone.fullname}`,
      };
    }
    owner = clientRepo.create(createCarDto.owner);
  }
  const savedOwner = await clientRepo.save(owner);

  const newCar = carRepo.create({
    ...createCarDto,
    owner: savedOwner,
    kmHistory: [
      { km: createCarDto.kilometers, date: new Date().toISOString() },
    ],
  });

  await carRepo.save(newCar);
  return {
    status: "success",
    message: "Vehículo registrado correctamente",
  };
});

ipcMain.handle("car:get-all", async () => {
  const repo = getRepositories().carRepository;
  return await repo.find({
    relations: ["owner"],
  });
});

ipcMain.handle(
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

ipcMain.handle("car:update", async (_, id: string, kilometers: number) => {
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

ipcMain.handle(
  "car:delete",
  async (_, license: CreateCarDto["licensePlate"]) => {
    const carRepo = getRepositories().carRepository;
    const clientRepo = getRepositories().clientRepository;
    const carToDelete = await carRepo.findOne({
      where: {
        licensePlate: license,
      },
      relations: ["owner"],
    });
    if (!carToDelete) {
      return {
        status: "failed",
        message: "Vehículo no registrado",
      };
    }
    const owner = carToDelete.owner;
    await carRepo.remove(carToDelete);

    const remainingCars = await carRepo.find({
      where: {
        owner: {
          id: owner.id,
        },
      },
    });
    if (remainingCars.length === 0) {
      await clientRepo.remove(owner);
    }
    return {
      status: "success",
      message: "Vehículo eliminado exitosamente",
    };
  },
);

ipcMain.handle(
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

ipcMain.handle("car:find-jobs", async () => {
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

ipcMain.handle(
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
    if (car.jobs) {
      const jobIndex = car.jobs.findIndex((job) => job.id === jobId);
      if (jobIndex === undefined || jobIndex === -1) {
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
    }

    const savedCar = await repo.save(car);
    const { owner, ...rest } = savedCar;
    const { jobs } = rest;
    const updatedJob = jobs.find((job) => job.id === jobId);
    return {
      status: "success",
      message: "Trabajo actualizado correctamente",
      result: updatedJob,
    };
  },
);

ipcMain.handle("car:service-alerts", async () => {
  const repo = getRepositories().carRepository;
  const cars = await repo.find({ relations: ["owner"] });
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const threeMontsAgo = new Date();
  threeMontsAgo.setMonth(threeMontsAgo.getMonth() - 3);

  const alerts = cars
    .filter((car) => {
      if (!Array.isArray(car.jobs) || car.jobs.length === 0) {
        return new Date(car.createdAt) < threeMontsAgo;
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
        licencePlate: car.licensePlate,
        brand: car.brand,
        model: car.model,
        year: car.year,
        ownerName: car.owner.fullname,
        ownerPhone: car.owner.phone,
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
    result: alerts,
  };
});

ipcMain.handle(
  "car:reassign-owner",
  async (
    _,
    licensePlate: string,
    payload:
      | { mode: "existing"; existingOwnerFullname: string }
      | { mode: "new"; newOwner: CreateClientDto }
  ) => {
    const { carRepository: carRepo, clientRepository: clientRepo } = getRepositories();
 
    const car = await carRepo.findOne({
      where: { licensePlate },
      relations: ["owner"],
    });
    if (!car) {
      return { status: "failed", message: "Vehículo no registrado" };
    }
 
    let newOwner;
 
    if (payload.mode === "existing") {
      newOwner = await clientRepo.findOne({
        where: { fullname: payload.existingOwnerFullname },
      });
      if (!newOwner) {
        return { status: "failed", message: "El cliente seleccionado no existe" };
      }
      if (newOwner.id === car.owner?.id) {
        return { status: "failed", message: "El cliente ya es el titular de este vehículo" };
      }
    } else {
      // Verificar duplicado de nombre
      const existingByName = await clientRepo.findOne({
        where: { fullname: payload.newOwner.fullname },
      });
      if (existingByName) {
        return { status: "failed", message: `Ya existe un cliente llamado "${payload.newOwner.fullname}"` };
      }
      // Verificar duplicado de teléfono
      const existingByPhone = await clientRepo.findOne({
        where: { phone: payload.newOwner.phone },
      });
      if (existingByPhone) {
        return {
          status: "failed",
          message: `El teléfono ya está registrado a nombre de ${existingByPhone.fullname}`,
        };
      }
      newOwner = clientRepo.create({ ...payload.newOwner, isActive: true });
      await clientRepo.save(newOwner);
    }
 
    car.owner = newOwner;
    const savedCar = await carRepo.save(car);
 
    return {
      status: "success",
      message: `Titular actualizado a "${newOwner.fullname}"`,
      result: savedCar,
    };
  }
);

ipcMain.handle("global:search", async (_, query: string) => {
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
      ownerName: car.owner.fullname,
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
