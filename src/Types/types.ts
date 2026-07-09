import type { CarBrand } from "../Utils/utils";
import { AppError, JobStatus } from "./apiTypes";

export interface KmRecord {
  km: number;
  date: string;
}
export interface Client {
  id: string;
  fullname: string;
  phone: string;
  address: string;
  city: string;
  email?: string;
  isActive: boolean;
  createdAt?: string;
  cars?: Car[];
}

export interface Clients extends Omit<Client, "cars"> {
  cars?: Cars[];
}

export interface Car {
  id: string;
  licensePlate: string;
  model: string;
  brand: CarBrand;
  year: number;
  jobs: Jobs[];
  kilometers: number;
  kmHistory?: KmRecord[];
  owner: Client;
  createdAt: Date;
  updatedAt: Date;
}

export interface Cars extends Omit<Car, "createdAt" | "updatedAt"> {
  createdAt: string;
  updatedAt: string;
}

export interface Jobs {
  id: string;
  price: number;
  description: string;
  isThirdParty: boolean;
  status: JobStatus;
  parts: {
    name: string;
    price: number;
  }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientState {
  allClients: Clients[];
  client: Clients | undefined;
  loadingStates: {
    fetching_all: boolean;
    fetching: boolean;
    creating: boolean;
    updating: boolean;
    deleting: boolean;
  };
  error: AppError | null;
}

export interface CarState {
  allCars: Cars[];
  car: Cars | undefined;
  loadingStates: {
    fetching_all: boolean;
    fetching: boolean;
    creating: boolean;
    updating: boolean;
    deleting: boolean;
  };
  error: AppError | null;
}

export interface DashboardStats {
  totalCars: number;
  totalClients: number;
  activeClients: number;
  newCarsThisMonth: number;
  newClientsThisMonth: number;
  pendingJobs: number;
  jobsInProgress: number;
  completedJobs: number;
  deliveredJobs: number;
  completedThisMonth: number;
  revenueThisMonth: number;
  carsWithAlerts: number;
  deliveredThisMonth: number;
  monthlyRevenue: { month: string; revenue: number }[];
  recentActiveJobs: {
    licensePlate: string;
    brand: string;
    model: string;
    description: string;
    price: number;
  }[];
  recentCompletedJobs: {
    licensePlate: string;
    brand: string;
    model: string;
    description: string;
    price: number;
  }[];
  recentDeliveredJobs: {
    licensePlate: string;
    brand: string;
    model: string;
    description: string;
    price: number;
  }[];
}

export interface ServiceAlert {
  licensePlate: string;
  brand: string;
  model: string;
  year: number;
  kilometers: number;
  ownerName: string;
  ownerPhone: string;
  daysSinceLastJob: number | null;
  lastJobDate: string | null;
}
