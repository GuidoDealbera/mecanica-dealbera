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
  // El `typeof` no sobra: un `@Transform` corre **antes** de las validaciones,
  // así que con un cuerpo que no sea un objeto —o sin patente— acá llegaba
  // `undefined` y la transformación reventaba antes de que nadie pudiera
  // decir "la patente es requerida".
  @Transform(({ value }) =>
    typeof value === "string" ? value.toUpperCase().replace(/\s+/g, "") : value
  )
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

  /**
   * Cliente ya registrado que el usuario eligió en el autocompletar.
   *
   * Antes no existía: el backend buscaba al titular **por nombre**, así que la
   * identidad del cliente era su nombre. Con eso, dos personas que se llaman
   * igual son la misma para el sistema, y renombrar a alguien cambia la clave
   * con la que lo referencian las pantallas.
   *
   * Ahora quien decide es el formulario, que es el único que sabe si el usuario
   * eligió a alguien de la lista o escribió un nombre nuevo. Si viene el `id`,
   * el vehículo se asocia a **ese** cliente; si no viene, se crea uno.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "El titular seleccionado es inválido" })
  ownerId?: string;

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

/**
 * Edición de un vehículo.
 *
 * Estaba escrita y **no la usaba nadie**: el endpoint recibía `(id, kilometers)`
 * y nada más, así que un modelo mal escrito o un año equivocado sólo se podían
 * arreglar borrando el vehículo —perdiendo sus trabajos, su historial de
 * kilometraje y su recordatorio— y volviéndolo a cargar.
 *
 * **La patente no está acá a propósito.** Es la identidad del vehículo: la usan
 * las rutas de la aplicación, los recordatorios y el registro de documentos ya
 * emitidos. Cambiarla es otra operación, no una corrección de tipeo.
 *
 * Todos los campos son opcionales: se aplica sólo lo que viene.
 */
export class UpdateCarDto {
  @IsOptional()
  @IsEnum(CarsBrands, { message: "La marca no es válida" })
  brand?: CarBrand;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsNotEmpty({ message: "El modelo no puede quedar vacío" })
  model?: string;

  @IsOptional()
  @IsInt({ message: "El año tiene que ser un número entero" })
  // El piso es el del automóvil, no una fecha redonda: por debajo de eso es un
  // error de tipeo, no un vehículo. El techo lo comprueba el endpoint, que es
  // quien sabe en qué año estamos.
  @Min(1886, { message: "El año no parece un año" })
  year?: number;

  @IsOptional()
  @IsInt({ message: "El kilometraje tiene que ser un número entero" })
  @Min(0, { message: "Los kilómetros no pueden ser negativos" })
  kilometers?: number;
}

/**
 * Edición de un trabajo. Todos los campos son opcionales: se aplica sólo lo que
 * viene, para poder cambiar el estado sin tener que remandar el resto.
 *
 * Estaba escrita entera y el endpoint la usaba **sólo como tipo de
 * TypeScript**: los decoradores no corrían nunca, así que editar un trabajo era
 * la puerta de atrás para meter lo mismo que el alta rechazaba.
 */
export class UpdateJobDto {
  @IsOptional()
  @IsEnum(JobStatus, { message: "El estado del trabajo no es válido" })
  status?: JobStatus;

  @IsOptional()
  @IsInt({ message: "El precio del trabajo tiene que ser un número entero" })
  @Min(0, { message: "El precio del trabajo no puede ser negativo" })
  price?: number;

  // Mismas reglas que en el alta: sin `@ValidateNested` los ítems del arreglo
  // no se miran, y de ahí sale el total que se imprime en el documento.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JobPartDto)
  parts?: JobPartDto[];

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
