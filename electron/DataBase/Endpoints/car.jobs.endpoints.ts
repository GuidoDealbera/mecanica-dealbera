import { handleIpc } from "../../ipc";
import { getRepositories } from "../dataSource";
import { UpdateJobDto } from "../Types/car.dto";
import { CreateCarJob } from "../../../src/Types/apiTypes";
import { Job } from "../Entities/job.entity";
import { invalidateDashboardStatsCache } from "../dashboardCache";

// ── Trabajos (jobs) de cada vehículo: alta, listado global y actualización.
// Los trabajos son una entidad propia (`job`) con FK a `car`.

// Devuelve el trabajo sin la relación `car` cargada, para no serializar el
// auto completo (y su cadena de relaciones) hacia el renderer.
function toPlainJob(job: Job) {
  return {
    id: job.id,
    price: job.price,
    description: job.description,
    isThirdParty: job.isThirdParty,
    status: job.status,
    parts: job.parts ?? [],
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

handleIpc(
  "car:add-job",
  async (_, license: string, jobDto: CreateCarJob) => {
    const { carRepository, jobRepository } = getRepositories();
    const car = await carRepository.findOne({
      where: { licensePlate: license },
    });
    if (!car) {
      return {
        status: "failed",
        message: "Vehículo no registrado",
      };
    }

    const job = jobRepository.create({
      price: jobDto.price as number,
      description: jobDto.description,
      isThirdParty: jobDto.isThirdParty,
      status: jobDto.status,
      parts: jobDto.parts,
      car,
    });
    const saved = await jobRepository.save(job);
    invalidateDashboardStatsCache();

    return {
      status: "success",
      message: "Trabajo registrado exitosamente",
      result: toPlainJob(saved),
    };
  },
);

handleIpc("car:find-jobs", async () => {
  const { carRepository } = getRepositories();
  const cars = await carRepository.find({ relations: ["jobs"] });
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
    const { jobRepository } = getRepositories();
    const job = await jobRepository.findOne({
      where: { id: jobId },
      relations: ["car"],
    });
    if (!job) {
      return {
        status: "failed",
        message: "El trabajo que intenta modificar no existe",
      };
    }
    if (job.car?.licensePlate !== license) {
      return {
        status: "failed",
        message: `El vehículo registrado con patente ${license} no tiene registrado el trabajo que intenta modificar`,
      };
    }

    if (updateJobDto.status !== undefined) job.status = updateJobDto.status;
    if (updateJobDto.price !== undefined) job.price = updateJobDto.price;
    if (updateJobDto.parts !== undefined) job.parts = updateJobDto.parts;

    const saved = await jobRepository.save(job);
    invalidateDashboardStatsCache();

    return {
      status: "success",
      message: "Trabajo actualizado correctamente",
      result: toPlainJob(saved),
    };
  },
);
