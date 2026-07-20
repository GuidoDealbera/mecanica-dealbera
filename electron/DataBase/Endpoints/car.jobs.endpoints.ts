import { handleIpc } from "../../ipc";
import { getRepositories } from "../dataSource";
import { v4 } from "uuid";
import { Jobs, UpdateJobDto } from "../Types/car.dto";
import { CreateCarJob } from "../../../src/Types/apiTypes";
import { invalidateDashboardStatsCache } from "../dashboardCache";

// ── Trabajos (jobs) de cada vehículo: alta, listado global y actualización.
// Los jobs se guardan como JSON dentro de la entidad Car (columna simple-json).

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
    invalidateDashboardStatsCache();
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
    invalidateDashboardStatsCache();
    const updatedJob = savedCar.jobs.find((job) => job.id === jobId);
    return {
      status: "success",
      message: "Trabajo actualizado correctamente",
      result: updatedJob,
    };
  },
);
