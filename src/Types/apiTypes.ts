/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CarBrand } from "../Utils/utils";
import { Client, Jobs } from "./types";

export enum JobStatus {
  PENDING = "pending",
  IN_PROGRESS = "in-progress",
  COMPLETED = "completed",
  DELIVERED = "delivered",
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  [JobStatus.IN_PROGRESS]: "En progreso",
  [JobStatus.COMPLETED]: "Completado",
  [JobStatus.DELIVERED]: "Entregado",
  [JobStatus.PENDING]: "Sin comenzar",
};

export interface UpdateJobBody {
  status?: JobStatus;
  price?: number;
  parts?: {
    name: string;
    price: number;
  }[];
}

export interface CreateCarBody {
  licensePlate: string;
  brand: CarBrand;
  model: string;
  year: number;
  owner: Omit<Client, "id" | "cars">;
  jobs?: Jobs[];
  kilometers: number;
}

export interface APIResponse {
  status: "success" | "failed";
  message: string;
  result?: any;
}

// Body para actualizar un cliente: el id es obligatorio (identifica el registro),
// el resto de los campos son opcionales (se actualiza solo lo que venga definido).
export type UpdateClientBody = Partial<Omit<Client, "id" | "cars">> & {
  id: string;
};

export interface AppError {
  message: string;
  code?: string;
}

export interface UpdateCar {
  owner?: Omit<Client, "id" | "cars">;
  kilometers?: number;
}

export interface CreateCarJob {
  price: number | "";
  description: string;
  isThirdParty: boolean;
  status: JobStatus;
  parts: {
    name: string;
    price: number;
  }[];
}
