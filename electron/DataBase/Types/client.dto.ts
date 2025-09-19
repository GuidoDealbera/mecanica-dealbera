
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
} from 'class-validator';

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
  @IsEmail({}, { message: 'Email inválido' })
  email?: string;
}
