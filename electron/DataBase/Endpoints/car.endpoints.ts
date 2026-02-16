import { ipcMain } from "electron";
import { CreateCarDto, Jobs, UpdateJobDto } from "../Types/car.dto";
import { getRepositories } from "../dataSource";
import {v4} from "uuid"
import { CreateCarJob } from "../../../src/Types/apiTypes";

ipcMain.handle("car:create", async (_event, createCarDto: CreateCarDto) => {
  const carRepo = getRepositories().carRepository;
  const clientRepo = getRepositories().clientRepository;
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
        message: "Teléfono ya registrado",
      };
    }
    owner = clientRepo.create(createCarDto.owner);
  }
  const savedOwner = await clientRepo.save(owner);

  const newCar = carRepo.create({
    ...createCarDto,
    owner: savedOwner,
  });

  await clientRepo.save(owner);
  await carRepo.save(newCar);
  return {
    status: "success",
    message: "Automóvil registrado correctamente",
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
        message: "Automóvil no registrado",
      };
    }
    return {
      status: "success",
      message: "Automóvil encontrado",
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
      message: "Automóvil no registrado",
    };
  }
  if (kilometers < car.kilometers) {
    return {
      status: "failed",
      message: "No se pueden bajar los kilómetros de un automóvil",
    };
  }
  car.kilometers = kilometers;

  const savedCar = await carRepo.save(car);
  return {
    status: "success",
    message: "Automóvil actualizado correctamente",
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
        message: "Automóvil no registrado",
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
      message: "Automóvil eliminado exitosamente",
    };
  },
);

ipcMain.handle("car:add-job", async (_, license: string, jobDto: CreateCarJob) => {
  const repo = getRepositories().carRepository;
  const car = await repo.findOne({
    where: { licensePlate: license }
  })
  if(!car){
    return {
      status: 'failed',
      message: "Automóvil no registrado"
    }
  }

  const newJob: Jobs = {
    id: v4(),
    price: jobDto.price as number,
    description: jobDto.description,
    isThirdParty: jobDto.isThirdParty,
    status: jobDto.status,
    createdAt: new Date(),
    updatedAt: new Date
  }

  car.jobs = Array.isArray(car.jobs) ? [...car.jobs, newJob] : [newJob]

  await repo.save(car)
  return {
    status: 'success',
    message: "Trabajao registrado exitosamente",
    result: newJob
  }
});

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
        message: "Automóvil no registrado",
      };
    }
    if (car.jobs) {
      const jobIndex = car.jobs.findIndex((job) => job.id === jobId);
      if (jobIndex === undefined || jobIndex === -1) {
        return {
          status: "failed",
          message: `El automóvil registrado con patente ${license} no tiene registrado el trabajo que intenta modificar`,
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
