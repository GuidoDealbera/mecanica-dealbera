
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';

// Normaliza "" (string vacío que envía el form) a undefined, para que
// @IsOptional lo trate como ausente y no dispare @IsEmail sobre un vacío.
const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

export class CreateClientDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo es requerido' })
  fullname!: string;

  @IsString()
  @IsPhoneNumber('AR', { message: 'Inserte un número de teléfono válido' })
  @IsNotEmpty({ message: 'El número de teléfono es requerido' })
  phone!: string;

  @IsString()
  @IsNotEmpty({ message: 'La dirección es requerida' })
  address!: string;

  @IsString()
  @IsNotEmpty({ message: 'La localidad es requerido' })
  city!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail({}, { message: 'Email inválido' })
  email?: string;
}

export class UpdateClientDto {
  @IsString()
  @IsNotEmpty({ message: 'El id del cliente es requerido' })
  id!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo no puede estar vacío' })
  fullname?: string;

  @IsOptional()
  @IsString()
  @IsPhoneNumber('AR', { message: 'Inserte un número de teléfono válido' })
  phone?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'La dirección no puede estar vacía' })
  address?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'La localidad no puede estar vacía' })
  city?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail({}, { message: 'Email inválido' })
  email?: string;
}
