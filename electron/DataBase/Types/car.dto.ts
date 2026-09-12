import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
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
import { JobStatus } from "../../../src/Types/apiTypes";

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

/**
 * Un repuesto del trabajo.
 *
 * Existe como clase y no como un tipo suelto porque `@IsArray()` sólo comprueba
 * que sea un arreglo: lo de adentro pasaba sin mirar. Y el total del documento
 * se calcula sumando estos precios con un `reduce`, así que un `price` que sea
 * texto convierte el total en `NaN` **y eso sale impreso en la factura**.
 */
export class JobPartDto {
  @IsString()
  // Se recorta antes de validar: `@IsNotEmpty` rechaza `""` pero no `"   "`, y
  // un repuesto llamado con puros espacios sale en blanco en la factura. De
  // paso el dato queda limpio, que es lo que el editor de repuestos ya hace en
  // la interfaz.
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsNotEmpty({ message: "El repuesto necesita un nombre" })
  name!: string;

  @IsNumber({}, { message: "El precio del repuesto no es un número" })
  @Min(0, { message: "El precio del repuesto no puede ser negativo" })
  price!: number;
}

/**
 * Alta de un trabajo.
 *
 * Estaba escrita como `JobsDto` y **no la usaba nadie**: el endpoint leía las
 * propiedades directamente del objeto que llega por IPC y hacía
 * `price: jobDto.price as number`, que es un cast y no comprueba nada en tiempo
 * de ejecución.
 *
 * Lo que entraba sin control, y por qué importa cada uno:
 *
 * - **`price`**: el formulario manda `""` cuando está vacío y la columna es
 *   `integer`; SQLite es de tipado laxo y guardaba la cadena vacía.
 * - **`status`**: la columna es `varchar` sin `CHECK`, así que un estado
 *   inventado se guardaba y después ninguna pantalla sabía pintarlo ni ningún
 *   filtro lo encontraba: el trabajo quedaba invisible en los listados.
 * - **`parts`**: ver `JobPartDto`.
 */
export class CreateJobDto {
  @IsInt({ message: "El precio del trabajo tiene que ser un número entero" })
  @Min(0, { message: "El precio del trabajo no puede ser negativo" })
  price!: number;

  @IsString()
  // Mismo motivo que en el nombre del repuesto: la descripción sale impresa en
  // el presupuesto, y una de puros espacios queda como un renglón vacío.
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsNotEmpty({ message: "La descripción del trabajo es requerida" })
  description!: string;

  @IsBoolean()
  isThirdParty!: boolean;

  @IsEnum(JobStatus, { message: "El estado del trabajo no es válido" })
  status!: JobStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JobPartDto)
  parts!: JobPartDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  clientNote?: string;

  // Marca el trabajo como un service: al cerrarlo se completa el recordatorio
  // vigente del vehículo y se programa el siguiente.
  @IsOptional()
  @IsBoolean()
  isService?: boolean;
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
  @IsString()
  clientNote?: string;

  @IsOptional()
  @IsBoolean()
  isService?: boolean;
}

// El tipo de trabajo ahora vive en la entidad `Job` (electron/DataBase/Entities/job.entity.ts).
// El frontend mantiene su propio tipo `Jobs` en src/Types/types.ts.
