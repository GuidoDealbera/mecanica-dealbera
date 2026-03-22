import { ipcMain } from "electron";
import { getRepositories } from "../dataSource";
import { JobStatus } from "../../../src/Types/apiTypes";

ipcMain.handle("dashboard:get-stats", async () => {
  const { carRepository, clientRepository } = getRepositories();
 
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
 
  const [allCars, allClients] = await Promise.all([
    carRepository.find({ relations: ["owner"] }),
    clientRepository.find(),
  ]);
 
  const totalCars = allCars.length;
  const totalClients = allClients.length;
  const activeClients = allClients.filter((c) => c.isActive).length;
  const newCarsThisMonth = allCars.filter(
    (c) => new Date(c.createdAt) >= startOfMonth
  ).length;
  const newClientsThisMonth = allClients.filter(
    (c) => new Date(c.createdAt) >= startOfMonth
  ).length;
 
  let pendingJobs = 0;
  let jobsInProgress = 0;
  let completedThisMonth = 0;
  let deliveredThisMonth = 0;
  let revenueThisMonth = 0;
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
 
  for (const car of allCars) {
    if (!Array.isArray(car.jobs)) continue;
    for (const job of car.jobs) {
      if (job.status === JobStatus.PENDING) {
        pendingJobs++;
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
 
  const carsWithAlerts = allCars.filter((car) => {
    if (!Array.isArray(car.jobs) || car.jobs.length === 0) {
      return new Date(car.createdAt) < threeMonthsAgo;
    }
    const lastJobDate = car.jobs.reduce((latest, job) => {
      const d = new Date((job.updatedAt || job.createdAt) as Date);
      return d > latest ? d : latest;
    }, new Date(0));
    return lastJobDate < sixMonthsAgo;
  }).length;
 
  return {
    status: "success",
    result: {
      totalCars,
      totalClients,
      activeClients,
      newCarsThisMonth,
      newClientsThisMonth,
      pendingJobs,
      jobsInProgress,
      completedThisMonth,
      deliveredThisMonth,
      revenueThisMonth,
      carsWithAlerts,
      recentActiveJobs,
      recentCompletedJobs,
      recentDeliveredJobs,
    },
  };
});