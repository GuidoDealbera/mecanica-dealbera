import { handleIpc } from "../../ipc";
import { MoreThanOrEqual } from "typeorm";
import { getRepositories } from "../dataSource";
import { JobStatus } from "../../../src/Types/apiTypes";
import type { DashboardStats } from "../../../src/Types/types";
import {
  getDashboardStatsCache,
  setDashboardStatsCache,
} from "../dashboardCache";

handleIpc("dashboard:get-stats", async () => {
  const cached = getDashboardStatsCache();
  if (cached) {
    return {
      status: "success",
      message: "Estadísticas obtenidas",
      result: cached,
    };
  }

  const { carRepository, clientRepository } = getRepositories();
 
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
 
  const [allCars, totalClients, activeClients, newClientsThisMonth] = await Promise.all([
    carRepository.find({ relations: ["jobs"] }),
    clientRepository.count(),
    clientRepository.countBy({ isActive: true }),
    clientRepository.count({ where: { createdAt: MoreThanOrEqual(startOfMonth) } }),
  ]);

  const totalCars = allCars.length;
  const newCarsThisMonth = allCars.filter(
    (c) => new Date(c.createdAt) >= startOfMonth
  ).length;
 
  let pendingJobs = 0;
  let jobsInProgress = 0;
  let completedJobs = 0;
  let deliveredJobs = 0;
  let completedThisMonth = 0;
  let deliveredThisMonth = 0;
  let revenueThisMonth = 0;
  const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const monthlyRevenue: { month: string; revenue: number }[] = Array.from(
    { length: 6 },
    (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { month: MONTH_NAMES[d.getMonth()], revenue: 0 };
    },
  );
  const sixMonthsAgoMs = new Date(now.getFullYear(), now.getMonth() - 5, 1).getTime();
  const recentActiveJobs: {
    licensePlate: string;
    brand: string;
    model: string;
    description: string;
    price: number;
  }[] = [];
  const recentCompletedJobs: {
    licensePlate: string;
    brand: string;
    model: string;
    description: string;
    price: number;
  }[] = [];
  const recentDeliveredJobs: {
    licensePlate: string;
    brand: string;
    model: string;
    description: string;
    price: number;
  }[] = [];
 
  let carsWithAlerts = 0;

  for (const car of allCars) {
    const hasJobs = Array.isArray(car.jobs) && car.jobs.length > 0;

    if (!hasJobs) {
      if (new Date(car.createdAt) < threeMonthsAgo) carsWithAlerts++;
      continue;
    }

    const lastJobDate = car.jobs.reduce((latest, job) => {
      const d = new Date((job.updatedAt || job.createdAt) as Date);
      return d > latest ? d : latest;
    }, new Date(0));
    if (lastJobDate < sixMonthsAgo) carsWithAlerts++;

    for (const job of car.jobs) {
      if (job.status === JobStatus.PENDING) {
        pendingJobs++;
      }
      if (job.status === JobStatus.COMPLETED) {
        completedJobs++;
      }
      if (job.status === JobStatus.DELIVERED) {
        deliveredJobs++;
      }
      if (job.status === JobStatus.IN_PROGRESS) {
        jobsInProgress++;
        if (recentActiveJobs.length < 6) {
          recentActiveJobs.push({
            licensePlate: car.licensePlate,
            brand: car.brand,
            model: car.model,
            description: job.description,
            price: job.price,
          });
        }
      }
      if (
        (job.status === JobStatus.COMPLETED || job.status === JobStatus.DELIVERED) &&
        job.updatedAt
      ) {
        const jobDate = new Date(job.updatedAt);
        const jobMs = new Date(jobDate.getFullYear(), jobDate.getMonth(), 1).getTime();
        const slotIndex = monthlyRevenue.findIndex(
          (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1).getTime() === jobMs,
        );
        if (slotIndex !== -1 && jobMs >= sixMonthsAgoMs) {
          monthlyRevenue[slotIndex].revenue += job.price ?? 0;
        }
      }
      if (
        job.status === JobStatus.COMPLETED &&
        job.updatedAt &&
        new Date(job.updatedAt) >= startOfMonth
      ) {
        completedThisMonth++;
        revenueThisMonth += job.price ?? 0;
        if (recentCompletedJobs.length < 6) {
          recentCompletedJobs.push({
            licensePlate: car.licensePlate,
            brand: car.brand,
            model: car.model,
            description: job.description,
            price: job.price,
          });
        }
      }
      if (
        job.status === JobStatus.DELIVERED &&
        job.updatedAt &&
        new Date(job.updatedAt) >= startOfMonth
      ) {
        deliveredThisMonth++;
        if (recentDeliveredJobs.length < 6) {
          recentDeliveredJobs.push({
            licensePlate: car.licensePlate,
            brand: car.brand,
            model: car.model,
            description: job.description,
            price: job.price,
          });
        }
      }
    }
  }
 
  const result: DashboardStats = {
    totalCars,
    totalClients,
    activeClients,
    newCarsThisMonth,
    newClientsThisMonth,
    pendingJobs,
    jobsInProgress,
    completedJobs,
    deliveredJobs,
    completedThisMonth,
    deliveredThisMonth,
    revenueThisMonth,
    carsWithAlerts,
    monthlyRevenue,
    recentActiveJobs,
    recentCompletedJobs,
    recentDeliveredJobs,
  };

  setDashboardStatsCache(result);

  return {
    status: "success",
    message: "Estadísticas obtenidas",
    result,
  };
});