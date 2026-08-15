import type { PaginationParams } from "./DataBase/Types/types";

const DEFAULT_PAGE_SIZE = 8;
const MAX_PAGE_SIZE = 100;

/**
 * ## Cómo paginar un QueryBuilder: `offset/limit` o `skip/take`
 *
 * TypeORM ofrece dos mecanismos y **no son intercambiables**. Elegir mal produce
 * páginas incompletas o un error en tiempo de ejecución, así que la regla:
 *
 * - **Todos los joins son `*-a-uno`** (`ManyToOne`/`OneToOne`, p. ej. `car.owner`
 *   o `reminder.car`): usar **`.offset(skip).limit(take)`**. Cada entidad ocupa
 *   una sola fila del resultado, así que `LIMIT`/`OFFSET` directo es correcto y
 *   se resuelve en una consulta menos.
 * - **Algún join es `a-muchos`** (`OneToMany`/`ManyToMany`, p. ej.
 *   `client.cars`): usar **`.skip(skip).take(take)`**. Cada entidad ocupa tantas
 *   filas como hijos tenga, así que un `LIMIT` corta por la mitad: TypeORM lo
 *   resuelve en dos pasos —una subconsulta que trae los ids distintos de la
 *   página y otra que hidrata esas entidades con todos sus hijos—.
 *
 * Las dos trampas que ya se pagaron, para que no se repitan:
 *
 * 1. **`offset/limit` sobre un join a-muchos devuelve de menos.** Medido sobre
 *    el listado de clientes (`client:get-all`, join con `client.cars`) pidiendo
 *    8: devuelve **4 clientes**, y al último de la página le faltan vehículos.
 *    El `total` sí sale bien, con lo cual la interfaz muestra "37 clientes"
 *    paginando de a 4: se nota tarde y parece un problema de datos.
 * 2. **`skip/take` no admite un `ORDER BY` que no sea una columna.** Para armar
 *    la subconsulta de ids, TypeORM mapea cada término del orden a una columna
 *    real; con una expresión (`reminder.dueDate IS NULL`) no encuentra el
 *    metadato y revienta con `TypeError: Cannot read properties of undefined
 *    (reading 'databaseName')`. Es lo que dejaba vacía la bandeja de
 *    recordatorios. Si hace falta ordenar por una expresión **y** hay un join
 *    a-muchos, la salida es ordenar por una columna equivalente o mover la
 *    expresión a una columna calculada.
 *
 * Y en cualquiera de los dos modos: **el orden tiene que terminar en una columna
 * única**. Si se ordena sólo por una columna con repetidos (año, kilómetros,
 * fecha de vencimiento), el desempate lo decide el plan de ejecución, que cambia
 * al agregar un índice o al cambiar de mecanismo de paginado. Hoy los listados
 * no se rompen por esto —se verificó recorriendo todas las páginas: sin
 * repetidos ni faltantes—, pero basta un índice nuevo para que el orden se
 * reacomode sin que nadie lo haya pedido.
 */

/**
 * Normaliza los parámetros de paginación entrantes a valores seguros y calcula
 * `skip`/`take`. Tolera valores ausentes o fuera de rango (clamp), así el
 * backend nunca arma una consulta inválida aunque el borde mande basura.
 *
 * Devuelve el desplazamiento como `skip` y el tamaño como `take` por costumbre,
 * pero sirven igual para `.offset()/.limit()`: **cuál de los dos mecanismos
 * corresponde no depende de estos valores sino de los joins de la consulta**
 * (ver la nota de arriba).
 */
export function resolvePage(params?: Partial<PaginationParams>): {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
} {
  const page = Math.max(1, Math.trunc(Number(params?.page) || 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(Number(params?.pageSize) || DEFAULT_PAGE_SIZE))
  );
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/**
 * Escapa los comodines de LIKE (`%`, `_`) y el propio escape (`\`) en un
 * término de búsqueda del usuario, para que se traten como texto literal.
 * Debe usarse junto a `... LIKE :q ESCAPE '\\'` (o `ESCAPE :esc` con `esc='\\'`).
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, "\\$&");
}
