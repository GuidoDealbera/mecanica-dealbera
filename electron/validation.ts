import "reflect-metadata";
import { ClassConstructor, plainToInstance } from "class-transformer";
import { validate, ValidationError } from "class-validator";

export type ValidationResult<T> =
  { ok: true; dto: T } | { ok: false; message: string; errors: string[] };

/**
 * Aplana los mensajes de error de class-validator, incluyendo los de
 * objetos anidados (`@ValidateNested`, ej. el `owner` de un auto).
 */
function collectMessages(errors: ValidationError[]): string[] {
  const messages: string[] = [];
  for (const error of errors) {
    if (error.constraints) {
      messages.push(...Object.values(error.constraints));
    }
    if (error.children && error.children.length > 0) {
      messages.push(...collectMessages(error.children));
    }
  }
  return messages;
}

/**
 * Valida un objeto plano (recibido por IPC) contra un DTO decorado con
 * class-validator. Devuelve la instancia validada o el/los mensajes de error.
 *
 * `whitelist: true` descarta propiedades sin decoradores de validación
 * (protección contra asignación masiva). No se usa conversión implícita de
 * tipos porque el bundle de electron (esbuild) no emite `design:type`
 * metadata; el frontend ya envía los tipos correctos.
 */
export async function validateDto<T extends object>(
  cls: ClassConstructor<T>,
  plain: unknown
): Promise<ValidationResult<T>> {
  // Un cuerpo que no es un objeto no llega ni a validarse: `plainToInstance`
  // revienta con "Cannot read properties of undefined (reading 'constructor')"
  // antes de que ningún decorador pueda decir qué falta. Se ataja acá, y con
  // eso quedan cubiertos de una vez todos los endpoints que validan un DTO.
  if (!plain || typeof plain !== "object" || Array.isArray(plain)) {
    return {
      ok: false,
      message: "Los datos enviados no son válidos",
      errors: ["Se esperaba un objeto con los datos"],
    };
  }

  const dto = plainToInstance(cls, plain);
  const errors = await validate(dto, {
    whitelist: true,
    validationError: { target: false, value: false },
  });
  if (errors.length > 0) {
    const messages = collectMessages(errors);
    return {
      ok: false,
      message: messages[0] ?? "Datos inválidos",
      errors: messages,
    };
  }
  return { ok: true, dto };
}

/**
 * Lo que llega por IPC como identificador: una patente, un id, un nombre.
 *
 * Sin esto, el valor iba derecho a un `where` de TypeORM y ahí revienta con un
 * mensaje que no le sirve a nadie —"Undefined value encountered in property
 * ... of a where condition", "Too few parameter values were provided"—, y ese
 * error crudo es lo que termina viendo el usuario. Devolver una respuesta
 * fallida es el contrato; ver `contratoDeEntrada.test.ts`.
 */
export const esIdentificador = (valor: unknown): valor is string =>
  typeof valor === "string" && valor.trim().length > 0;

/**
 * Normaliza los parámetros de un listado a un objeto con el que se pueda
 * trabajar.
 *
 * Los endpoints de listado hacen cosas como `params?.search?.trim()`. Con
 * `params` siendo una cadena eso no falla por `undefined` —`"texto".search` es
 * una función— sino más adelante y peor. Un arreglo tampoco es lo que esperan.
 */
export const comoParametros = <T extends object>(valor: unknown): Partial<T> =>
  valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Partial<T>)
    : {};
