import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
} from "class-validator";
import { Transform } from "class-transformer";
import { OmitibleNoNulo } from "../../validation";

// Normaliza "" (string vacío que envía el form) a undefined, para que
// @IsOptional lo trate como ausente y no dispare @IsEmail sobre un vacío.
const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === "" ? undefined : value;

export class CreateClientDto {
  @IsString()
  @IsNotEmpty({ message: "El nombre completo es requerido" })
  fullname!: string;

  @IsString()
  @IsPhoneNumber("AR", { message: "Inserte un número de teléfono válido" })
  @IsNotEmpty({ message: "El número de teléfono es requerido" })
  phone!: string;

  @IsString()
  @IsNotEmpty({ message: "La dirección es requerida" })
  address!: string;

  @IsString()
  @IsNotEmpty({ message: "La localidad es requerido" })
  city!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail({}, { message: "Email inválido" })
  email?: string;
}

// Se aplica sólo lo que viene, pero omitir un campo no es mandarlo en `null`:
// con `@IsOptional()` el `null` pasaba y el `save` reventaba contra la base con
// el mensaje crudo de SQLite. Ver `OmitibleNoNulo`.
export class UpdateClientDto {
  @IsString()
  @IsNotEmpty({ message: "El id del cliente es requerido" })
  id!: string;

  @OmitibleNoNulo("El nombre completo no puede estar vacío")
  @IsString()
  @IsNotEmpty({ message: "El nombre completo no puede estar vacío" })
  fullname?: string;

  @OmitibleNoNulo("El número de teléfono no puede estar vacío")
  @IsString()
  @IsPhoneNumber("AR", { message: "Inserte un número de teléfono válido" })
  phone?: string;

  @OmitibleNoNulo("La dirección no puede estar vacía")
  @IsString()
  @IsNotEmpty({ message: "La dirección no puede estar vacía" })
  address?: string;

  @OmitibleNoNulo("La localidad no puede estar vacía")
  @IsString()
  @IsNotEmpty({ message: "La localidad no puede estar vacía" })
  city?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail({}, { message: "Email inválido" })
  email?: string;
}
