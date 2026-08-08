import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { CreateClientDto } from "./client.dto";
import type { CarBrand } from "../Types/enums";
import { CarsBrands } from "../Types/enums";
import { JobStatus, ServiceType } from "../../../src/Types/apiTypes";

export class CreateCarDto {
  @IsString()
  @IsNotEmpty({ message: "La patente es requerida" })
  @Length(6, 7, { message: "La patente debe tener 6 o 7 caracteres" })
  @Transform(({ value }) => value.toUpperCase().replace(/\s+/g, ""))
  @Matches(/^([A-Z]{2}\d{3}[A-Z]{2}|[A-Z]{3}\d{3})$/, {
    message: "La patente debe tener el formato AA123BB o ABC123",
  })
  licensePlate!: string;

  @IsNotEmpty({ message: "La marca es requerida" })
  @IsEnum(CarsBrands)
  brand!: CarBrand;

  @IsString()
  @IsNotEmpty({ message: "El modelo es requerido" })
  model!: string;

  @IsNotEmpty({ message: "El año es requerido" })
  @IsInt()
  year!: number;

  @ValidateNested()
  @IsNotEmpty({ message: "El dueño del vehículo es requerido" })
  @Type(() => CreateClientDto)
  owner!: CreateClientDto;

  @IsNotEmpty({ message: "El kilometraje es requerido" })
  @IsInt()
  @Min(0, { message: "Los kilómetros no pueden ser negativos" })
  kilometers!: number;
}

export class JobsDto {
  @IsInt()
  price!: number;

  @IsString()
  description!: string;

  @IsBoolean()
  isThirdParty!: boolean;

  @IsEnum(JobStatus)
  status!: JobStatus;

  @IsArray()
  parts!: {
    name: string;
    price: number;
  }[];

  @IsOptional()
  @IsString()
  notes?: string;

  // Marca el trabajo como un service de este tipo (cierra el recordatorio
  // vigente y programa el siguiente). `null`/ausente = trabajo común.
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType | null;
}

export class UpdateCarDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateClientDto)
  owner?: CreateClientDto;

  @IsInt()
  @Min(0, { message: "Los kilómetros no pueden ser negativos" })
  @IsOptional()
  kilometers?: number;
}

export class UpdateJobDto {
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @IsOptional()
  @IsInt()
  price?: number;

  @IsOptional()
  parts?: {
    name: string;
    price: number;
  }[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType | null;
}

// El tipo de trabajo ahora vive en la entidad `Job` (electron/DataBase/Entities/job.entity.ts).
// El frontend mantiene su propio tipo `Jobs` en src/Types/types.ts.
