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
