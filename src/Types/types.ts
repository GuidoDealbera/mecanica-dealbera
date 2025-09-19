import type { CarBrand } from "../Utils/utils";
import { JobStatus } from "./apiTypes";

export interface Client {
  id: string;
  fullname: string;
  phone: string;
  address: string;
  city: string;
  email?: string;
  cars?: Car[];
}

export interface Clients extends Omit<Client, 'cars'> {
  cars?: Cars[]
} 

export interface Car {
  id: string;
  licensePlate: string;
  model: string;
  brand: CarBrand;
  year: number;
  jobs: Jobs[];
  kilometers: number;
  owner: Client;
  createdAt: Date;
  updatedAt: Date;
}

export interface Cars extends Omit<Car, 'createdAt' | 'updatedAt'> {
  createdAt: string
  updatedAt: string
}

export interface Jobs {
  id: string;
  price: number;
  description: string;
  isThirdParty: boolean;
  status: JobStatus;
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
  error: Error | null;
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
  error: Error | null;
}
