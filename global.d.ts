import {
  CreateCarDto,
  UpdateCarDto,
  UpdateJobDto,
} from "./electron/database/Types/car.dto";
import { CreateClientDto } from "./electron/DataBase/Types/client.dto";
import { ApiResponse } from "./electron/DataBase/Types/types";
import { APIResponse, CreateCarJob } from "./src/Types/apiTypes";
import { Car, Client, Jobs } from "./src/Types/types";
export {};

declare global {
  interface Window {
    api: {
      cars: {
        create: (car: CreateCarDto) => Promise<APIResponse>;
        getAll: () => Promise<Car[]>;
        getByLicense: (license: string) => Promise<APIResponse>;
        update: (
          id: string,
          kilometers: number
        ) => Promise<APIResponse>;
        delete: (licence: string) => Promise<APIResponse>;
        findJobs: () => Promise<{ licensePlate: string; jobs: Jobs[] }[]>;
        addJob: (licence: string, job: CreateCarJob) => Promise<APIResponse>
        updateJob: (
          licence: string,
          jobId: string,
          updateJobDto: UpdateJobDto
        ) => Promise<>;
      };

      clients: {
        create: (createClientDto: CreateClientDto) => Promise<APIResponse>;
        getAll: () => Promise<Client[]>;
        getByName: (fullname: string) => Promise<APIResponse>;
        update: (updateClientDto: Partial<CreateClientDto>) => Promise<APIResponse>;
      };
    };
  }
}
