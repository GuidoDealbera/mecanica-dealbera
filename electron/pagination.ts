import type { PaginationParams } from "./DataBase/Types/types";

const DEFAULT_PAGE_SIZE = 8;
const MAX_PAGE_SIZE = 100;

/**
 * Normaliza los parámetros de paginación entrantes a valores seguros y calcula
 * `skip`/`take` para TypeORM. Tolera valores ausentes o fuera de rango (clamp),
 * así el backend nunca arma una consulta inválida aunque el borde mande basura.
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
